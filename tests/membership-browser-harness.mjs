// Browser lifecycle/DOM contract harness using the real pilot handler, PDF and private CAS store.
// It deliberately models history, per-tab storage, popup blockers and a fake clock; no live mail/network.
import vm from 'node:vm';
import {readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {build} from '../scripts/build-netlify.mjs';
import {loadAssets} from '../netlify/functions/membership-pilot.mjs';
import {createProductionHandler} from '../netlify/production/service.mjs';
import {createHandler} from '../netlify/pilot/service.mjs';
import {MemoryStore,testEnv,auth} from './pilot-fixtures.mjs';
let assetsPromise;
async function assets(){return assetsPromise??=(async()=>{const root=await mkdtemp(join(tmpdir(),'cfe-browser-'));await build(join(root,'public'),join(root,'netlify/pilot-private'));return loadAssets(root);})();}
function element(value=''){
    return {value,checked:false,disabled:false,hidden:false,textContent:'',children:[],style:{},listeners:{},options:[],
        addEventListener(type,handler){this.listeners[type]=handler;},setCustomValidity(message){this.validationMessage=message;},
        setAttribute(key,value){this[key]=value;},removeAttribute(key){delete this[key];},focus(){this.focused=true;},
        append(...items){this.children.push(...items);this.options.push(...items);},replaceChildren(){this.children=[];},remove(i){this.options.splice(i,1);}};
}
export async function browserHarness({blocked=false,storageDisabled=false,production=false}={}){
    const store=new MemoryStore(),storage=new Map([['unrelated-public-feature','keep']]);
    let now=Date.now(),cookie='',pending=0,page,timerID=0,blobID=0,index=0;
    const timers=new Map(),entries=[null],requests=[],tabs=[],blobs=new Map(),revoked=[],events=[];
    const origin=production?'https://production.example':testEnv.CFE_PILOT_ORIGIN;
    const base=production?'/membership-production/api':'/membership-pilot/api';
    const handler=(production?createProductionHandler:createHandler)({env:{...testEnv,CFE_PRODUCTION_ENABLED:'true',CFE_PRODUCTION_PUBLIC_SUBMISSIONS_ENABLED:'true',CFE_PRODUCTION_EMAIL_ENABLED:'false',CFE_PRODUCTION_ORIGIN:origin,CFE_PRODUCTION_SECRET:'production-fixture-secret-over-32-characters'},store,assets:await assets(),clock:()=>now,transport:async()=>{throw new Error('No email/network is allowed');}});
    class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
    const browser={store,storage,requests,tabs,blobs,revoked,events,entries,confirm:true,blocked,storageDisabled,
        get page(){return page;},get cookie(){return cookie;},get now(){return now;},get index(){return index;},
        async settle(){const deadline=Date.now()+15000;do{await new Promise(setImmediate);if(!pending){await new Promise(setImmediate);if(!pending)return;}if(Date.now()>deadline)throw new Error('Browser harness timed out');await new Promise(r=>setTimeout(r,5));}while(true);},
        async load(){
            timers.clear();
            const ids=Object.fromEntries(['membership-form','application-review','application-status','application-error','pdf-reviewed','application-submit','phone-error','cell-error','application-summary','application-dues','review-title','application-edit','application-download','meeting-help','application-new','application-logout','application-pdf-links','application-pdf-open','application-pdf-copy','comments-count'].map(id=>[id,element()]));
            const form=ids['membership-form'];form.dataset={apiBase:base};
            const initial={...(production?{comments:''}:{}),kind:'new',category:'regular',meetingDate:'',paymentDate:'',name:'',ama:'',address:'',city:'',state:'',zip:'',phone:'',cell:'',email:'',dob:'',website:''};
            form.elements=Object.fromEntries(Object.entries(initial).map(([k,v])=>[k,element(v)]));
            const radios=[element('new'),element('renewal')];radios[0].checked=true;
            Object.defineProperty(radios,'value',{get(){return radios.find(r=>r.checked)?.value||'';},set(v){for(const radio of radios)radio.checked=radio.value===v;}});form.elements.kind=radios;
            form.elements.acknowledge=element();if(!production)form.elements.fictional=element();form.elements.meetingDate.options=[{value:''}];
            form.reset=()=>{for(const[k,v]of Object.entries(initial))form.elements[k].value=v;form.elements.acknowledge.checked=false;if(!production)form.elements.fictional.checked=false;};form.reportValidity=()=>true;
            for(const id of ['membership-form','application-review','application-error','application-pdf-links'])ids[id].hidden=true;
            for(const id of ['pdf-reviewed','application-submit','application-new','application-logout'])ids[id].disabled=true;
            for(const id of ['application-pdf-open','application-pdf-copy']){ids[id].target='_blank';ids[id].rel='noopener noreferrer';}
            const listeners={},docListeners={},context={
                document:{getElementById:id=>ids[id],createElement:()=>element(),addEventListener:(k,v)=>docListeners[k]=v,visibilityState:'visible'},
                window:{addEventListener:(k,v)=>listeners[k]=v,confirm:()=>browser.confirm,open:()=>{
                    events.push('open');if(browser.blocked)return null;
                    const copied=new Map(storage),tab={opener:true,closed:false,sessionStorage:{removeItem:k=>copied.delete(k)},storage:copied,
                        location:{replace(url){tab.url=url;}},close(){tab.closed=true;}};tabs.push(tab);return tab;
                }},
                sessionStorage:{getItem:k=>{if(browser.storageDisabled)throw new Error('Storage blocked');return storage.get(k)??null;},setItem:(k,v)=>{if(browser.storageDisabled)throw new Error('Storage blocked');storage.set(k,v);}},
                history:{get state(){return entries[index];},replaceState(state,title,url){if(url!==undefined)throw new Error('Application must not put information in URLs');entries[index]=structuredClone(state);},pushState(state,title,url){if(url!==undefined)throw new Error('Application must not put information in URLs');entries.splice(index+1);entries.push(structuredClone(state));index++;}},
                Intl,Date:ClockDate,crypto:{randomUUID},setTimeout:(fn,delay)=>{const id=++timerID;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id),
                URL:{createObjectURL(blob){const url=`blob:https://pilot.example/${++blobID}`;blobs.set(url,blob);return url;},revokeObjectURL:url=>{revoked.push(url);blobs.delete(url);}},
                fetch:async(path,options={})=>{
                    pending++;events.push('fetch:'+path.split('/').pop());requests.push({path,method:options.method||'GET'});
                    try{const res=await handler(new Request(origin+path,{...options,headers:{Authorization:auth,Cookie:cookie,...(options.method==='POST'?{Origin:origin}:{}),...options.headers}}),{ip:'192.0.2.44'});
                        if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return res;
                    }finally{pending--;}
                }
            };
            vm.createContext(context);page={ids,form,listeners,docListeners,context};
            vm.runInContext(await readFile('js/membership-format.js','utf8'),context);vm.runInContext(await readFile('js/membership.js','utf8'),context);
            await browser.settle();return page;
        },
        async fill(data){for(const[k,v]of Object.entries(data)){if(['acknowledge','fictional'].includes(k))page.form.elements[k].checked=v;else page.form.elements[k].value=v;}page.form.listeners.input();await browser.settle();},
        async review(){page.form.listeners.submit({preventDefault(){},submitter:element()});await browser.settle();},
        async click(id){page.ids[id].listeners.click({currentTarget:page.ids[id]});await browser.settle();},
        async back(){if(index>0)index--;await page.listeners.popstate();await browser.settle();},
        async forward(){if(index<entries.length-1)index++;await page.listeners.popstate();await browser.settle();},
        async advance(ms,fire=true){now+=ms;if(fire)for(const[id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}await browser.settle();},
        async checkPDF(){page.ids['pdf-reviewed'].checked=true;page.ids['pdf-reviewed'].listeners.change();await browser.settle();},
        submissionCount(){return [...store.entries.keys()].filter(k=>k.startsWith('submissions/')).length;}
    };
    await browser.load();return browser;
}
