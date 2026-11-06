// Generate fictional review artifacts outside all public/build directories. No mail transport.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {build} from './build-netlify.mjs';
import {loadAssets} from '../netlify/functions/membership-pilot.mjs';
import {validate,dues,notification} from '../netlify/pilot/domain.mjs';
import {completedPDF} from '../netlify/pilot/pdf.mjs';
import {sample} from '../tests/pilot-fixtures.mjs';
await build();const assets=await loadAssets();
const folder=resolve('../RC-Flyers-private/review/netlify-pilot');await mkdir(folder,{recursive:true});
for(const [name,raw] of Object.entries({regular:sample,junior:{...sample,category:'junior',dob:'2012-02-29'},long:{...sample,name:'Alexandria '.repeat(9).trim(),ama:'W'.repeat(24),address:'Fictional Boulevard '.repeat(7).trim(),city:'Long Fictional Town '.repeat(3).trim(),email:'very.long.fictional.applicant.address.for.testing@example.com'},renewal:{...sample,kind:'renewal',paymentDate:'2026-04-01'}})){
  const data=validate(raw,assets.meetings,'2026-11-04'),quote=dues(data.kind,data.category,data.paymentDate);
  await writeFile(join(folder,`membership-pilot-${name}.pdf`),await completedPDF(data,quote,assets));
  if(name==='regular'){const email=notification(data,quote,assets.template);await writeFile(join(folder,'membership-pilot-email.html'),email.html);await writeFile(join(folder,'membership-pilot-email.txt'),email.text);}
}
console.log(`Fictional PDFs and email previews: ${folder}`);
