import {upcomingMeetings} from './meetings.mjs';
import {createHash,createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {Invalid,validate,dues,notification,FROM,TO} from './domain.mjs';
import {completedPDF} from './pdf.mjs';
export const STORE_NAME='cfe-membership-pilot-v1';
const COOKIE='cfe_pilot_session';
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value,Object.keys(value).sort());
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export class HTTPError extends Error {constructor(status,message,code){super(message);this.status=status;this.code=code;}}
export async function read(store,key){
  const result=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
  if(result&&!result.etag)throw new Error('Storage did not provide a concurrency token');
  return result;
}
async function write(store,key,value,etag){
  const result=await store.setJSON(key,value,etag?{onlyIfMatch:etag}:{onlyIfNew:true});
  if(result.modified&&!result.etag)throw new Error('Storage did not confirm the write');
  return result;
}
async function rate(store,bucket,limit,now){
  const key=`limits/${Math.floor(now/60000)}/${hash(bucket)}`;
  for(let i=0;i<12;i++){
    const entry=await read(store,key),count=entry?.data.count??0;
    if(count>=limit)throw new HTTPError(429,'Too many requests. Wait one minute and try again.');
    if((await write(store,key,{count:count+1,created:now},entry?.etag)).modified)return;
  }
  throw new HTTPError(409,'Another request is in progress. Wait a moment and try again.');
}
export function verifyPassword(header,encoded,username='george'){
  if(!header||header.length>1024||!header.startsWith('Basic '))return false;
  const decoded=Buffer.from(header.slice(6),'base64').toString('utf8');
  const colon=decoded.indexOf(':');
  if(colon<0||decoded.slice(0,colon)!==username)return false;
  const parts=encoded.split('$');
  if(parts.length!==3||parts[0]!=='scrypt-v1'||!/^[a-f0-9]{32}$/.test(parts[1])||!/^[a-f0-9]{64}$/.test(parts[2]))throw new Error('Pilot password configuration invalid');
  const derived=scryptSync(decoded.slice(colon+1),Buffer.from(parts[1],'hex'),32,{N:32768,r:8,p:1,maxmem:128*1024*1024});
  return equal(derived.toString('hex'),parts[2]);
}
function response(status,value,extra={}){
  const body=Buffer.isBuffer(value)?value:typeof value==='string'?value:JSON.stringify(value);
  return new Response(body,{status,headers:{'Content-Type':Buffer.isBuffer(value)?'application/pdf':typeof value==='string'?'text/html; charset=utf-8':'application/json',
    'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',...extra}});
}
function redact(text,secrets){
  let value=String(text);for(const key of secrets.filter(Boolean))value=value.split(key).join('[REDACTED]');
  return value.replace(/\bre_[A-Za-z0-9_-]+/g,'[REDACTED]').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').slice(0,1000);
}
export async function sendOnce(store,id,env,transport=fetch,clock=Date.now){
  if(env.MEMBERSHIP_EMAIL_ENABLED!=='true'||!env.CFE_PILOT_RESEND_API_KEY||env.CFE_PILOT_SEND_REFERENCE!==id)throw new HTTPError(403,'Sending is disabled or this specific test has not been authorized.');
  const key=`submissions/${id}`,entry=await read(store,key);
  if(!entry)throw new HTTPError(404,'Unknown test reference.');
  if(entry.data.status!=='held'||entry.data.attempts!==0)throw new HTTPError(409,'This test was already attempted. Reconcile provider status; no retry made.');
  const record={...entry.data,status:'sending',attempts:1,firstAttempt:clock()};
  const claimed=await write(store,key,record,entry.etag);
  if(!claimed.modified)throw new HTTPError(409,'This test is already being processed. No duplicate sent.');
  const payload={from:FROM,to:[TO],subject:`FICTIONAL TEST - membership pilot ${id}`,html:record.message.html,text:record.message.text,
    attachments:[{filename:'membership-test.pdf',content:record.pdf}]};
  let status=null,result;
  try{
    const upstream=await transport('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{Authorization:`Bearer ${env.CFE_PILOT_RESEND_API_KEY}`,'Content-Type':'application/json','User-Agent':'RC-Flyers-Membership-Pilot/1.0',
        'Idempotency-Key':`cfe-pilot-v1/${id}`},body:JSON.stringify(payload)});
    status=upstream.status;const raw=await upstream.text();let data;try{data=JSON.parse(raw);}catch{data=null;}
    if(!upstream.ok||typeof data?.id!=='string'||!data.id){
      result={status:'failed',error:{http_status:status,response_received:true,code:redact(data?.name??data?.code??'invalid_response',[env.CFE_PILOT_RESEND_API_KEY]),
        message:redact(data?.message??raw,[env.CFE_PILOT_RESEND_API_KEY]),automatic_retry:false,reconciliation_required:true}};
    }else result={status:'accepted',providerId:data.id,error:null};
  }catch(error){result={status:'failed',error:{http_status:status,response_received:status!==null,error_type:error.name,
    message:redact(error.message,[env.CFE_PILOT_RESEND_API_KEY]),automatic_retry:false,reconciliation_required:true}};}
  // The durable 'sending' claim remains if this final write fails; never resend an uncertain request.
  const saved=await write(store,key,{...record,...result,deliveryHTTPStatus:status,completed:clock()},claimed.etag);
  if(!saved.modified)throw new HTTPError(503,'Delivery state is uncertain. Do not retry; reconcile with Resend.');
  return {id,status:result.status,http_status:status,messageId:result.providerId??null,error:result.error,
    recipient:TO,attachment:'membership-test.pdf',inboxDelivery:'Not verified',automaticRetry:false};
}
export function createHandler({env,store,assets,clock=Date.now,transport=fetch,allowLocal=false,production=false,onSubmission}){
  const prefix=production?'/membership-production':'/membership-pilot';
  const cookieName=production?'cfe_production_session':COOKIE;
  const setting=key=>env[(production?'CFE_PRODUCTION_':'CFE_PILOT_')+key];
  return async function handler(request,context={}){
    try{
      if(setting('ENABLED')!=='true')return response(404,{error:production?'Application unavailable.':'Pilot unavailable.'});
      const origin=setting('ORIGIN');
      if(!origin||new URL(origin).origin!==origin||(!origin.startsWith('https://')&&!(allowLocal&&/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)))||
        (!production&&!env.CFE_PILOT_PASSWORD_HASH)||!setting('SECRET')||setting('SECRET').length<32)throw new Error('Pilot configuration incomplete');
      const url=new URL(request.url);
      if(url.origin!==origin)throw new HTTPError(403,'Use the approved pilot HTTPS address.');
      await rate(store,`all:${context.ip??'shared'}`,100,clock());
      if(!production&&!verifyPassword(request.headers.get('Authorization'),env.CFE_PILOT_PASSWORD_HASH))return response(401,{error:'Protected fictional membership pilot.'},{'WWW-Authenticate':'Basic realm="Flying Eagles membership pilot", charset="UTF-8"'});
      const path=url.pathname.replace(new RegExp('^/\\.netlify/functions'+prefix+'(?=/|$)'),prefix);
      if((path===prefix||path===prefix+'/')&&['GET','HEAD'].includes(request.method))return response(200,request.method==='HEAD'?'':assets.page);
      const match=new RegExp('^'+prefix+'/api/(session|review|download|submit|send|restart|logout)$').exec(path);
      if(!match)throw new HTTPError(404,'Not found.');
      const action=match[1];
      const cookie=(request.headers.get('Cookie')??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${cookieName}=`))?.slice(cookieName.length+1)??'';
      function sessionResponse(token,state,resumed){
        return response(200,{token,sessionID:hash(token),expires:state.expires,resumed,sendingEnabled:production&&env.CFE_PRODUCTION_EMAIL_ENABLED==='true',meetings:upcomingMeetings(clock()),
          review:state.review?{application:state.review.data,quote:state.review.quote,downloaded:state.downloaded,saved:state.submitted??null}:null},
          {'Set-Cookie':`${cookieName}=${token}; Path=${prefix}; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,Math.ceil((state.expires-clock())/1000))}${allowLocal?'':'; Secure'}`});
      }
      async function newSession(){
        const token=randomBytes(32).toString('base64url');
        const state={created:clock(),expires:clock()+3600000,review:null,downloaded:false};
        if(!(await write(store,`sessions/${hash(token)}`,state)).modified)throw new Error('Session collision');
        return sessionResponse(token,state,false);
      }
      if(action==='session'&&request.method==='GET'){
        if(cookie&&/^[A-Za-z0-9_-]{43}$/.test(cookie)){
          const existing=await read(store,`sessions/${hash(cookie)}`);
          if(existing&&existing.data.expires>clock())return sessionResponse(cookie,existing.data,true);
        }
        await rate(store,'sessions',20,clock());
        return newSession();
      }
      if(request.method!=='POST')throw new HTTPError(405,'Use the supported request method.');
      if(request.headers.get('Origin')!==origin)throw new HTTPError(403,'Same-origin pilot request required.');
      const token=request.headers.get('X-Membership-Token')??'';
      if(!token||!equal(token,cookie))throw new HTTPError(403,'The secure application session ended. Start a new application.','session_expired');
      const key=`sessions/${hash(token)}`,entry=await read(store,key);
      if(!entry||entry.data.expires<=clock())throw new HTTPError(400,'Session expired. Start a new application session.','session_expired');
      await rate(store,`api:${hash(token)}`,30,clock());
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new HTTPError(400,'Send a JSON application.');
      const raw=await request.text();
      if(Buffer.byteLength(raw)>12000)throw new HTTPError(413,'Application is too large (maximum 12 KB).');
      let body;try{body=JSON.parse(raw);}catch{throw new HTTPError(400,'Invalid JSON request.');}
      if(!body||Array.isArray(body)||typeof body!=='object'||body.website)throw new HTTPError(400,'Leave the hidden website field blank.');
      if(action==='logout'||action==='restart'){
        if(!(await write(store,key,{...entry.data,expires:clock(),review:null,downloaded:false,submitted:null},entry.etag)).modified)throw new HTTPError(409,'Another tab changed this session. Try again.');
        if(action==='restart')return newSession();
        return response(200,{ended:true},{'Set-Cookie':`${cookieName}=; Path=${prefix}; HttpOnly; SameSite=Strict; Max-Age=0${allowLocal?'':'; Secure'}`});
      }
      if(clock()-entry.data.created<2000)throw new HTTPError(400,'Wait a moment before reviewing your application.');
      if(action==='send'){
        if(production)throw new HTTPError(403,'Production sending is disabled.');
        if(!env.CFE_PILOT_OPERATOR_TOKEN||env.CFE_PILOT_OPERATOR_TOKEN.length<32||!equal(request.headers.get('X-Pilot-Operator')??'',env.CFE_PILOT_OPERATOR_TOKEN))throw new HTTPError(403,'Operator authorization required.');
        if(typeof body.id!=='string'||!/^[a-f0-9]{64}$/.test(body.id))throw new HTTPError(400,'Choose a valid test reference.');
        return response(200,await sendOnce(store,body.id,env,transport,clock));
      }
      const state=entry.data;
      async function sessionUpdate(next){if(!(await write(store,key,next,entry.etag)).modified)throw new HTTPError(409,'Another tab changed this application. Review again before continuing.');}
      if(action==='review'){
        const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Indiana/Indianapolis',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(clock()));
        const data=validate(body.application,upcomingMeetings(clock()),today,{production}),quote=dues(data.kind,data.category,data.paymentDate);
        const pdf=await completedPDF(data,quote,assets,{production});
        await sessionUpdate({...state,review:{data,quote,pdf:pdf.toString('base64')},downloaded:false,submitted:null});
        return response(200,{application:data,quote});
      }
      if(!state.review)throw new HTTPError(400,'Review the application first.');
      if(action==='download'){
        await sessionUpdate({...state,downloaded:true});
        return response(200,Buffer.from(state.review.pdf,'base64'),{'Content-Disposition':'attachment; filename="membership-application.pdf"'});
      }
      if(!state.downloaded)throw new HTTPError(400,'Download and check the current PDF before saving.');
      const {data,quote,pdf}=state.review;
      const id=createHmac('sha256',setting('SECRET')).update(canonical(data)).digest('hex');
      const record={...(production?{environment:'production'}:{}),id,data,quote,pdf,message:notification(data,quote,assets.template,{production}),status:'held',attempts:0,providerId:null,error:null,created:clock()};
      const result=await write(store,`submissions/${id}`,record);
      if(production&&result.modified&&onSubmission)await onSubmission(id);
      const stored=await read(store,`submissions/${id}`);
      if(!stored)throw new Error('Private save could not be confirmed');
      await sessionUpdate({...state,submitted:{id,status:stored.data.status}});
      return response(200,{id,status:stored.data.status,duplicate:!result.modified});
    }catch(error){
      if(error instanceof Invalid||error instanceof HTTPError)return response(error.status??400,{error:error.message,...(error.code?{code:error.code}:{})});
      return response(503,{error:'The application could not be processed or saved. Your form is still available; contact the club before retrying a delivery.'});
    }
  };
}
