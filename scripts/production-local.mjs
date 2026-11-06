// Loopback-only production review. No environment files, provider keys, or live mail.
import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {build} from './build-netlify.mjs';
import {localBlobs} from './local-blobs.mjs';
import {loadProductionAssets} from '../netlify/functions/membership-production.mjs';
import {createProductionHandler,STORE_NAME} from '../netlify/production/service.mjs';
import {notification,dues} from '../netlify/pilot/domain.mjs';
import {upcomingMeetings} from '../netlify/pilot/meetings.mjs';
import {completedPDF} from '../netlify/pilot/pdf.mjs';
const root=resolve(import.meta.dirname,'..'),origin='http://127.0.0.1:4182';
const privateRoot=resolve(root,'../RC-Flyers-private/board-review-local');
await mkdir(privateRoot,{recursive:true});
await build(); // Public artifact remains downloads-only.
const blobs=await localBlobs(join(privateRoot,'blobs'),STORE_NAME);
const assets=await loadProductionAssets(root);
const handler=createProductionHandler({env:{CFE_PRODUCTION_ENABLED:'true',CFE_PRODUCTION_PUBLIC_SUBMISSIONS_ENABLED:'true',CFE_PRODUCTION_EMAIL_ENABLED:'false',CFE_PRODUCTION_ORIGIN:origin,CFE_PRODUCTION_SECRET:randomBytes(32).toString('hex')},store:blobs.store,assets,allowLocal:true,
  transport:async()=>{throw new Error('Email transport is disabled in local review');}});
const publicRoot=join(root,'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.pdf':'application/pdf','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin);
    if(['/membership-email-preview.html','/membership-email-preview.txt','/membership-pdf-preview.pdf'].includes(url.pathname)&&['GET','HEAD'].includes(req.method)){
      // Fixed fictional details only. No stored applications, mail provider or real credentials.
      const kind=url.searchParams.get('type')==='renewal'?'renewal':'new';
      const category=['regular','spouse','junior'].includes(url.searchParams.get('category'))?url.searchParams.get('category'):'regular';
      const meetingDate=upcomingMeetings().confirmedDates[0];
      const paymentDate=url.searchParams.get('period')==='late'?'2027-04-06':meetingDate;
      const data={kind,category,meetingDate,paymentDate,name:'Alex Fictional Pilot',ama:'TEST-123456',address:'123 Example Lane',city:'Example Town',state:'IN',zip:'46919',phone:'(202) 555-0142',cell:'',email:'fictional.pilot@example.com',dob:category==='junior'?'2012-02-29':'',acknowledge:true,comments:'Fictional review comment. Included in email only.\nSecond line for review.'};
      const quote=dues(kind,category,paymentDate);
      const isPDF=url.pathname.endsWith('.pdf'),isHTML=url.pathname.endsWith('.html');
      const body=isPDF?await completedPDF(data,quote,assets,{production:true}):notification(data,quote,assets.template,{production:true})[isHTML?'html':'text'];
      res.writeHead(200,{'Content-Type':isPDF?'application/pdf':isHTML?'text/html; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store',...(isPDF?{'Content-Disposition':'inline; filename="fictional-membership-review.pdf"'}:{})});res.end(req.method==='HEAD'?undefined:body);return;
    }
    if(url.pathname.startsWith('/membership-production')){
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>12000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
      const reply=await handler(new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),{ip:'127.0.0.1'});
      res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    if(url.pathname==='/.netlify/functions/metar-live'){
      const reply=await fetch('https://converse-flying-eagles.netlify.app/.netlify/functions/metar-live',{signal:AbortSignal.timeout(15000)});
      res.writeHead(reply.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(Buffer.from(await reply.arrayBuffer()));return;
    }
    const file=resolve(publicRoot,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(publicRoot+sep)||!(await stat(file)).isFile())throw new Error('Not found');
    res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{res.writeHead(404);res.end('Unavailable');}
});
server.listen(4182,'127.0.0.1',()=>console.log(`Local Board review: ${origin}/membership-production | mail disabled | fictional review entries only`));
async function stop(){server.close();await blobs.server.stop();}
process.on('SIGINT',()=>{stop().finally(()=>process.exit(0));});
process.on('SIGTERM',()=>{stop().finally(()=>process.exit(0));});
