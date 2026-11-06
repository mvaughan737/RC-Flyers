import {getStore} from '@netlify/blobs';
import {loadAssets as loadSharedAssets} from './membership-pilot.mjs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createProductionHandler,STORE_NAME} from '../production/service.mjs';
let cachedAssets;
export async function loadProductionAssets(root=process.cwd()){
  const assets=await loadSharedAssets(root);
  return {...assets,page:await readFile(join(root,'netlify/production-private/production.html'),'utf8')};
}
export default async function handler(request,context){
  if(process.env.CFE_PRODUCTION_ENABLED!=='true')return new Response('Application unavailable.',{status:404,headers:{'Cache-Control':'no-store'}});
  try{
    cachedAssets??=loadProductionAssets();
    return await createProductionHandler({env:process.env,store:getStore({name:STORE_NAME,consistency:'strong'}),assets:await cachedAssets})(request,context);
  }catch{return new Response('Application temporarily unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const config={path:['/membership-production','/membership-production/*']};
