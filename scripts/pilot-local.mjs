// Loopback-only hosted-code rehearsal. Never loads .env files or real mail credentials.
import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {build} from './build-netlify.mjs';
import {localBlobs} from './local-blobs.mjs';
import {loadAssets} from '../netlify/functions/membership-pilot.mjs';
import {createHandler} from '../netlify/pilot/service.mjs';
import {testEnv,password} from '../tests/pilot-fixtures.mjs';
const root=resolve(import.meta.dirname,'..');
const privateRoot=resolve(root,'../RC-Flyers-private/netlify-pilot-local');
await mkdir(privateRoot,{recursive:true});await build();
const blobs=await localBlobs(join(privateRoot,'blobs'));
const origin='http://127.0.0.1:4181';
const handler=createHandler({env:{...testEnv,CFE_PILOT_ORIGIN:origin},store:blobs.store,assets:await loadAssets(root),allowLocal:true,
  transport:async()=>{throw new Error('Email transport is disabled in the local rehearsal');}});
const publicRoot=join(root,'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.pdf':'application/pdf','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.txt':'text/plain','.xml':'application/xml'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin);
    if(url.pathname.startsWith('/membership-pilot')||url.pathname.startsWith('/.netlify/functions/membership-pilot')){
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>12000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
      const reply=await handler(request,{ip:'127.0.0.1'});res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const file=resolve(publicRoot,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(publicRoot+sep)||!(await stat(file)).isFile())throw new Error('Not found');
    res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(4181,'127.0.0.1',()=>console.log(`Local rehearsal: ${origin}/membership-pilot | user george | password ${password} | mail disabled`));
async function stop(){server.close();await blobs.server.stop();}
process.on('SIGINT',()=>{stop().finally(()=>process.exit(0));});
process.on('SIGTERM',()=>{stop().finally(()=>process.exit(0));});
