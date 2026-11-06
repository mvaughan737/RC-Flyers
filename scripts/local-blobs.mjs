import {BlobsServer} from '@netlify/blobs/server';
import {getStore} from '@netlify/blobs';
import {mkdir} from 'node:fs/promises';
import {STORE_NAME} from '../netlify/pilot/service.mjs';

// LOCAL TESTING ONLY: @netlify/blobs 11.1.7's disk emulator omits GET ETag.
// Restore its own ETag calculation so the unchanged function can exercise CAS.
// Production uses Netlify's native strong reads and conditional writes, no shim.
class LocalBlobsServer extends BlobsServer{
  async get(req){
    const res=await super.get(req);
    const parsed=this.parseAPIRequest(req);
    const url=parsed?.url??new URL(req.url,this.address);
    const {dataPath,key}=this.getLocalPaths(url);
    if(res.ok&&key&&dataPath&&!parsed?.useSignedURL){
      res.headers.set('etag',await BlobsServer.generateETag(dataPath));
    }
    return res;
  }
}
export async function localBlobs(directory,storeName=STORE_NAME){
  const token='local-emulator-only';
  const server=new LocalBlobsServer({directory,token,logger:()=>{}});
  await mkdir(directory,{recursive:true});
  // Exercise the SDK's injectable Fetch transport without opening a second port.
  // Serialize emulator requests: its disk CAS is otherwise not atomic across overlapping calls.
  const address='http://127.0.0.1:0';server.address=address;let pending=Promise.resolve();
  const transport=(url,options)=>{
    const result=pending.then(()=>server.handleRequest(new Request(url,options)));
    pending=result.catch(()=>{});return result;
  };
  const store=getStore({name:storeName,siteID:'local-fictional-pilot',edgeURL:address,uncachedEdgeURL:address,token,consistency:'strong',fetch:transport});
  return {server,store};
}
