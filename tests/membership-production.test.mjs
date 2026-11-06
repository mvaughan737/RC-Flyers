import {upcomingMeetings} from '../netlify/pilot/meetings.mjs';
import {scryptSync} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {build} from '../scripts/build-netlify.mjs';
import productionFunction,{loadProductionAssets} from '../netlify/functions/membership-production.mjs';
import {createProductionHandler,productionHeaders,sendProductionOnce,STORE_NAME} from '../netlify/production/service.mjs';
import {STORE_NAME as PILOT_STORE,read} from '../netlify/pilot/service.mjs';
import {validate,notification,dues} from '../netlify/pilot/domain.mjs';
import {completedPDF} from '../netlify/pilot/pdf.mjs';
import {sample,MemoryStore} from './pilot-fixtures.mjs';
import {browserHarness} from './membership-browser-harness.mjs';
const root=await mkdtemp(join(tmpdir(),'cfe-production-'));
await build(join(root,'public'),join(root,'netlify/pilot-private'));
const assets=await loadProductionAssets(root);
test('landing page notice follows submission availability without publishing the inline form',async()=>{
 const closed=await readFile(join(root,'public/membership.html'),'utf8');
 assert.match(closed,/Online applications are not yet open/);
 const active=await build(join(root,'active-public'),join(root,'active/netlify/pilot-private'),{publicSubmissions:true});
 const html=await readFile(join(active.output,'membership.html'),'utf8');
 assert.doesNotMatch(html,/Online applications are not yet open|id="membership-form"/);
 assert.match(html,/href="\/membership-production"/);
 assert.match(html,/href="#membership-documents"/);
});
const {fictional,...app}=sample;
app.email='applicant@gmail.com';app.name='Alex "Sky" Applicant';
const comments='COMMENTS-PRIVATE-ONLY <script>alert("x")</script> &\nSecond line: thanks!';
test('closed production has no public submission bypass; independent operator review stays held',async()=>{
 const salt=Buffer.alloc(16,3),password='operator-fixture-only-not-a-hosted-credential';
 const hash=`scrypt-v1$${salt.toString('hex')}$${scryptSync(password,salt,32,{N:32768,r:8,p:1,maxmem:128*1024*1024}).toString('hex')}`;
 const env={CFE_PRODUCTION_ENABLED:'true',CFE_PRODUCTION_EMAIL_ENABLED:'false',CFE_PRODUCTION_PUBLIC_SUBMISSIONS_ENABLED:'false',CFE_PRODUCTION_ORIGIN:'https://production.example',CFE_PRODUCTION_SECRET:'independent-operator-fixture-secret-32-characters',CFE_PRODUCTION_OPERATOR_PASSWORD_HASH:hash};
 const store=new MemoryStore();let now=Date.parse('2026-11-06T18:00:00Z');
 const handler=createProductionHandler({env,store,assets,clock:()=>now,transport:async()=>assert.fail('No email authorized')});
 const req=(path,options={})=>handler(new Request(env.CFE_PRODUCTION_ORIGIN+path,options),{ip:'192.0.2.17'});
 let r=await req('/membership-production');assert.equal(r.status,200);assert.match(await r.text(),/Online applications are not yet open/);assert.equal(store.entries.size,0);
 assert.equal((await req('/membership-production/operator')).status,401);
 for(const path of ['/membership-production/api/session','/membership-production/api/review','/membership-production/api/download','/membership-production/api/submit','/membership-production/api/send','/.netlify/functions/membership-production/api/session'])assert.equal((await req(path,{method:path.endsWith('session')?'GET':'POST'})).status,404);
 const auth='Basic '+Buffer.from('operator:'+password).toString('base64');
 assert.equal((await req('/membership-production/operator',{headers:{Authorization:'Basic '+Buffer.from('george:'+password).toString('base64')}})).status,401);
 r=await req('/membership-production/operator',{headers:{Authorization:auth}});assert.equal(r.status,200);assert.match(await r.text(),/membership-form/);
 r=await req('/membership-production/api/session',{headers:{Authorization:auth}});const session=await r.json();assert.equal(session.sendingEnabled,false);
 const cookie=r.headers.get('set-cookie').split(';')[0];now+=3000;
 const post=(action,body={})=>req('/membership-production/api/'+action,{method:'POST',headers:{Authorization:auth,Cookie:cookie,Origin:env.CFE_PRODUCTION_ORIGIN,'Content-Type':'application/json','X-Membership-Token':session.token},body:JSON.stringify(body)});
 assert.equal((await post('review',{application:app})).status,200);assert.equal((await post('download')).status,200);r=await post('submit');assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.status,'held');assert.equal((await read(store,'submissions/'+saved.id)).data.attempts,0);
 assert.equal((await post('send',{id:saved.id})).status,403);
 const unsafe=createProductionHandler({env:{...env,CFE_PRODUCTION_EMAIL_ENABLED:'true'},store,assets});
 assert.equal((await unsafe(new Request(env.CFE_PRODUCTION_ORIGIN+'/membership-production/operator',{headers:{Authorization:auth}}))).status,503);
});
test('all dues periods, categories and years use confirmed amounts and flat late fees',()=>{
 for(const year of [2026,2027,2028])for(const month of [1,3,4,6,7,9,10,12])for(const kind of ['new','renewal'])for(const category of ['regular','spouse','junior']){
  const q=dues(kind,category,`${year}-${String(month).padStart(2,'0')}-${month===3?'31':'01'}`);
  const following=category==='regular'&&month>=10;
  const base=category==='spouse'?5:category==='junior'?0:kind==='new'&&[7,9].includes(month)?75:100;
  const fee=kind==='renewal'&&month>3&&!following?20:0;
  assert.equal(q.amount,base+fee);assert.equal(q.lateFee,fee);assert.equal(q.membershipYear,year+Number(following));assert.equal(q.expiry,`${q.membershipYear}-12-31`);
 }
});
test('upcoming meetings respect Indianapolis time, year boundary, DST and server validation',async()=>{
 for(const [instant,expected] of [
  ['2026-12-31T23:00:00Z','2027-01-05'],['2026-12-01T22:59:00Z','2026-12-01'],['2026-12-01T23:00:00Z','2027-01-05'],
  ['2026-07-07T21:59:00Z','2026-07-07'],['2026-07-07T22:00:00Z','2026-08-04'],['2027-01-01T02:00:00Z','2027-01-05']]){
  const schedule=upcomingMeetings(Date.parse(instant));assert.equal(schedule.confirmedDates[0],expected);assert.equal(schedule.confirmedDates.length,12);
  for(const day of schedule.confirmedDates){const date=new Date(day+'T12:00:00Z');assert.equal(date.getUTCDay(),2);assert.ok(date.getUTCDate()<=7);}
  const py=spawnSync('python',['-B','-c',"import sys,json;sys.path.insert(0,'scripts');import membership as m;from datetime import datetime;print(json.dumps(m.meeting_schedule(datetime.fromisoformat(sys.argv[1]))))",instant],{encoding:'utf8'});
  assert.equal(py.status,0,py.stderr);assert.deepEqual(JSON.parse(py.stdout).confirmedDates,schedule.confirmedDates);
 }
 const schedule=upcomingMeetings(Date.parse('2026-11-06T18:00:00Z'));
 assert.throws(()=>validate({...app,meetingDate:''},schedule,'2026-11-06',{production:true}));
 assert.throws(()=>validate({...app,meetingDate:'2026-12-02'},schedule,'2026-11-06',{production:true}));
 assert.equal(validate({...app,kind:'renewal',meetingDate:''},schedule,'2026-11-06',{production:true}).meetingDate,'');
 const f=fixture();const session=await f.session();assert.deepEqual(session.meetings.confirmedDates,schedule.confirmedDates);
});
test('generated totals, late-fee marks, membership year and blank signatures match all categories',async()=>{
 for(const category of ['regular','spouse','junior']){
  const data=validate({...app,kind:'renewal',category,paymentDate:'2027-04-06',dob:category==='junior'?'2012-02-29':''},assets.meetings,'2026-11-06',{production:true});
  const quote=dues(data.kind,category,data.paymentDate),pdf=await completedPDF(data,quote,assets,{production:true});
  const check=spawnSync('python',['-B','-c',"import sys,fitz;d=fitz.open(stream=sys.stdin.buffer.read(),filetype='pdf');p=d[0];assert 'X' in p.get_textbox(fitz.Rect(76,340,91,356));assert sys.argv[1] in p.get_textbox(fitz.Rect(495,474,540,490));assert not p.get_textbox(fitz.Rect(145,586,536,603)).strip();t=''.join(x.get_text() for x in d);assert 'Membership year: 2027' in t;assert 'Pending Board' not in t",String(quote.amount)],{input:pdf});
  assert.equal(check.status,0,check.stderr?.toString());
  for(const body of Object.values(notification(data,quote,assets.template,{production:true}))){assert.ok(body.includes(`$${quote.amount} (includes $20 late fee)`));assert.ok(body.includes('2027'));}
 }
});
test('Board decisions reach form, review and both email formats without expanding fee or renewal scope',async()=>{
 const page=assets.page;
 for(const section of [page.slice(page.indexOf('id="online-application"'),page.indexOf('id="application-review"')),page.slice(page.indexOf('id="application-review"'),page.indexOf('id="membership-information-title"'))]){
  for(const phrase of ['Board vote followed by approval by a majority','members present at the next club meeting','Paid junior members have voting rights','flat $20 after March 31 for Regular, Spouse and Junior memberships, not 20%'])assert.ok(section.includes(phrase),phrase);
 }
 for(const kind of ['new','renewal'])for(const meetingDate of ['2026-12-01','2027-07-06'])for(const body of Object.values(notification({...app,kind,meetingDate},dues(kind,'regular',app.paymentDate),assets.template,{production:true}))){
  for(const phrase of ['Dear Membership','An officer verifies AMA membership, then the applicant signs','membership-application.pdf',kind==='new'?'A new membership application':'A membership renewal',meetingDate==='2026-12-01'?'Dec 1, 2026 at 6:00 PM EST':'Jul 6, 2027 at 6:00 PM EDT'])assert.ok(body.includes(phrase),phrase);
  for(const phrase of ['Mailing payment is not an option','The printed $25 option','Paid junior members have voting rights','Board vote followed','America/Indiana/Indianapolis'])assert.ok(!body.includes(phrase),phrase);
 }
 assert.ok(page.includes('href="contact.html#contact-form">contact form</a>'));
 assert.ok(!page.includes('LESouthwick@outlook.com'));
 assert.ok(!page.includes('America/Indiana/Indianapolis'));
 for(const category of ['spouse','junior'])for(const day of ['2026-04-01','2026-09-30','2026-10-01','2026-12-31'])assert.equal(dues('renewal',category,day).amount,category==='spouse'?25:20);
 assert.equal(dues('new','regular','2026-06-30').amount,100);
 for(const kind of ['new','renewal'])for(const day of ['2026-10-01','2026-12-31','2027-10-01']){
  const q=dues(kind,'regular',day);
  assert.equal(q.amount,100);assert.equal(q.expiry,`${Number(day.slice(0,4))+1}-12-31`);assert.equal(q.lateFee,0);
 }
 assert.equal(dues('renewal','regular','2026-04-01').lateFee,20);
 assert.equal(dues('new','junior','2026-11-06').amount,0);
 assert.match(page,/Required grievance\s+steps apply only to disputes between members\./);
 assert.match(page,/immediately without a subsequent membership confirmation vote/);
});
function fixture({enabled=false,transport=async()=>{throw new Error('Unexpected network');},store=new MemoryStore()}={}){
 let now=Date.parse('2026-11-06T18:00:00Z'),token,cookie;
 const env={CFE_PRODUCTION_ENABLED:'true',CFE_PRODUCTION_PUBLIC_SUBMISSIONS_ENABLED:'true',CFE_PRODUCTION_EMAIL_ENABLED:String(enabled),CFE_PRODUCTION_ORIGIN:'https://production.example',CFE_PRODUCTION_SECRET:'production-only-fixture-secret-32-characters',CFE_PRODUCTION_RESEND_API_KEY:'mock-production-key'};
 const handler=createProductionHandler({env,store,assets,clock:()=>now,transport});
 const request=(path,options={})=>handler(new Request(env.CFE_PRODUCTION_ORIGIN+path,options),{ip:'192.0.2.5'});
 const post=(action,body={},headers={})=>request('/membership-production/api/'+action,{method:'POST',headers:{Cookie:cookie,Origin:env.CFE_PRODUCTION_ORIGIN,'X-Membership-Token':token,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 async function session(){const r=await request('/membership-production/api/session');assert.equal(r.status,200);const d=await r.json();token=d.token;cookie=r.headers.get('set-cookie').split(';')[0];assert.match(cookie,/^cfe_production_session=/);now+=3000;return d;}
 async function save(application={...app,comments}){await session();const review=await post('review',{application});assert.equal(review.status,200,await review.clone().text());const pdf=await post('download');assert.equal(pdf.status,200);const saved=await post('submit');assert.equal(saved.status,200,await saved.clone().text());return saved.json();}
 return {env,store,request,post,session,save,advance:ms=>now+=ms};
}
test('production accepts real applicants, validates headers and rejects client routing overrides',()=>{
 const data=validate({...app,comments},assets.meetings,'2026-11-06',{production:true});
 assert.equal(data.comments,comments);assert.equal(data.phone,'(202) 555-0142');assert.ok(!('fictional' in data));
 assert.deepEqual(productionHeaders(data),{from:'Converse Flying Eagles Membership <membership@converseflyingeagles.org>',to:['jlsouth5963@gmail.com'],bcc:['mvaughan737@gmail.com'],reply_to:`${JSON.stringify(app.name)} <${app.email}>`});
 for(const change of [{name:'Alex\r\nBcc: victim@example.com'},{email:'a@gmail.com\nBcc:x@gmail.com'},{email:'a@gmail.com,other@gmail.com'},{email:'A <a@gmail.com>'},{email:'a..b@gmail.com'},{name:''},{to:'evil@gmail.com'},{bcc:'evil@gmail.com'},{from:'evil@gmail.com'},{reply_to:'evil@gmail.com'},{fictional:true},{acknowledge:false},{comments:'x'.repeat(2001)},{comments:'a\0b'},{comments:[]},{phone:'123'}])assert.throws(()=>validate({...app,...change},assets.meetings,'2026-11-06',{production:true}),JSON.stringify(change));
 assert.equal(validate({...app,comments:'x'.repeat(2000)},assets.meetings,'2026-11-06',{production:true}).comments.length,2000);
 assert.throws(()=>productionHeaders({...app,email:'a@gmail.com\r\nBcc: x@gmail.com'}));
});
test('HTML and plain text include safe multiline comments only when nonblank, with production attachment and pending procedures',()=>{
 const quote=dues(app.kind,app.category,app.paymentDate);
 const message=notification({...app,comments},quote,assets.template,{production:true});
 assert.match(message.html,/<h2>Applicant Comments<\/h2>/);assert.match(message.html,/&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp;<br>Second line: thanks!/);
 assert.ok(!message.html.includes('<script>'));assert.match(message.text,new RegExp('Applicant Comments\\nCOMMENTS-PRIVATE-ONLY'));
 assert.ok(message.text.includes(comments));
 for(const body of [message.html,message.text]){assert.ok(body.includes('membership-application.pdf'));assert.ok(!body.includes('Pending Board Confirmation'));assert.ok(body.includes('An officer verifies AMA membership'));assert.ok(!body.includes('FICTIONAL'));assert.ok(!body.includes('have the applicant review and sign'));}
 for(const c of ['', ' \n\t ', undefined])for(const body of Object.values(notification({...app,comments:c},quote,assets.template,{production:true})))assert.ok(!body.includes('Applicant Comments'));
});
test('production form and storage are private, isolated and held; comments survive duplicate saves and session recovery',async()=>{
 assert.notEqual(STORE_NAME,PILOT_STORE);const f=fixture();const saved=await f.save();assert.equal(saved.status,'held');
 const stored=(await read(f.store,'submissions/'+saved.id)).data;assert.equal(stored.data.comments,comments);assert.equal(stored.attempts,0);assert.ok(stored.message.text.includes(comments));
 const duplicate=await (await f.post('submit')).json();assert.equal(duplicate.id,saved.id);assert.equal(duplicate.duplicate,true);
 assert.equal((await f.post('send',{id:saved.id})).status,403);
 const publicPage=await readFile(join(root,'public/membership.html'),'utf8');assert.ok(!publicPage.includes('membership-form'));
 assert.match(assets.page,/name="comments" maxlength="2000" rows="5"/);assert.match(assets.page,/0 \/ 2,000 characters/);assert.ok(assets.page.indexOf('name="comments"')>assets.page.indexOf('name="acknowledge"'));
 assert.ok(assets.page.includes('Optional. These comments will be included in the email to the Secretary but will not appear on your PDF application.'));
 for(const text of ['Fictional applicants only','name="fictional"','Fictional email','prototype','cached pilot password'])assert.ok(!assets.page.includes(text),text);
 assert.match(assets.page,/data-api-base="\/membership-production\/api"/);assert.ok(!assets.page.includes('Pending Board Confirmation'));assert.match(assets.page,/An officer verifies AMA membership/);
 assert.equal((await productionFunction(new Request('https://production.example/membership-production'))).status,404);
 const launched=await build(join(root,'future-public'),join(root,'future/netlify/pilot-private'),{productionPublic:true});assert.match(await readFile(join(launched.output,'membership.html'),'utf8'),/name="comments"/);
});
test('production CSRF, spam, honeypot, minimum time, validation and expiry remain enforced',async()=>{
 const f=fixture();await f.session();
 for(const headers of [{Origin:'https://evil.example'},{Cookie:''},{'X-Membership-Token':'bad'},{'Content-Type':'text/plain'}])assert.ok([400,403].includes((await f.post('review',{application:app},headers)).status));
 assert.equal((await f.post('review',{application:app,website:'spam'})).status,400);
 assert.equal((await f.post('review',{application:{...app,comments:'x'.repeat(2001)}})).status,400);
 assert.equal((await f.post('review',{application:app,large:'x'.repeat(13000)})).status,413);
 f.advance(-3000);assert.equal((await f.post('review',{application:app})).status,400);f.advance(3000);
 for(let i=0;i<35;i++)await f.post('download');assert.equal((await f.post('download')).status,429);
 f.advance(3600001);assert.equal((await f.post('submit')).status,400);
});
test('mocked delivery uses fixed From/To/Bcc, applicant Reply-To, exact attachment and durable deduplication',async()=>{
 let calls=0,payload,headers;
 const transport=async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');payload=JSON.parse(options.body);headers=options.headers;return new Response(JSON.stringify({id:'mock-id'}),{status:200});};
 const f=fixture({transport});const saved=await f.save();assert.equal(calls,0);
 await assert.rejects(()=>sendProductionOnce(f.store,saved.id,f.env,transport));assert.equal(calls,0);
 const results=await Promise.allSettled([sendProductionOnce(f.store,saved.id,{...f.env,CFE_PRODUCTION_EMAIL_ENABLED:'true'},transport),sendProductionOnce(f.store,saved.id,{...f.env,CFE_PRODUCTION_EMAIL_ENABLED:'true'},transport)]);
 assert.equal(calls,1);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.deepEqual({...payload,subject:undefined,html:undefined,text:undefined,attachments:undefined},{...productionHeaders(app),subject:undefined,html:undefined,text:undefined,attachments:undefined});
 assert.equal(payload.attachments[0].content,(await read(f.store,'submissions/'+saved.id)).data.pdf);assert.equal(payload.attachments[0].filename,'membership-application.pdf');
 assert.ok(payload.text.includes(comments));assert.match(payload.html,/Applicant Comments/);assert.match(headers['Idempotency-Key'],/^cfe-production-v1\//);
 assert.equal((await read(f.store,'submissions/'+saved.id)).data.status,'accepted');
 const automatic=fixture({enabled:true,transport});const auto=await automatic.save();assert.equal(auto.status,'accepted');assert.equal(calls,2);await automatic.post('submit');assert.equal(calls,2);
});
test('delivery failures and uncertain sends retain comments privately for reconciliation; no automatic retries',async()=>{
 for(const mode of ['provider','network']){
  let calls=0;const f=fixture({enabled:true,transport:async()=>{calls++;if(mode==='network')throw new TypeError('mock-production-key disconnected');return new Response(JSON.stringify({message:'mock-production-key invalid'}),{status:422});}});
  const saved=await f.save();assert.equal(saved.status,'failed');const record=(await read(f.store,'submissions/'+saved.id)).data;
  assert.equal(record.data.comments,comments);assert.ok(record.message.text.includes(comments));assert.equal(record.error.automatic_retry,false);assert.equal(record.error.reconciliation_required,true);assert.ok(!JSON.stringify(record.error).includes('mock-production-key'));
  await f.post('submit');assert.equal(calls,1);await assert.rejects(()=>sendProductionOnce(f.store,saved.id,f.env,async()=>{throw new Error('No retry');}));
 }
 const f=fixture();const saved=await f.save();const original=f.store.setJSON.bind(f.store);f.store.setJSON=async(key,data,conditions)=>{if(data.status==='accepted')throw new Error('save failed');return original(key,data,conditions);};
 await assert.rejects(()=>sendProductionOnce(f.store,saved.id,{...f.env,CFE_PRODUCTION_EMAIL_ENABLED:'true'},async()=>new Response('{"id":"uncertain"}')));
 assert.equal((await read(f.store,'submissions/'+saved.id)).data.status,'sending');await assert.rejects(()=>sendProductionOnce(f.store,saved.id,{...f.env,CFE_PRODUCTION_EMAIL_ENABLED:'true'},async()=>{throw new Error('No retry');}));
});
test('all original-style PDF pages exclude comments, including unsupported glyphs and supplementary overflow pages',async()=>{
 const data=validate({...app,comments:comments+'\n??',ama:'W'.repeat(24)},assets.meetings,'2026-11-06',{production:true});
 const pdf=await completedPDF(data,dues(data.kind,data.category,data.paymentDate),assets,{production:true});
 await writeFile(join(root,'production-review.pdf'),pdf);
 const check=spawnSync('python',['-B','-c',"import sys,fitz;d=fitz.open(stream=sys.stdin.buffer.read(),filetype='pdf');t=''.join(p.get_text() for p in d);assert len(d)>=2;assert 'Pending Board confirmation' not in t;assert 'officer verifies AMA membership, then applicant signs above.' in t;assert 'COMMENTS-PRIVATE-ONLY' not in t;assert 'Applicant Comments' not in t;assert 'PILOT' not in t;assert 'W'*24 in t;assert 'APPLICATION' in t.upper();d[0].get_pixmap(matrix=fitz.Matrix(1.2,1.2)).save(sys.argv[1]);d[1].get_pixmap(matrix=fitz.Matrix(1.2,1.2)).save(sys.argv[2])",join(root,'page-1.png'),join(root,'page-2.png')],{input:pdf});
 assert.equal(check.status,0,check.stderr?.toString());
 console.log('Production PDF visual QA: '+root);
});
test('production comments count, review/edit, Back/Forward, reload and PDF tab preserve answers',async()=>{
 const b=await browserHarness({production:true});await b.advance(3000);await b.fill({...app,comments});assert.equal(b.page.ids['comments-count'].textContent,`${comments.length} / 2,000 characters`);
 await b.review();assert.equal(b.page.ids['application-review'].hidden,false,b.page.ids['application-error'].textContent);
 const row=b.page.ids['application-summary'].children.find(row=>row.children[0].textContent==='Comments for the Membership Secretary');assert.equal(row.children[1].textContent,comments);assert.equal(row.children[1].style.whiteSpace,'pre-wrap');
 await b.click('application-download');assert.equal(b.tabs.length,1);assert.equal(b.tabs[0].storage.has('cfe:membership-production:v1'),false);
 await b.click('application-edit');assert.equal(b.page.form.elements.comments.value,comments);await b.fill({comments:'Edited\ncomments'});await b.back();assert.equal(b.page.form.elements.comments.value,comments);await b.forward();assert.equal(b.page.form.elements.comments.value,'Edited\ncomments');await b.load();assert.equal(b.page.form.elements.comments.value,'Edited\ncomments');
 await b.review();await b.click('application-download');await b.checkPDF();await b.click('application-submit');const record=[...b.store.entries].find(([k])=>k.startsWith('submissions/'))[1].data;assert.equal(record.data.comments,'Edited\ncomments');assert.equal(record.status,'held');assert.equal(record.attempts,0);
});

test('production delivery refuses pilot records and a private save failure never calls mail transport',async()=>{
 let calls=0;const transport=async()=>{calls++;throw new Error('No delivery');};
 const f=fixture({enabled:true,transport});
 await f.store.setJSON('submissions/pilot',{status:'held',attempts:0,data:sample});
 await assert.rejects(()=>sendProductionOnce(f.store,'pilot',f.env,transport),/Only production records/);assert.equal(calls,0);
 const original=f.store.setJSON.bind(f.store);f.store.setJSON=async(key,...args)=>{if(key.startsWith('submissions/'))throw new Error('private storage unavailable');return original(key,...args);};
 await f.session();assert.equal((await f.post('review',{application:app})).status,200);await f.post('download');assert.equal((await f.post('submit')).status,503);assert.equal(calls,0);
});
