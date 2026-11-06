// Calendar arithmetic is UTC; the cutoff uses the club's local wall clock.
export const MEETING_ZONE='America/Indiana/Indianapolis';
export function upcomingMeetings(now=Date.now(),count=12){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:MEETING_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
  const today=`${parts.year}-${parts.month}-${parts.day}`,dates=[];
  for(let offset=0;dates.length<count;offset++){
    const first=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1+offset,1));
    first.setUTCDate(1+(2-first.getUTCDay()+7)%7);
    const day=first.toISOString().slice(0,10);
    if(day>today||(day===today&&Number(parts.hour)<18))dates.push(day);
  }
  return {confirmedDates:dates,time:'18:00',timeZone:MEETING_ZONE,notice:'Meetings are exclusively the first Tuesday of each month at 6:00 PM Eastern Time (EST or EDT as shown for each date). New members pay by cash or check at the meeting. Selected meeting and expected payment date are separate.'};
}
