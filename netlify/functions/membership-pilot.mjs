import {upcomingMeetings} from '../pilot/meetings.mjs';
import {getStore} from '@netlify/blobs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHandler,STORE_NAME} from '../pilot/service.mjs';
let cachedAssets;
export async function loadAssets(root=process.cwd()){
  const folder=join(root,'netlify/pilot-private');
  const [page,template,original,font,schedule]=await Promise.all([
    readFile(join(folder,'pilot.html'),'utf8'),readFile(join(folder,'notification.html'),'utf8'),
    readFile(join(folder,'application.pdf')),readFile(join(folder,'Vera.ttf')),readFile(join(folder,'meetings.json'),'utf8')]);
  return {page,template,original,font,meetings:{...JSON.parse(schedule),...upcomingMeetings()}};
}
export default async function handler(request,context){
  if(process.env.CFE_PILOT_ENABLED!=='true')return new Response('Pilot unavailable.',{status:404,headers:{'Cache-Control':'no-store'}});
  try{
    cachedAssets??=loadAssets();
    return await createHandler({env:process.env,store:getStore({name:STORE_NAME,consistency:'strong'}),assets:await cachedAssets})(request,context);
  }catch{return new Response('Pilot temporarily unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const config={path:['/membership-pilot','/membership-pilot/*']};
