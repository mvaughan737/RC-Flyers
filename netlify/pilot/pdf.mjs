import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {Invalid,displayDate,displayFields,cap} from './domain.mjs';

export async function completedPDF(data,quote,assets,{production=false}={}) {
  const doc=await PDFDocument.load(assets.original);
  doc.registerFontkit(fontkit);
  const font=await doc.embedFont(assets.font,{subset:true});
  const supported=new Set(font.getCharacterSet());
  for(const text of Object.entries(data).filter(([key,v])=>key!=='comments'&&typeof v==='string').map(([,v])=>v)) {
    if([...text].some(c=>!supported.has(c.codePointAt(0)))) throw new Invalid('An entered character cannot be rendered legibly in the application font. Please use a supported spelling for this application.');
  }
  const page=doc.getPages()[0];
  function fit(text,x,top,width,size=10) {
    size=Math.min(size,width/Math.max(font.widthOfTextAtSize(text,1),1));
    if(size<8){text=width<180?'See review page':'See full answer on attached review page';size=Math.min(9,width/font.widthOfTextAtSize(text,1));}
    page.drawText(text,{x,y:792-top,size,font,color:rgb(0,0,0)});
  }
  function placeholder(value,x,top,width,rule=false) {
    page.drawRectangle({x,y:792-top-3,width,height:16,color:rgb(1,1,1)});
    if(rule)page.drawLine({start:{x,y:792-top-2},end:{x:x+width,y:792-top-2},thickness:.4,color:rgb(.4,.4,.4)});
    if(value)fit(value,x,top,width);
  }
  fit(data.ama,112,124,102);fit(displayDate(data.paymentDate),425,124,112);
  fit(data.name,137,149,400);fit(data.address,115,175,422);fit(data.city,98,200,260);fit(data.state,391,200,37);fit(data.zip,451,200,86);
  placeholder(data.phone,113,225,110,true);placeholder(data.cell,134,251,112,true);fit(data.email,110,277,427);
  let top={regular:328,spouse:376,junior:400}[data.category];
  if(data.kind==='new'&&data.category==='regular'&&Number(data.paymentDate.slice(5,7))>=7&&Number(data.paymentDate.slice(5,7))<=9)top=437;
  fit('X',79,top,10);if(quote.lateFee)fit('X',79,352,10);
  if(data.dob)placeholder(displayDate(data.dob),232,398,76);
  // Actual applicant and guardian signature lines remain blank.
  fit('At the meeting: officer verifies AMA membership, then applicant signs above.',72,613,465,8);
  fit(quote.amount===null?'TBD*':String(quote.amount),502,486,35,9);
  fit(`${production?'APPLICATION':'PILOT TEST'} | ${cap(data.kind)} | Expected receipt date used above; estimate only. See attached review.`,72,725,465,8);
  let review=doc.addPage([612,792]), y=714;
  review.drawText(production?'Application review':'Application review - FICTIONAL PILOT TEST',{x:54,y:743,size:15,font});
  const details=[...displayFields(data),['Dues estimate',quote.amount===null?quote.reason:`$${quote.amount}`],['Membership year',String(quote.membershipYear)],['Estimated Expiry',displayDate(quote.expiry)],
    ['Status','Submission does not establish payment, approval, or active membership. Officer verifies AMA, then applicant signs the printed application at the meeting.'],['Review acknowledgment','Applicant reviewed documents; acknowledgment is not a signature.'],['Policy','Field improvement fee eliminated. New members have no renewal late fee. Board-approved online rules apply; printed provisions, including the obsolete $25 option, await revision.']];
  for(const [label,value] of details){
    let line='';const lines=[];
    for(const c of `${label}: ${value||'(not provided)'}`){if(font.widthOfTextAtSize(line+c,10)>504){lines.push(line);line='';}line+=c;}
    lines.push(line);
    for(const text of lines){if(y<60){review=doc.addPage([612,792]);y=738;}review.drawText(text,{x:54,y,size:10,font});y-=14;}y-=4;
  }
  return Buffer.from(await doc.save());
}
