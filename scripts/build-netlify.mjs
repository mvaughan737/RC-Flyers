import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {resolve,join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function build(output=join(ROOT,'dist'),privateDir=join(ROOT,'netlify/pilot-private'),{productionPublic=false}={}){
  output=resolve(output);privateDir=resolve(privateDir);
  if(output===ROOT||privateDir===ROOT||output===privateDir)throw new Error('Use separate publish and private asset directories.');
  const files=new Map();
  for(const name of ['index.html','membership.html','about.html','events.html','gallery.html','weather_final.html','resources.html','location.html','learn-to-fly.html','contact.html','news.html','style.css','membership.css','robots.txt','sitemap.xml','_redirects'])files.set(name,join(ROOT,name));
  async function walk(source,prefix,extensions){
    for(const entry of await readdir(source,{withFileTypes:true})){
      if(entry.name.startsWith('.'))continue;
      if(entry.isSymbolicLink())throw new Error('Symlinks are not allowed in site assets.');
      const path=join(source,entry.name),target=prefix+'/'+entry.name;
      if(entry.isDirectory())await walk(path,target,extensions);
      else if(extensions.has(extname(entry.name).toLowerCase()))files.set(target,path);
    }
  }
  for(const [folder,extensions] of [['js',['.js']],['images',['.png','.jpg','.jpeg','.gif','.svg','.webp']],['data',['.json']],['admin',['.html','.css','.js','.json','.yml','.png','.jpg','.jpeg','.svg']],['documents',['.pdf']]])await walk(join(ROOT,folder),folder,new Set(extensions));
  async function checkExisting(folder,prefix=''){
    let entries;try{entries=await readdir(folder,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
    for(const entry of entries){const name=prefix+entry.name;
      if(entry.isSymbolicLink())throw new Error('Publish directory contains a symlink.');
      if(entry.isDirectory())await checkExisting(join(folder,entry.name),name+'/');
      else if(!files.has(name))throw new Error(`Unexpected file in publish output: ${name}. Choose a clean output; no files deleted.`);
    }
  }
  await checkExisting(output);
  const member=await readFile(join(ROOT,'membership.html'),'utf8');
  const start=member.indexOf('        <section class="membership-section" id="online-application"');
  const end=member.indexOf('        <section class="membership-section" aria-labelledby="membership-information-title">',start);
  if(start<0||end<0)throw new Error('Review the membership form boundaries before building.');
  let page=member.replace('<form id="membership-form"','<form data-api-base="/membership-pilot/api" id="membership-form"')
    .replace('Local test','Restricted pilot test').replace('This prototype saves privately on this computer.','This restricted pilot stores fictional applications privately on the club test service.');
  page=page.replace('js/membership.js','/js/membership.js').replace('js/membership-format.js','/js/membership-format.js')
    .replace('<head>','<head>\n    <base href="/">\n    <meta name="robots" content="noindex,nofollow">');
  page=page.replace('Save local test submission','Save pilot test submission')
    .replace('Connecting to local prototype...','Connecting to restricted pilot...')
    .replace('The local online prototype requires JavaScript.','The restricted pilot requires JavaScript.');
  const productionDir=join(dirname(privateDir),'production-private');
  await mkdir(productionDir,{recursive:true});
  await writeFile(join(productionDir,'production.html'),productionPage(member));
  const publicMember=(member.slice(0,start)+member.slice(end)).replace(/\s*<script src="js\/membership(?:-format)?\.js" defer><\/script>/g,'')
    .replace('<div class="membership-intro-actions">','<p class="application-notice">Online applications are not yet open. Public application submission and membership email sending are disabled.</p>\n                <div class="membership-intro-actions">');
  await mkdir(privateDir,{recursive:true});
  for(const [name,data] of Object.entries({'pilot.html':page,'notification.html':await readFile(join(ROOT,'templates/membership-notification.html')),
    'application.pdf':await readFile(join(ROOT,'documents/Converse Flying Eagles Application (Nov 2026).pdf')),'Vera.ttf':await readFile(join(ROOT,'netlify/pilot-assets/Vera.ttf')),
    'meetings.json':await readFile(join(ROOT,'data/membership-meetings.json')),
    'font-license.txt':await readFile(join(ROOT,'netlify/pilot-assets/bitstream-vera-license.txt'))}))await writeFile(join(privateDir,name),data);
  for(const [name,source] of files){const target=join(output,name);await mkdir(dirname(target),{recursive:true});if(name==='membership.html')await writeFile(target,productionPublic?productionPage(member):publicMember);else await copyFile(source,target);}
  return {output,privateDir,publicFiles:files.size};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await build(undefined,undefined,{productionPublic:process.env.CFE_PRODUCTION_PUBLIC_FORM==='true'})));

export function productionPage(member){
  return member.replace('<form id="membership-form"','<form data-api-base="/membership-production/api" id="membership-form"')
    .replace('Apply or renew online - Local test','Apply or renew online')
    .replace('Fictional applicants only. This prototype saves privately on this computer.','Enter your applicant information. Applications are stored privately for the Membership Secretary.')
    .replace('Email sending is disabled.','Saving stores your application privately. Notification status appears after saving.')
    .replace('is used only for this prototype','keeps your answers in this tab')
    .replace('Connecting to local prototype...','Connecting to application service...')
    .replace("Close the private browser window and PDF tabs afterward to forget the cached pilot password.",'Close this browser window and PDF tabs afterward on a shared computer.')
    .replace('Fictional email<input','Email<input').replace('placeholder="pilot@example.com"','placeholder="you@example.com"')
    .replace('Use example.com, example.org, example.net, or a .example domain. No applicant confirmation email is sent.','Use your own email address so the Membership Secretary can reply directly to you. No applicant confirmation email is sent.')
    .replace(/                    <label class="application-check"><input type="checkbox" name="fictional" required>[^<]*<\/label>/,'')
    .replace('                    <button class="btn btn-gold" type="submit">Review application</button>',`                    <label class="application-wide">Comments for the Membership Secretary<textarea name="comments" maxlength="2000" rows="5" aria-describedby="comments-help comments-count"></textarea></label>
                    <p id="comments-help">Optional. These comments will be included in the email to the Secretary but will not appear on your PDF application.</p>
                    <p id="comments-count" role="status" aria-live="polite">0 / 2,000 characters</p>
                    <button class="btn btn-gold" type="submit">Review application</button>`)
    .replace('Save local test submission','Save application for Secretary')
    .replace('The local online prototype requires JavaScript.','The online application requires JavaScript.')
    .replace('<head>','<head>\n    <base href="/">\n    <meta name="robots" content="noindex,nofollow">');
}
