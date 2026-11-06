import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {browserHarness} from './membership-browser-harness.mjs';
import {sample} from './pilot-fixtures.mjs';
const key='cfe:membership-pilot:v2';
async function reviewed(options){const b=await browserHarness(options);await b.advance(3000);await b.fill({...sample,phone:'012.034.0056',cell:''});await b.review();assert.equal(b.page.ids['application-review'].hidden,false,b.page.ids['application-error'].textContent);return b;}
test('fictional entry → Review → separate PDF tab → return → Edit retains every field and selection',async()=>{
    const b=await reviewed();const before=JSON.parse(b.storage.get(key)).entries[b.entries[b.index].cfeMembership.id].fields;
    await b.click('application-download');assert.equal(b.tabs.length,1);const tab=b.tabs[0];assert.match(tab.url,/^blob:/);assert.equal(tab.opener,null);assert.equal(tab.storage.has(key),false,'PDF tab must not inherit the draft cache');assert.equal(b.storage.has(key),true);
    assert.equal(b.events.at(-2),'open');assert.equal(b.events.at(-1),'fetch:download');assert.equal(b.page.ids['application-review'].hidden,false);
    const blob=b.blobs.get(tab.url);assert.equal(Buffer.from(await blob.arrayBuffer()).subarray(0,4).toString(),'%PDF');
    await b.click('application-edit');assert.equal(b.page.form.hidden,false);for(const[k,v]of Object.entries(before))assert.equal(['acknowledge','fictional'].includes(k)?b.page.form.elements[k].checked:b.page.form.elements[k].value,v,k);
    assert.equal(b.page.form.elements.phone.value,'(012) 034-0056');assert.equal(b.page.form.elements.cell.value,'');assert.equal(b.submissionCount(),0);
});
test('popup blocker exposes ordinary safe PDF links without changing the form tab',async()=>{
    const b=await reviewed({blocked:true});await b.click('application-download');assert.equal(b.tabs.length,0);assert.equal(b.page.ids['application-pdf-links'].hidden,false);
    const link=b.page.ids['application-pdf-open'];assert.match(link.href,/^blob:/);assert.equal(link.target,'_blank');assert.match(link.rel,/noopener/);assert.match(b.page.ids['application-status'].textContent,/use the Open PDF link/);
    await b.click('application-edit');assert.equal(b.page.form.elements.name.value,sample.name);assert.equal(b.submissionCount(),0);
    const html=await readFile('membership.html','utf8');assert.match(html,/id="application-pdf-open" target="_blank" rel="noopener noreferrer"/);
});
test('Back/Forward, reload and bfcache restore form/review; only opaque entry IDs enter history',async()=>{
    const b=await reviewed();await b.click('application-download');await b.checkPDF();const reviewID=b.entries[b.index].cfeMembership.id;
    await b.click('application-edit');await b.fill({name:'Edited Fictional Pilot',category:'spouse',kind:'renewal'});const editID=b.entries[b.index].cfeMembership.id;
    await b.back();assert.equal(b.page.ids['application-review'].hidden,false);assert.equal(b.page.form.elements.name.value,sample.name);assert.equal(b.page.ids['pdf-reviewed'].checked,true);
    await b.forward();assert.equal(b.page.form.hidden,false);assert.equal(b.page.form.elements.name.value,'Edited Fictional Pilot');assert.equal(b.page.form.elements.category.value,'spouse');assert.equal(b.page.form.elements.kind.value,'renewal');
    b.page.listeners.pagehide();await b.load();assert.equal(b.page.form.elements.name.value,'Edited Fictional Pilot');assert.equal(b.entries[b.index].cfeMembership.id,editID);
    await b.back();assert.equal(b.entries[b.index].cfeMembership.id,reviewID);await b.page.listeners.pageshow({persisted:true});await b.settle();assert.equal(b.page.ids['application-review'].hidden,false);
    const history=JSON.stringify(b.entries);for(const value of [sample.name,sample.email,sample.address,'Edited Fictional Pilot'])assert.ok(!history.includes(value));assert.equal(b.submissionCount(),0);
});
test('saved application stays visible; navigation never submits; repeat identical save deduplicates',async()=>{
    const b=await reviewed();await b.click('application-download');await b.checkPDF();await b.click('application-submit');assert.equal(b.submissionCount(),1);assert.equal(b.page.ids['application-review'].hidden,false);assert.equal(b.page.ids['application-submit'].disabled,true);
    const submits=b.requests.filter(r=>r.path.endsWith('/submit')).length;
    await b.load();await b.back();await b.forward();assert.equal(b.requests.filter(r=>r.path.endsWith('/submit')).length,submits);assert.equal(b.submissionCount(),1);
    await b.click('application-edit');await b.review();await b.click('application-download');await b.checkPDF();await b.click('application-submit');assert.equal(b.submissionCount(),1);
    const record=[...b.store.entries].find(([k])=>k.startsWith('submissions/'))[1].data;assert.equal(record.attempts,0);assert.equal(record.status,'held');
});
test('history restores an earlier reviewed version with a freshly matching server PDF',async()=>{
    const b=await reviewed();await b.click('application-download');await b.checkPDF();await b.click('application-edit');await b.fill({name:'Second Fictional Version'});await b.review();await b.click('application-download');
    await b.back();await b.back();assert.equal(b.page.form.elements.name.value,sample.name);assert.equal(b.page.ids['application-review'].hidden,false);assert.equal(b.page.ids['pdf-reviewed'].disabled,true,'changed server PDF needs a fresh check');
    await b.click('application-download');const record=[...b.store.entries].find(([k])=>k.startsWith('sessions/'))[1].data;assert.equal(record.review.data.name,sample.name);assert.equal(record.downloaded,true);
    await b.forward();await b.forward();assert.equal(b.page.form.elements.name.value,'Second Fictional Version');assert.equal(b.page.ids['application-review'].hidden,false);assert.equal(b.submissionCount(),0);
});
test('Start New confirms loss, clears only the pilot cache and cannot resurrect old history',async()=>{
    const b=await reviewed();b.confirm=false;await b.click('application-new');assert.equal(b.page.form.elements.name.value,sample.name);assert.equal(b.page.ids['application-review'].hidden,false);
    b.confirm=true;await b.click('application-new');assert.equal(b.page.form.elements.name.value,'');assert.equal(b.page.form.elements.kind.value,'new');assert.equal(b.page.form.elements.category.value,'regular');assert.equal(b.storage.get('unrelated-public-feature'),'keep');
    assert.ok(!b.storage.get(key).includes(sample.email));await b.back();await b.forward();assert.equal(b.page.form.elements.name.value,'');assert.equal(b.submissionCount(),0);
});
test('logout and absolute expiry erase drafts, revoke PDF URLs and prevent bfcache recovery',async()=>{
    const b=await reviewed();await b.click('application-download');await b.click('application-logout');assert.deepEqual(JSON.parse(b.storage.get(key)),{ended:true});assert.equal(b.page.form.elements.name.value,'');assert.ok(b.revoked.length);await b.page.listeners.pageshow({persisted:true});await b.settle();assert.equal(b.page.form.elements.name.value,'');
    const expired=await reviewed();await expired.advance(3600001,false);expired.page.docListeners.visibilitychange();assert.deepEqual(JSON.parse(expired.storage.get(key)),{ended:true});assert.equal(expired.page.form.elements.name.value,'');await expired.load();assert.equal(expired.page.form.hidden,true);assert.ok(!expired.storage.get(key).includes(sample.email));
});
test('server-session mismatch clears a stale tab cache; unavailable storage recovers reviewed answers privately',async()=>{
    const b=await reviewed();const stored=JSON.parse(b.storage.get(key));stored.sessionID='another-session';b.storage.set(key,JSON.stringify(stored));await b.load();assert.equal(b.page.form.elements.name.value,'');assert.deepEqual(JSON.parse(b.storage.get(key)),{ended:true});
    const noStorage=await reviewed({storageDisabled:true});await noStorage.load();assert.equal(noStorage.page.ids['application-review'].hidden,false);assert.equal(noStorage.page.form.elements.name.value,sample.name);assert.equal(noStorage.storage.has(key),false);
});
