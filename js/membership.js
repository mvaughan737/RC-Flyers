/* Scoped application tab recovery. No applicant data in URLs, history.state or localStorage. */
(() => {
    'use strict';
    const $=id=>document.getElementById(id);
    const form=$('membership-form'),review=$('application-review'),status=$('application-status'),error=$('application-error');
    const checked=$('pdf-reviewed'),save=$('application-submit'),start=$('application-new'),logout=$('application-logout');
    const pdfLinks=$('application-pdf-links'),pdfOpen=$('application-pdf-open'),pdfCopy=$('application-pdf-copy');
    const apiBase=form.dataset.apiBase||'/api/membership',hosted=apiBase==='/membership-pilot/api';
    const production=apiBase==='/membership-production/api';
    const storageKey=production?'cfe:membership-production:v1':hosted?'cfe:membership-pilot:v2':'cfe:membership-local:v2',formatting=globalThis.MembershipFormatting;
    const labels={kind:'Application',category:'Category',meetingDate:'Selected meeting',paymentDate:'Expected Payment Receipt',name:'Full name',ama:'AMA number',address:'Address',city:'City',state:'State',zip:'ZIP',phone:'Phone',cell:'Cell',email:'Fictional email',dob:'Date of Birth'};
    if(production){labels.email='Email';labels.comments='Comments for the Membership Secretary';}
    const names=[...Object.keys(labels),'acknowledge',...(production?[]:['fictional'])];
    function countComments(){if(production)$('comments-count').textContent=`${form.elements.comments.value.length} / 2,000 characters`;}
    const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Indiana/Indianapolis',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const clone=value=>JSON.parse(JSON.stringify(value));
    const same=(a,b)=>!!a&&!!b&&names.every(key=>(a[key]??'')===(b[key]??''));
    let token,session,collection,currentID,state,expiryTimer,pdfURL,busy=false,restoring=false,pendingNavigation=false,generation=0,storageOK=true;
    const sessionChannel=typeof BroadcastChannel==='function'?new BroadcastChannel(storageKey):null;
    function readStorage(){try{return JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{storageOK=false;return null;}}
    function writeStorage(value){try{sessionStorage.setItem(storageKey,JSON.stringify(value));}catch{storageOK=false;if(!status.textContent.includes('Browser session storage'))status.textContent+=' Browser session storage is unavailable; keep this tab open.';}}
    function fields(){return Object.fromEntries(names.map(key=>[key,['acknowledge','fictional'].includes(key)?form.elements[key].checked:form.elements[key].value]));}
    function applyFields(data){for(const key of names)if(data[key]!==undefined){if(['acknowledge','fictional'].includes(key))form.elements[key].checked=data[key]===true;else form.elements[key].value=data[key];}form.elements.dob.required=form.elements.category.value==='junior';form.elements.meetingDate.required=form.elements.kind.value==='new';countComments();}
    function defaults(){form.reset();form.elements.paymentDate.value=today();for(const key of ['phone','cell']){form.elements[key].setCustomValidity('');form.elements[key].removeAttribute('aria-invalid');$(key+'-error').textContent='';}}
    function forgetPDF(){if(pdfURL)URL.revokeObjectURL(pdfURL);pdfURL=null;pdfLinks.hidden=true;pdfOpen.removeAttribute('href');pdfCopy.removeAttribute('href');}
    function buttons(){save.disabled=busy||restoring||!token||!state?.pdfViewed||!checked.checked||!!state?.saved;start.disabled=busy||restoring;logout.disabled=busy||restoring||!token;}
    function problem(message){error.textContent=message;error.hidden=false;error.focus();}
    function remember(){
        countComments();
        if(!state||!token||!collection)return;
        state.fields=fields();state.pdfChecked=checked.checked;collection.entries[currentID]=clone(state);collection.latest=currentID;
        writeStorage(collection);
    }
    function historyEntry(){return history.state?.cfeMembership?.scope===storageKey?history.state.cfeMembership.id:null;}
    function install(next,push=false){
        currentID=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
        state=clone(next);collection.entries[currentID]=state;collection.latest=currentID;
        history[push?'pushState':'replaceState']({cfeMembership:{scope:storageKey,id:currentID}},'');
    }
    function paint(){
        applyFields(state.fields);form.hidden=state.view!=='form';review.hidden=state.view!=='review';
        checked.checked=!!state.pdfChecked;checked.disabled=!state.pdfViewed;
        if(state.view==='review'){
            const summary=$('application-summary');summary.replaceChildren();
            for(const [key,label]of Object.entries(labels)){
                const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
                dt.textContent=label;if(key==='comments')dd.style.whiteSpace='pre-wrap';
                dd.textContent=formatting.display(key,state.review.application[key])||(key==='meetingDate'?'Renewal by mail - no meeting selected':'(not provided)');row.append(dt,dd);summary.append(row);
            }
            const q=state.review.quote;
            $('application-dues').textContent=q.amount===null?q.reason:`Estimated dues: $${q.amount}${q.lateFee?' (includes $20 late fee)':''}. Membership year: ${q.membershipYear}. Estimated Expiry: ${formatting.date(q.expiry)}. ${q.note}`;
            const delivery=production&&state.saved?.status==='accepted'?'Notification accepted by the email provider; inbox delivery is not verified.':production&&['failed','sending'].includes(state.saved?.status)?'Notification needs Secretary follow-up; do not submit again.':'Email held; nothing was sent.';
            status.textContent=state.saved?`Saved privately: ${state.saved.id}. ${delivery} Your answers remain available. Use Start New Application when finished.`:`Review ready. Open the PDF in a new tab, check it, then save ${production?'your application':'this fictional test'}.`;
        }else status.textContent=`${production?'Application':hosted?'Restricted pilot':'Local test'} ready. Your answers stay in this application session. ${production&&session?.sendingEnabled?'Saving will notify the Membership Secretary.':'Email remains held.'}`;
        if(!storageOK)status.textContent+=' Browser session storage is unavailable; keep this tab open. The last reviewed answers remain in the secure server session.';
        buttons();
    }
    function endSession(message,broadcast=true){
        if(broadcast&&session?.sessionID)sessionChannel?.postMessage({type:'ended',sessionID:session.sessionID});
        generation++;token=null;session=null;state=null;collection=null;clearTimeout(expiryTimer);forgetPDF();
        // Non-sensitive marker stops old bfcache/history entries from resurrecting ended answers.
        writeStorage({ended:true});defaults();form.hidden=true;review.hidden=true;checked.checked=false;error.hidden=true;
        status.textContent=message;buttons();
    }
    if(sessionChannel)sessionChannel.onmessage=event=>{if(event.data?.type==='ended'&&event.data.sessionID===session?.sessionID)endSession('This application session ended in another tab. Temporary answers were cleared. Start a new application.',false);};
    async function request(action,body={},pdf=false){
        const sentToken=token,version=generation;
        const response=await fetch(apiBase+'/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Membership-Token':sentToken},body:JSON.stringify(body),cache:'no-store'});
        if(version!==generation||!token)throw new Error('Navigation changed. Your current application is still available.');
        if(!response.ok){
            const detail=await response.json().catch(()=>({}));
            if(response.status===401||detail.code==='session_expired')endSession('Your application session expired or ended. Temporary answers were cleared. Choose Start New Application to begin again.');
            throw new Error(detail.error||'The application service is unavailable. Your answers have been retained.');
        }
        return pdf?response.blob():response.json();
    }
    async function run(button,work){
        if(busy||restoring||!token)return;busy=true;button.disabled=true;error.hidden=true;buttons();
        try{await work();}catch(e){problem(e.message||'Unable to reach the service. Your answers have been retained.');}
        finally{busy=false;button.disabled=false;buttons();if(pendingNavigation){pendingNavigation=false;resume();}}
    }
    function configure(data){
        if(!data.token||!data.sessionID||!Number.isFinite(data.expires)||(typeof data.sendingEnabled!=='boolean'||(!production&&data.sendingEnabled!==false)))throw new Error('Invalid application session.');
        token=data.token;session=data;clearTimeout(expiryTimer);
        expiryTimer=setTimeout(()=>endSession('Your application session expired. Temporary answers were cleared. Choose Start New Application to begin again.'),Math.max(0,data.expires-Date.now()));
        if(data.expires<=Date.now()){endSession('Your application session expired. Start a new application.');return false;}
        const meetings=data.meetings||{confirmedDates:[]};
        while(form.elements.meetingDate.options.length>1)form.elements.meetingDate.remove(1);
        for(const day of meetings.confirmedDates){const option=document.createElement('option');option.value=day;option.textContent=formatting.meeting(day);form.elements.meetingDate.append(option);}
        if(meetings.notice)$('meeting-help').textContent=meetings.notice;
        return true;
    }
    async function reconcile(){
        if(state.view!=='review')return;
        let current=session.review;
        if(!same(current?.application,state.review?.application)){
            const result=await request('review',{application:state.review.application});
            current={...result,downloaded:false,saved:null};session.review=current;state.pdfViewed=false;state.pdfChecked=false;
        }
        state.review={application:current.application,quote:current.quote};state.saved=current.saved||null;
        state.pdfViewed=!!current.downloaded&&!!state.pdfViewed;state.pdfChecked=state.pdfViewed&&state.pdfChecked;
    }
    async function resume(){
        if(busy||restoring){pendingNavigation=true;return;}
        const cached=readStorage();
        if(cached?.ended){endSession('This application session has ended. Choose Start New Application to begin again.');return;}
        if(cached?.expires<=Date.now()){endSession('Your application session expired. Temporary answers were cleared. Choose Start New Application to begin again.');return;}
        generation++;const version=generation;restoring=true;buttons();form.hidden=true;review.hidden=true;
        try{
            const response=await fetch(apiBase+'/session',{cache:'no-store'});if(version!==generation)return;
            if(response.status===401){endSession('Sign in again to start a new application session. Temporary answers were cleared.');return;}
            if(!response.ok)throw new Error('Application session unavailable.');
            const data=await response.json();if(!configure(data))return;
            if(cached&&cached.sessionID!==data.sessionID){endSession('The previous application session expired or ended. Temporary answers were cleared. Choose Start New Application.',false);return;}
            collection=cached||{sessionID:data.sessionID,expires:data.expires,entries:{}};
            currentID=historyEntry()||collection.latest;state=clone(collection.entries[currentID]||collection.entries[collection.latest]||null);
            if(!state){
                if(data.review){applyFields(data.review.application);install({view:'review',fields:fields(),review:{application:data.review.application,quote:data.review.quote},pdfViewed:!!data.review.downloaded,pdfChecked:false,saved:data.review.saved||null});}
                else{if(!form.elements.paymentDate.value)form.elements.paymentDate.value=today();install({view:'form',fields:fields(),pdfViewed:false,pdfChecked:false});}
            }
            await reconcile();forgetPDF();paint();remember();
        }catch(e){status.textContent='Application temporarily unavailable. Your session answers have been retained; reload to reconnect.';}
        finally{restoring=false;buttons();if(pendingNavigation){pendingNavigation=false;resume();}}
    }
    function normalizePhoneField(key){
        const field=form.elements[key],feedback=$(key+'-error');
        try{field.value=formatting.phone(field.value,labels[key]);field.setCustomValidity('');field.removeAttribute('aria-invalid');feedback.textContent='';remember();return true;}
        catch(e){field.setCustomValidity(e.message);field.setAttribute('aria-invalid','true');feedback.textContent=e.message;return false;}
    }
    for(const key of ['phone','cell']){
        form.elements[key].addEventListener('blur',()=>normalizePhoneField(key));
        form.elements[key].addEventListener('input',()=>{form.elements[key].setCustomValidity('');form.elements[key].removeAttribute('aria-invalid');$(key+'-error').textContent='';});
    }
    form.addEventListener('input',remember);form.addEventListener('change',()=>{form.elements.dob.required=form.elements.category.value==='junior';form.elements.meetingDate.required=form.elements.kind.value==='new';remember();});
    form.addEventListener('submit',event=>{
        event.preventDefault();const validPhone=normalizePhoneField('phone'),validCell=normalizePhoneField('cell');
        if(!validPhone||!validCell){form.reportValidity();return;}
        run(event.submitter,async()=>{
            const result=await request('review',{application:fields(),website:form.elements.website.value});
            remember();applyFields(result.application);session.review={...result,downloaded:false,saved:null};forgetPDF();
            install({view:'review',fields:fields(),review:result,pdfViewed:false,pdfChecked:false,saved:null},true);paint();remember();$('review-title').focus();
        });
    });
    $('application-edit').addEventListener('click',()=>{
        if(busy||restoring||!token)return;remember();forgetPDF();install({...clone(state),view:'form',pdfChecked:false},true);paint();remember();form.elements.kind[0].focus();
    });
    $('application-download').addEventListener('click',event=>{
        if(busy||restoring||!token)return;
        // Reserve the tab during the click; async download clicks can replace Safari's form tab.
        let tab;try{tab=window.open('about:blank','_blank');if(tab){try{tab.sessionStorage.removeItem(storageKey);tab.opener=null;}catch{tab.close();tab=null;}}}catch{tab=null;}
        run(event.currentTarget,async()=>{
            try{
                const blob=await request('download',{},true);forgetPDF();pdfURL=URL.createObjectURL(blob);
                pdfOpen.href=pdfURL;pdfCopy.href=pdfURL;pdfLinks.hidden=false;state.pdfViewed=true;session.review.downloaded=true;checked.disabled=false;
                if(tab&&!tab.closed){try{tab.location.replace(pdfURL);}catch{tab.close();}}
                status.textContent='PDF ready in a separate tab. If no tab opened, use the Open PDF link below. Your answers remain here.';remember();
            }catch(e){if(tab&&!tab.closed)tab.close();throw e;}
        });
    });
    checked.addEventListener('change',()=>{remember();buttons();});
    save.addEventListener('click',event=>run(event.currentTarget,async()=>{
        if(!checked.checked||state.saved)return;
        const result=await request('submit');state.saved={id:result.id,status:result.status};session.review.saved=state.saved;
        remember();paint();status.tabIndex=-1;status.focus();
    }));
    function hasInformation(){
        const meaningful=data=>Object.keys(labels).some(key=>!['kind','category','paymentDate','meetingDate'].includes(key)&&!!data[key])||data.acknowledge||data.fictional||data.kind==='renewal'||data.category!=='regular'||!!data.meetingDate||!!data.paymentDate&&data.paymentDate!==today();
        return meaningful(fields())||Object.values(collection?.entries||{}).some(entry=>meaningful(entry.fields));
    }
    start.addEventListener('click',async()=>{
        if(busy||restoring||hasInformation()&&!window.confirm('Start a new application? This will clear the current answers and review history in this tab. Saved submissions remain private.'))return;
        busy=true;buttons();
        try{
            let data;if(token)data=await request('restart');else{const r=await fetch(apiBase+'/session',{cache:'no-store'});if(!r.ok)throw new Error('Unable to start a session.');data=await r.json();if(data.resumed){token=data.token;data=await request('restart');}}
            if(session?.sessionID)sessionChannel?.postMessage({type:'ended',sessionID:session.sessionID});
            generation++;clearTimeout(expiryTimer);forgetPDF();defaults();writeStorage({ended:true});if(!configure(data))return;
            collection={sessionID:data.sessionID,expires:data.expires,entries:{}};checked.checked=false;
            install({view:'form',fields:fields(),pdfViewed:false,pdfChecked:false});paint();remember();
        }catch(e){problem(e.message);}finally{busy=false;buttons();if(pendingNavigation){pendingNavigation=false;resume();}}
    });
    logout.addEventListener('click',()=>{
        if(busy||restoring||!token||hasInformation()&&!window.confirm('End this application session and clear this tab’s temporary answers?'))return;
        run(logout,async()=>{let ended=false;try{await request('logout');ended=true;}finally{endSession((ended?'Session ended.':'Local answers cleared; the service could not confirm ending its session.')+(production?' Temporary browser answers were cleared. Close this browser window and its PDF tabs on a shared computer.':' Temporary browser answers were cleared. Close this private browser window and its PDF tabs to forget the cached pilot password.'));}});
    });
    window.addEventListener('pagehide',remember);
    window.addEventListener('pageshow',event=>{if(event.persisted)resume();});
    window.addEventListener('popstate',resume);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&session?.expires<=Date.now())endSession('Your session expired. Temporary answers were cleared. Start a new application.');});
    resume();
})();
