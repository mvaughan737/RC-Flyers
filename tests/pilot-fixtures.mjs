import {scryptSync} from 'node:crypto';
export const sample={kind:'new',category:'regular',paymentDate:'2026-11-14',meetingDate:'2026-12-01',
  name:'Alexandria Fictional Montgomery-Skywalker Example',ama:'TEST-123456789',
  address:'12345 Fictional Aviation Boulevard, Apartment 987, North Test Wing',city:'Fictional Long Town Name',
  state:'IN',zip:'46919-1234',phone:'202.555.0142',cell:'',email:'fictional.pilot@example.com',dob:'',acknowledge:true,fictional:true};
// Public test fixture, never a hosted credential. Real credentials are generated privately.
export const password='local-fictional-test-only';
const salt=Buffer.alloc(16,7);
export const testEnv={CFE_PILOT_ENABLED:'true',CFE_PILOT_ORIGIN:'https://pilot.example',
  CFE_PILOT_PASSWORD_HASH:`scrypt-v1$${salt.toString('hex')}$${scryptSync(password,salt,32,{N:32768,r:8,p:1,maxmem:128*1024*1024}).toString('hex')}`,
  CFE_PILOT_SECRET:'fictional-test-session-secret-32-characters',MEMBERSHIP_EMAIL_ENABLED:'false'};
export const auth='Basic '+Buffer.from('george:'+password).toString('base64');
// Atomic in-process CAS fixture exercises simultaneous function invocation behavior.
export class MemoryStore{
  entries=new Map(); revision=0;
  async getWithMetadata(key){return structuredClone(this.entries.get(key)??null);}
  async setJSON(key,data,conditions={}){
    const current=this.entries.get(key);
    if(conditions.onlyIfNew&&current||conditions.onlyIfMatch&&current?.etag!==conditions.onlyIfMatch)return {modified:false};
    const etag=`"${++this.revision}"`;this.entries.set(key,{data:structuredClone(data),etag});return {modified:true,etag};
  }
}
