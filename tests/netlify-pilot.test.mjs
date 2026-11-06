import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from '../scripts/build-netlify.mjs';
import {loadAssets,config} from '../netlify/functions/membership-pilot.mjs';
import {validate,dues,phone,displayDate,notification,TO,FROM} from '../netlify/pilot/domain.mjs';
import {completedPDF} from '../netlify/pilot/pdf.mjs';
import {createHandler,sendOnce,read} from '../netlify/pilot/service.mjs';
import {localBlobs} from '../scripts/local-blobs.mjs';
import {sample,testEnv,auth,MemoryStore} from './pilot-fixtures.mjs';

const workspace=await mkdtemp(join(tmpdir(),'cfe-pilot-check-'));
const built=await build(join(workspace,'public'),join(workspace,'netlify/pilot-private'));
const assets=await loadAssets(workspace);
const normalized=validate(sample,assets.meetings,'2026-11-04');
const baseQuote=dues(sample.kind,sample.category,sample.paymentDate);
const validPDF=await completedPDF(normalized,baseQuote,assets);

function fixture(overrides={},store=new MemoryStore()){
  let now=Date.parse('2026-11-04T18:00:00Z');
  const env={...testEnv,...overrides};
  const handler=createHandler({env,store,assets,clock:()=>now,transport:async()=>{throw new Error('Unexpected network call');}});
  let token='',cookie='';
  const request=(path,options={})=>handler(new Request(env.CFE_PILOT_ORIGIN+path,{...options,headers:{Authorization:auth,...options.headers}}),{ip:'192.0.2.1'});
  async function session(){const res=await request('/membership-pilot/api/session');assert.equal(res.status,200);const data=await res.json();token=data.token;cookie=res.headers.get('set-cookie').split(';')[0];now+=3000;return data;}
  const post=(action,body={},headers={})=>request(`/membership-pilot/api/${action}`,{method:'POST',headers:{Origin:env.CFE_PILOT_ORIGIN,'Content-Type':'application/json','X-Membership-Token':token,Cookie:cookie,...headers},body:JSON.stringify(body)});
  return {env,store,handler,request,session,post,advance:ms=>now+=ms,get cookie(){return cookie;}};
}
async function save(f){await f.session();assert.equal((await f.post('review',{application:sample})).status,200);assert.equal((await f.post('download')).status,200);const res=await f.post('submit');assert.equal(res.status,200);return res.json();}

test('authenticated session resumes its review/save without extending expiry; logout and restart revoke it',async()=>{
  const f=fixture(),saved=await save(f);
  let r=await f.request('/membership-pilot/api/session',{headers:{Cookie:f.cookie}});assert.equal(r.status,200);const resumed=await r.json();assert.equal(resumed.resumed,true);assert.equal(resumed.review.saved.id,saved.id);assert.equal(resumed.review.downloaded,true);assert.ok(!('pdf' in resumed.review));
  f.advance(10000);r=await f.request('/membership-pilot/api/session',{headers:{Cookie:f.cookie}});assert.equal((await r.json()).expires,resumed.expires);
  r=await f.post('restart');assert.equal(r.status,200);const fresh=await r.json();assert.notEqual(fresh.sessionID,resumed.sessionID);assert.equal(fresh.review,null);assert.equal(fresh.resumed,false);
  r=await f.post('submit');assert.equal((await r.json()).code,'session_expired');assert.equal((await read(f.store,'submissions/'+saved.id)).data.attempts,0);
  const ended=fixture();await ended.session();r=await ended.post('logout');assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);r=await ended.post('review',{application:sample});assert.equal((await r.json()).code,'session_expired');
});

test('hosted dues and validation match accepted Python rules at every boundary',()=>{
  const cases=[];
  for(const kind of ['new','renewal'])for(const category of ['regular','spouse','junior'])for(const day of ['2026-01-01','2026-03-31','2026-04-01','2026-06-30','2026-07-01','2026-09-30','2026-10-01','2026-12-31'])cases.push([kind,category,day]);
  const py=spawnSync('python',['-B','-c',"import sys,json;sys.path.insert(0,'scripts');import membership as m;from datetime import date;x=json.load(sys.stdin);print(json.dumps({'quotes':[m.dues(k,c,date.fromisoformat(d)) for k,c,d in x['cases']],'data':m.validate(x['sample'])}))"],{input:JSON.stringify({cases,sample}),encoding:'utf8'});
  assert.equal(py.status,0,py.stderr);const result=JSON.parse(py.stdout);
  assert.deepEqual(cases.map(args=>dues(...args)),result.quotes);assert.deepEqual(normalized,result.data);
  for(const change of [{phone:'123'},{email:'real@gmail.com'},{to:'someone@example.com'},{meetingDate:'2026-11-14'},{paymentDate:'2026-02-30'},{paymentDate:['2026-11-14']},{category:'junior',dob:''},{name:'A\nB'},{acknowledge:false},{fictional:false}])assert.throws(()=>validate({...sample,...change},assets.meetings,'2026-11-04'));
  assert.equal(validate({...sample,category:'junior',dob:'2012-02-29'},assets.meetings,'2026-11-04').dob,'2012-02-29');
});
test('capitalization, date-only values, phone formatting, escaping and meeting wording',()=>{
  for(const value of ['0120340056','012 034 0056','(012) 034-0056','012.034.0056','012–034—0056'])assert.equal(phone(value),'(012) 034-0056');
  assert.equal(phone(' '),'');assert.throws(()=>phone('1 202 555 0142'));assert.throws(()=>phone('202CALL0142'));
  assert.equal(displayDate('2026-11-14'),'Nov 14, 2026');assert.equal(displayDate('2028-02-29'),'Feb 29, 2028');assert.throws(()=>displayDate('2026-02-29'));
  const message=notification({...normalized,name:'<script>"&\' Fictional'},baseQuote,assets.template);
  assert.ok(message.html.includes('&lt;script&gt;&quot;&amp;&#x27; Fictional'));assert.ok(!message.html.includes('<script>'));
  for(const text of [message.html,message.text])for(const value of ['New','Regular','Nov 14, 2026','(202) 555-0142','the selected club meeting','FICTIONAL TEST','Submission does not confirm payment or membership approval'])assert.ok(text.includes(value),value);
  assert.ok(notification({...normalized,kind:'renewal'},baseQuote,assets.template).text.includes('A membership renewal has been submitted.'));
  assert.equal(assets.meetings.confirmedDates.length,12);
});
test('allowlisted build excludes secrets, completed applications and pilot page; public assets preserved',async()=>{
  async function walk(folder,prefix=''){const names=[];for(const entry of await readdir(folder,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())names.push(...await walk(join(folder,entry.name),name+'/'));else names.push(name);}return names;}
  const files=await walk(built.output);
  assert.ok(!files.some(p=>/env|sqlite|pilot|templates|scripts|README|package|\.py$/.test(p)));
  const publicMember=await readFile(join(built.output,'membership.html'),'utf8');assert.ok(!publicMember.includes('id="membership-form"'));assert.ok(!publicMember.includes('src="js/membership.js"'));
  assert.match(assets.page,/data-api-base="\/membership-pilot\/api"/);assert.match(assets.page,/Restricted pilot test/);
  for(const file of files.filter(p=>p.startsWith('documents/')).concat(['weather_final.html','js/status_final.js']))assert.deepEqual(await readFile(join(built.output,file)),await readFile(file));
  assert.equal(files.filter(p=>p.startsWith('documents/')).length,4);
  assert.deepEqual(config.path,['/membership-pilot','/membership-pilot/*']);
});
test('password protects page, all APIs and direct function alias; disabled and malformed storage fail closed',async()=>{
  const f=fixture();
  for(const path of ['/membership-pilot','/membership-pilot/api/session','/membership-pilot/api/review','/membership-pilot/api/download','/membership-pilot/api/submit','/membership-pilot/api/send','/.netlify/functions/membership-pilot','/.netlify/functions/membership-pilot/api/download']){
    const res=await f.request(path,{headers:{Authorization:''}});assert.equal(res.status,401,path);assert.match(res.headers.get('www-authenticate'),/^Basic/);assert.match(res.headers.get('cache-control'),/no-store/);
  }
  assert.equal((await f.request('/membership-pilot')).status,200);assert.equal((await f.request('/.netlify/functions/membership-pilot')).status,200);
  assert.equal((await fixture({CFE_PILOT_ENABLED:'false'}).request('/membership-pilot')).status,404);
  const broken=new MemoryStore();await broken.setJSON('test',{ok:true});broken.entries.get('test').etag=undefined;await assert.rejects(()=>read(broken,'test'),/concurrency/);
});
test('CSRF, same-origin, spam controls, size, expiry and errors preserve session safety',async()=>{
  const f=fixture();await f.session();
  for(const headers of [{Origin:'https://attacker.example'},{Cookie:''},{'X-Membership-Token':'wrong'},{'Content-Type':'text/plain'}])assert.ok([400,403].includes((await f.post('review',{application:sample},headers)).status));
  assert.equal((await f.post('review',{application:sample,website:'bot'})).status,400);
  assert.equal((await f.post('review',{application:{...sample,phone:'123'}})).status,400);
  assert.equal((await f.post('review',{application:sample,large:'x'.repeat(13000)})).status,413);
  assert.equal((await f.post('download')).status,400);assert.equal((await f.post('submit')).status,400);
  assert.equal((await f.request('/membership-pilot/api/download')).status,405);
  f.advance(3600001);assert.equal((await f.post('review',{application:sample})).status,400);
  const immediate=fixture();await immediate.session();immediate.advance(-3000);assert.equal((await immediate.post('review',{application:sample})).status,400);
});
test('review/edit resets PDF check; submissions save privately, deduplicate and never send',async()=>{
  const f=fixture();await f.session();assert.equal((await f.post('review',{application:sample})).status,200);
  assert.equal((await f.post('submit')).status,400);const download=await f.post('download');assert.equal(download.headers.get('content-type'),'application/pdf');assert.match(Buffer.from(await download.arrayBuffer()).toString('ascii',0,8),/^%PDF/);
  assert.equal((await f.post('review',{application:{...sample,name:'Edited Fictional Pilot'}})).status,200);assert.equal((await f.post('submit')).status,400);
  await f.post('download');const saved=await (await f.post('submit')).json();assert.equal(saved.status,'held');assert.equal(saved.duplicate,false);
  const duplicate=await (await f.post('submit')).json();assert.equal(duplicate.id,saved.id);assert.equal(duplicate.duplicate,true);
  const stored=await read(f.store,'submissions/'+saved.id);assert.equal(stored.data.attempts,0);assert.equal(stored.data.data.name,'Edited Fictional Pilot');assert.ok(stored.data.pdf);assert.ok(stored.data.message.html);assert.ok(stored.data.message.text);
  assert.equal((await f.post('send',{id:saved.id})).status,403);
});
test('private disk Blobs SDK survives restart and supports conditional writes (local ETag shim)',async()=>{
  const directory=join(workspace,'blobs');let instance=await localBlobs(directory);
  const f=fixture({},instance.store);const saved=await save(f);await instance.server.stop();
  instance=await localBlobs(directory);
  try{
    const stored=await read(instance.store,'submissions/'+saved.id);assert.equal(stored.data.status,'held');assert.ok(stored.data.pdf);
    assert.equal((await instance.store.setJSON('submissions/'+saved.id,{bad:true},{onlyIfNew:true})).modified,false);
    assert.equal((await instance.store.setJSON('submissions/'+saved.id,{bad:true},{onlyIfMatch:'"wrong"'})).modified,false);
    assert.equal((await instance.store.setJSON('submissions/'+saved.id,stored.data,{onlyIfMatch:stored.etag})).modified,true);
  }finally{await instance.server.stop();}
});
test('one-shot mail enforces George, exact authorization and matching attachment; concurrency prevents duplicate',async()=>{
  const f=fixture(),saved=await save(f);let calls=0,payload,headers;
  const transport=async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');payload=JSON.parse(options.body);headers=options.headers;return new Response(JSON.stringify({id:'fictional-provider-id'}),{status:200});};
  await assert.rejects(()=>sendOnce(f.store,saved.id,f.env,transport));assert.equal(calls,0);
  const env={...f.env,MEMBERSHIP_EMAIL_ENABLED:'true',CFE_PILOT_RESEND_API_KEY:'fictional-secret',CFE_PILOT_SEND_REFERENCE:saved.id};
  await assert.rejects(()=>sendOnce(f.store,saved.id,{...env,CFE_PILOT_SEND_REFERENCE:'wrong'},transport));assert.equal(calls,0);
  const results=await Promise.allSettled([sendOnce(f.store,saved.id,env,transport),sendOnce(f.store,saved.id,env,transport)]);
  assert.equal(calls,1);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.deepEqual(payload.to,[TO]);assert.equal(TO,'mg.farris@comcast.net');assert.equal(payload.from,FROM);assert.equal(FROM,'membership@converseflyingeagles.org');assert.ok(!('cc'in payload));assert.ok(!('bcc'in payload));assert.ok(!('reply_to'in payload));
  assert.equal(payload.attachments[0].content,(await read(f.store,'submissions/'+saved.id)).data.pdf);assert.match(headers['Idempotency-Key'],new RegExp(saved.id+'$'));
  assert.equal((await read(f.store,'submissions/'+saved.id)).data.providerId,'fictional-provider-id');await assert.rejects(()=>sendOnce(f.store,saved.id,env,transport));assert.equal(calls,1);
});
test('provider and connection errors are redacted, persisted and never retried; pre-save failure sends nothing',async()=>{
  for(const runtime of [false,true]){
    const f=fixture(),saved=await save(f);let calls=0;
    const env={...f.env,MEMBERSHIP_EMAIL_ENABLED:'true',CFE_PILOT_RESEND_API_KEY:'fictional-secret',CFE_PILOT_SEND_REFERENCE:saved.id};
    const transport=async()=>{calls++;if(runtime)throw new TypeError('connection failed Bearer fictional-secret');return new Response(JSON.stringify({name:'validation_error',message:'bad fictional-secret'}),{status:422});};
    const result=await sendOnce(f.store,saved.id,env,transport);assert.equal(result.status,'failed');assert.equal(result.http_status,runtime?null:422);assert.ok(!JSON.stringify(result).includes('fictional-secret'));
    await assert.rejects(()=>sendOnce(f.store,saved.id,env,transport));assert.equal(calls,1);assert.equal((await read(f.store,'submissions/'+saved.id)).data.attempts,1);
  }
  const f=fixture();await f.session();await f.post('review',{application:sample});await f.post('download');const original=f.store.setJSON.bind(f.store);f.store.setJSON=async(key,...args)=>{if(key.startsWith('submissions/'))throw new Error('disk failure');return original(key,...args);};assert.equal((await f.post('submit')).status,503);
});
test('long entries produce a complete original-background PDF with all review text and pending signatures',async()=>{
  const data=validate({...sample,name:'Alexandria '.repeat(9).trim(),ama:'W'.repeat(24),address:'Fictional Boulevard '.repeat(7).trim(),city:'Long Fictional Town '.repeat(3).trim(),email:'very.long.fictional.applicant.address.for.testing@example.com',category:'junior',dob:'2012-02-29'},assets.meetings,'2026-11-04');
  const pdf=await completedPDF(data,dues(data.kind,data.category,data.paymentDate),assets);
  const py=spawnSync('python',['-B','-c',"import sys,fitz;d=fitz.open(stream=sys.stdin.buffer.read(),filetype='pdf');assert len(d)>=2;t=''.join(p.get_text() for p in d);assert 'Pending Board confirmation' not in t;assert 'officer verifies AMA membership, then applicant signs above.' in t;assert 'Nov 14, 2026' in t;assert 'Feb 29, 2012' in t;assert 'Junior' in t;assert 'APPLICATION' in t.upper();assert 'W'*24 in t;spans=[s for b in d[0].get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans'] if s['text']=='See review page'];assert spans and all(s['size']>=8 for s in spans);print(len(d))"],{input:pdf,encoding:null});assert.equal(py.status,0,py.stderr?.toString());
  assert.ok(validPDF.length>10000);
});
