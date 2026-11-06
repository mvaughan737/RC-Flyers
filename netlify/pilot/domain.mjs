import formatting from '../../js/membership-format.js';
// Hosted counterpart of scripts/membership.py. ISO dates and lowercase categories remain internal.
export class Invalid extends Error {}
export const TO = 'mg.farris@comcast.net';
export const FROM = 'membership@converseflyingeagles.org';
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const LIMITS = {name:100,ama:24,address:140,city:70,state:2,zip:10,phone:80,cell:80,email:160,dob:10};
export function dateParts(value) {
  if(typeof value!=='string')throw new Invalid('Use a valid date.');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) throw new Invalid('Use a valid date.');
  const [,y,m,d] = match.map(Number);
  const days = [31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  if (y<1 || !days[m-1] || d<1 || d>days[m-1]) throw new Invalid('Use a valid date.');
  return {y,m,d};
}
export function displayDate(value) {
  if (!value) return '';
  const {y,m,d}=dateParts(value); return `${MONTHS[m-1]} ${d}, ${y}`;
}
export const cap = value => value[0].toUpperCase()+value.slice(1);
export function phone(value, label='Phone') {
  if (!value.trim()) return '';
  const digits=value.replace(/[^0-9]/g,'');
  if (!/^[0-9\s\p{P}+]+$/u.test(value) || digits.length!==10) throw new Invalid(`${label}: enter exactly 10 digits; spaces and punctuation are allowed.`);
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}
export function validate(raw, meetings, today, {production=false}={}) {
  const allowed=new Set([...Object.keys(LIMITS),'kind','category','paymentDate','meetingDate','acknowledge',...(production?['comments']:['fictional'])]);
  if (!raw || Array.isArray(raw) || typeof raw!=='object' || Object.keys(raw).some(k=>!allowed.has(k))) throw new Invalid('Unexpected application fields.');
  const data={};
  for (const [key,max] of Object.entries(LIMITS)) {
    let value=raw[key]??'';
    if (typeof value!=='string' || [...value].length>max) throw new Invalid(`Check ${key}: maximum ${max} characters.`);
    if (key==='phone'||key==='cell') value=phone(value,key==='cell'?'Cell':'Phone');
    if (/[\x00-\x1f\x7f]/.test(value)) throw new Invalid(`Check ${key}: invalid characters.`);
    data[key]=value.trim();
  }
  for (const k of ['name','ama','address','city','state','zip','email']) if (!data[k]) throw new Invalid(`${k} is required.`);
  for (const [key,values] of [['kind',['new','renewal']],['category',['regular','spouse','junior']]]) {
    if (!values.includes(raw[key])) throw new Invalid(`Choose a valid ${key}.`); data[key]=raw[key];
  }
  if (raw.acknowledge!==true||(!production&&raw.fictional!==true)) throw new Invalid(production?'Confirm document review. This is not a signature.':'Confirm review and fictional test data. This is not a signature.');
  data.acknowledge=true;
  if(!production)data.fictional=true;
  else {
    const comments=raw.comments??'';
    if(typeof comments!=='string'||comments.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(comments))throw new Invalid('Comments must be at most 2,000 characters, with ordinary text and line breaks.');
    data.comments=comments.replace(/\r\n?/g,'\n');
  }
  if (!production&&!/^[^\s@]+@(?:example\.(?:com|org|net)|[a-z0-9.-]+\.example)$/i.test(data.email)) throw new Invalid('Use a fictional email at example.com, example.org, example.net, or a .example domain.');
  if(production)validateApplicantHeader(data);
  if (!/^[A-Za-z]{2}$/.test(data.state)||!/^\d{5}(?:-\d{4})?$/.test(data.zip)) throw new Invalid('Use a two-letter state and a US ZIP code.');
  data.state=data.state.toUpperCase();
  if (!data.phone&&!data.cell) throw new Invalid('Provide a phone or cell number.');
  const received=dateParts(raw.paymentDate);
  if (received.y<2026||received.y>2030) throw new Invalid('Check expected payment date (2026-2030).');
  data.paymentDate=raw.paymentDate;
  if (data.dob) {
    dateParts(data.dob);
    if (data.dob<'1900-01-01'||data.dob>today) throw new Invalid('Check date of birth.');
  } else if (data.category==='junior') throw new Invalid('Date of birth is required for junior membership.');
  if (data.category==='junior'&&data.dob<=`${received.y-19}-03-31`) throw new Invalid('Junior members must be younger than 19 as of March 31 of the application year.');
  data.meetingDate=raw.meetingDate??'';
  if (typeof data.meetingDate!=='string'||(data.kind==='new'&&!data.meetingDate)||(data.meetingDate&&!meetings.confirmedDates.includes(data.meetingDate))) throw new Invalid('Select an upcoming first-Tuesday club meeting. New members must select a meeting.');
  return data;
}
export function dues(kind,category,received) {
  const {y,m}=dateParts(received);
  const following=category==='regular'&&m>=10;
  const membershipYear=y+(following?1:0);
  const base=category==='spouse'?5:category==='junior'?0:kind==='new'&&m>=7&&m<=9?75:100;
  // October-December Regular payments buy next year's membership, with no added fee.
  const lateFee=kind==='renewal'&&m>=4&&!following?20:0;
  return {amount:base+lateFee,expiry:`${membershipYear}-12-31`,membershipYear,reason:'',lateFee,
    note:'Based on expected payment receipt. Submission does not establish payment, approval, or active membership.'};
}
export function displayFields(data) {
  const labels={name:'Full name',ama:'AMA number',address:'Address',city:'City',state:'State',zip:'ZIP',phone:'Phone',cell:'Cell',email:'Email',dob:'Date of Birth'};
  return [['Application',cap(data.kind)],['Category',cap(data.category)],...Object.keys(LIMITS).map(k=>[labels[k],k==='dob'?displayDate(data[k]):data[k]]),['Expected Payment Receipt',displayDate(data.paymentDate)]];
}
export const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[c]));
export function notification(data,quote,template,{production=false}={}) {
  const sentence=data.kind==='renewal'?'A membership renewal has been submitted.':'A new membership application has been submitted.';
  let instruction=data.meetingDate?`Print the attached application and bring it to the selected club meeting: ${formatting.meeting(data.meetingDate)}.`:'Renewal by mail: no meeting selected. Print the attached application for review.';
  instruction+=' An officer verifies AMA membership, then the applicant signs the printed application at the meeting.';
  let amount=quote.amount===null?quote.reason:`$${quote.amount}`;
  if(quote.lateFee) amount+=` (includes $${quote.lateFee} late fee)`;
  const rows=[['Application',cap(data.kind)],['Category',cap(data.category)],['Selected meeting date',data.meetingDate?formatting.meeting(data.meetingDate):'Renewal by mail - no meeting selected'],
    ['Full name',data.name],['AMA number',data.ama],['Address',`${data.address}, ${data.city}, ${data.state} ${data.zip}`],['Phone',data.phone||'(not provided)'],['Cell',data.cell||'(not provided)'],['Email',data.email]];
  if(data.dob) rows.push(['Date of Birth',displayDate(data.dob)]);
  rows.push(['Expected Payment Receipt',displayDate(data.paymentDate)],['Estimated dues',amount],['Membership year',String(quote.membershipYear)],['Estimated Expiry',displayDate(quote.expiry)]);
  const notice=production?'Application submitted for review. Payment, officer AMA verification, printed signatures and membership votes remain separate steps.':'FICTIONAL TEST - applicant details are for testing only.';
  const table=rows.map(([k,v])=>`<tr><th scope="row" class="detail-label" style="width:35%;padding:12px 10px 12px 0;text-align:left;vertical-align:top;border-bottom:1px solid #e2e6ed;color:#34445d;font-weight:600;overflow-wrap:anywhere;word-break:break-word;">${escapeHTML(k)}</th><td class="detail-value" style="width:65%;padding:12px 0 12px 10px;vertical-align:top;border-bottom:1px solid #e2e6ed;color:#202b3c;overflow-wrap:anywhere;word-break:break-word;">${escapeHTML(v)}</td></tr>`).join('');
  const values={test_notice:escapeHTML(notice),submission_sentence:escapeHTML(sentence),meeting_instruction:escapeHTML(instruction),rows:table};
  let html=template.replace(/\$(test_notice|submission_sentence|meeting_instruction|rows)\b/g,(_,key)=>values[key]);
  if(production)html=html.replaceAll('membership-test.pdf','membership-application.pdf');
  const comments=production&&data.comments?.trim()?data.comments:'';
  if(comments)html=html.replace(/(<\/table>\s*)(<p style="margin:24px)/,(_,table,next)=>`${table}<h2>Applicant Comments</h2><p style="overflow-wrap:anywhere;">${escapeHTML(comments).replace(/\n/g,'<br>')}</p>\n          ${next}`);
  let text=`${notice}\n\nDear Membership,\n\n${sentence}\n\n${instruction}\n\nApplicant details appear below.\n\n${rows.map(([k,v])=>`${k}: ${v}`).join('\n')}\n\nAttachment: membership-test.pdf\nSubmission does not confirm payment or membership approval. Dues and membership year are based on expected payment receipt. Sign the printed application at the meeting after an officer verifies AMA membership.`;
  if(production)text=text.replaceAll('membership-test.pdf','membership-application.pdf');
  if(comments)text+=`\n\nApplicant Comments\n${comments}`;
  return {html,text};
}

// Strict mailbox syntax keeps applicant input out of structural email headers.
export function validateApplicantHeader(data){
  if(typeof data.name!=='string'||!data.name.trim()||data.name.length>100||/[\x00-\x1f\x7f]/.test(data.name))throw new Invalid('Enter a valid applicant name.');
  if(typeof data.email!=='string'||data.email.length>160||! /^(?=.{1,64}@)[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(data.email))throw new Invalid('Enter a valid applicant email address.');
  return `${JSON.stringify(data.name)} <${data.email}>`;
}
