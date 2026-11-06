import {HTTPError,read,verifyPassword,createHandler as sharedHandler} from '../pilot/service.mjs';
import {validateApplicantHeader} from '../pilot/domain.mjs';
export const STORE_NAME='cfe-membership-production-v1';
export const ROUTING=Object.freeze({from:'Converse Flying Eagles Membership <membership@converseflyingeagles.org>',to:'jlsouth5963@gmail.com',bcc:'mvaughan737@gmail.com'});
export function productionHeaders(data){return {from:ROUTING.from,to:[ROUTING.to],bcc:[ROUTING.bcc],reply_to:validateApplicantHeader(data)};}
export const CLOSED_PAGE='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Online applications not yet open | Converse Flying Eagles</title><link rel="stylesheet" href="/style.css"></head><body class="membership-page"><main class="membership-content" style="padding:3rem 1.5rem;margin:auto"><h1>Online applications are not yet open</h1><p>Public application submission and membership email sending are disabled. Please use the current membership documents and contact form while online applications are being prepared.</p><p><a href="/membership.html">Membership</a> &middot; <a href="/membership.html#membership-documents">Membership Documents</a> &middot; <a href="/contact.html#contact-form">Contact form</a></p></main></body></html>';
export function createProductionHandler(options){
  const handler=sharedHandler({...options,production:true,onSubmission:async id=>{
    if(options.env.CFE_PRODUCTION_EMAIL_ENABLED==='true')await sendProductionOnce(options.store,id,options.env,options.transport,options.clock);
  }});
  return async(request,context)=>{
    const url=new URL(request.url),operatorPath=url.pathname==='/membership-production/operator';
    const publicEnabled=options.env.CFE_PRODUCTION_PUBLIC_SUBMISSIONS_ENABLED==='true';
    if(!publicEnabled){
      const hash=options.env.CFE_PRODUCTION_OPERATOR_PASSWORD_HASH;
      let authorized=false;
      try{authorized=!!hash&&verifyPassword(request.headers.get('Authorization'),hash,'operator');}catch{}
      if(!authorized){
        const root=['/membership-production','/membership-production/'].includes(url.pathname);
        return new Response(root&&['GET','HEAD'].includes(request.method)?(request.method==='HEAD'?null:CLOSED_PAGE):'Applications are not open.',{status:root&&['GET','HEAD'].includes(request.method)?200:operatorPath?401:404,
          headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow',...(operatorPath?{'WWW-Authenticate':'Basic realm="Membership operator review", charset="UTF-8"'}:{})}});
      }
      // Operator review can never deliver mail, even if a mail switch is misconfigured.
      if(options.env.CFE_PRODUCTION_EMAIL_ENABLED==='true')return new Response('Operator review requires email disabled.',{status:503,headers:{'Cache-Control':'no-store'}});
    }
    if(operatorPath){url.pathname='/membership-production';request=new Request(url,request);}
    return handler(request,context);
  };
}
async function write(store,key,value,etag){
  const result=await store.setJSON(key,value,etag?{onlyIfMatch:etag}:{onlyIfNew:true});
  if(result.modified&&!result.etag)throw new Error('Storage did not confirm the write');
  return result;
}
function redact(text,secrets){
  let value=String(text);for(const key of secrets.filter(Boolean))value=value.split(key).join('[REDACTED]');
  return value.replace(/\bre_[A-Za-z0-9_-]+/g,'[REDACTED]').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').slice(0,1000);
}
export async function sendProductionOnce(store,id,env,transport=fetch,clock=Date.now){
  if(env.CFE_PRODUCTION_EMAIL_ENABLED!=='true'||!env.CFE_PRODUCTION_RESEND_API_KEY)throw new HTTPError(403,'Production sending is disabled or its provider key is missing.');
  const key=`submissions/${id}`,entry=await read(store,key);
  if(!entry)throw new HTTPError(404,'Unknown submission reference.');
  if(entry.data.environment!=='production')throw new HTTPError(403,'Only production records can use production delivery.');
  if(entry.data.status!=='held'||entry.data.attempts!==0)throw new HTTPError(409,'This submission was already attempted. Reconcile provider status; no retry made.');
  productionHeaders(entry.data.data);
  const record={...entry.data,status:'sending',attempts:1,firstAttempt:clock()};
  const claimed=await write(store,key,record,entry.etag);
  if(!claimed.modified)throw new HTTPError(409,'This submission is already being processed. No duplicate sent.');
  const payload={...productionHeaders(record.data),subject:`Membership application ${id}`,html:record.message.html,text:record.message.text,
    attachments:[{filename:'membership-application.pdf',content:record.pdf}]};
  let status=null,result;
  try{
    const upstream=await transport('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{Authorization:`Bearer ${env.CFE_PRODUCTION_RESEND_API_KEY}`,'Content-Type':'application/json','User-Agent':'RC-Flyers-Membership-Production/1.0',
        'Idempotency-Key':`cfe-production-v1/${id}`},body:JSON.stringify(payload)});
    status=upstream.status;const raw=await upstream.text();let data;try{data=JSON.parse(raw);}catch{data=null;}
    if(!upstream.ok||typeof data?.id!=='string'||!data.id){
      result={status:'failed',error:{http_status:status,response_received:true,code:redact(data?.name??data?.code??'invalid_response',[env.CFE_PRODUCTION_RESEND_API_KEY]),
        message:redact(data?.message??raw,[env.CFE_PRODUCTION_RESEND_API_KEY]),automatic_retry:false,reconciliation_required:true}};
    }else result={status:'accepted',providerId:data.id,error:null};
  }catch(error){result={status:'failed',error:{http_status:status,response_received:status!==null,error_type:error.name,
    message:redact(error.message,[env.CFE_PRODUCTION_RESEND_API_KEY]),automatic_retry:false,reconciliation_required:true}};}
  // The durable 'sending' claim remains if this final write fails; never resend an uncertain request.
  const saved=await write(store,key,{...record,...result,deliveryHTTPStatus:status,completed:clock()},claimed.etag);
  if(!saved.modified)throw new HTTPError(503,'Delivery state is uncertain. Do not retry; reconcile with Resend.');
  return {id,status:result.status,http_status:status,messageId:result.providerId??null,error:result.error,
    recipient:ROUTING.to,attachment:'membership-application.pdf',inboxDelivery:'Not verified',automaticRetry:false};
}
