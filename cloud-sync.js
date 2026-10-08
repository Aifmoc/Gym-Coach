(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GymCloud=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const computed=['kcal','protein','carbs','fat','fiber','sugar','addedSugar','fiberCoverage','sugarCoverage','addedSugarCoverage'];
  function arrayKey(path,rows){
    const leaf=path.split('.').at(-1);
    if(['sessions','weights','measures','nutrition','readiness'].includes(leaf))return 'date';
    if(rows.length&&rows.every(v=>object(v)&&v.id!==undefined))return 'id';
    if(['foods','meals','myPlates'].includes(leaf)&&rows.every(v=>object(v)&&v.name))return 'name';
    return null;
  }
  function merge(base,local,remote,path='',conflicts=[],preference='local'){
    if(equal(local,remote))return {value:clone(local),conflicts};
    if(equal(local,base))return {value:clone(remote),conflicts};
    if(equal(remote,base))return {value:clone(local),conflicts};
    // Two devices can create the same calendar day's session independently.
    if(base===undefined&&/^sessions\[[^\]]+\]\.id$/.test(path))return {value:clone(remote),conflicts};
    if(/^sessions\[[^\]]+\]\.(startedAt|lastEntryAt)$/.test(path)&&Number.isFinite(local)&&Number.isFinite(remote))return {value:path.endsWith('.startedAt')?Math.min(local,remote):Math.max(local,remote),conflicts};
    if(object(local)&&object(remote)&&(base===undefined||object(base))){
      const value={};
      for(const key of new Set([...Object.keys(base||{}),...Object.keys(remote),...Object.keys(local)])){
        // Never allow a JSON document to alter the object prototype.
        if(['__proto__','constructor','prototype'].includes(key))continue;
        const next=merge(base?.[key],local[key],remote[key],path?path+'.'+key:key,conflicts,preference).value;
        if(next!==undefined)value[key]=next;
      }
      return {value,conflicts};
    }
    if(Array.isArray(local)&&Array.isArray(remote)&&(base===undefined||Array.isArray(base))){
      const key=arrayKey(path,[...(base||[]),...local,...remote]);
      if(key){
        const maps=[base||[],local,remote].map(rows=>new Map(rows.map(v=>[String(v[key]),v])));
        if(maps.every((m,i)=>m.size===[base||[],local,remote][i].length)){
          const value=[];
          for(const id of new Set([...maps[2].keys(),...maps[1].keys(),...maps[0].keys()])){
            const next=merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),`${path}[${id}]`,conflicts,preference).value;
            if(next!==undefined)value.push(next);
          }
          return {value,conflicts};
        }
      }
    }
    conflicts.push(path||'datos');
    return {value:clone(preference==='remote'?remote:local),conflicts};
  }
  // Ingredient indices belong to one device's ordered food catalog. Normalize them
  // for transfer, then resolve against the merged catalog on application.
  function pack(db){
    const value=clone(db);value.builder=[]; // unfinished plate is device-local
    for(const [date,rows] of Object.entries(value.dayFood||{}))rows.forEach((r,i)=>{r.id=r.id||`legacy-food:${date}:${r.ts||i}:${i}`;});
    for(const row of value.nutrition||[])if(row.fromLog)for(const key of computed)delete row[key];
    function visit(v){
      if(Array.isArray(v)){v.forEach(visit);return;}
      if(!object(v))return;
      if(Number.isInteger(v.foodIndex)&&db.foods?.[v.foodIndex]){v.syncFoodName=db.foods[v.foodIndex].name;delete v.foodIndex;}
      Object.values(v).forEach(visit);
    }
    visit(value);return value;
  }
  function unpack(doc,current){
    const value=clone(doc);value.builder=clone(current?.builder||[]);
    for(const row of value.nutrition||[])if(row.fromLog){
      const log=value.dayFood?.[row.date]||[],sum=key=>log.reduce((n,r)=>n+(+r[key]||0),0);
      for(const [field,key] of [['kcal','kcal'],['protein','p'],['carbs','c'],['fat','f']])row[field]=Math.round(sum(key))||null;
      for(const key of ['fiber','sugar','addedSugar']){row[key]=+sum(key).toFixed(1)||null;row[key+'Coverage']=Math.min(100,Math.round(sum(key+'KnownKcal')/Math.max(1,sum('kcal'))*100));}
    }
    // Keep the current device's unfinished plate referring to the same foods.
    value.builder.forEach(item=>{const name=current?.foods?.[item.foodIndex]?.name;const i=value.foods?.findIndex(f=>f.name===name);if(i>=0)item.foodIndex=i;});
    function visit(v){
      if(Array.isArray(v)){v.forEach(visit);return;}
      if(!object(v))return;
      if(v.syncFoodName){const i=value.foods?.findIndex(f=>f.name===v.syncFoodName);if(i>=0)v.foodIndex=i;delete v.syncFoodName;}
      Object.values(v).forEach(visit);
    }
    visit(value);return value;
  }
  function validConfig(config){
    if(!config)return false;
    try{const url=new URL(config.url);if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.pathname!=='/')return false;}catch{return false;}
    if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey||''))return true;
    try{const body=JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return body.role==='anon';}catch{return false;}
  }
  class Sync{
    constructor(options){
      Object.assign(this,{fetch:globalThis.fetch?.bind(globalThis),storage:globalThis.localStorage,online:()=>globalThis.navigator?.onLine!==false,onStatus:()=>{},onApply:()=>{},delay:1200},options);
      this.prefix='gymCoachCloudV1';this.session=this.read('session');this.owner=this.read('owner');
      this.busy=false;this.pending=false;this.timer=null;this.conflict=null;this.enabled=validConfig(this.config);
      this.status(this.enabled?(this.session?'pending':'signedout'):'setup');
    }
    read(key){try{return JSON.parse(this.storage.getItem(this.prefix+'_'+key)||'null')}catch{return null;}}
    write(key,value){this.storage.setItem(this.prefix+'_'+key,JSON.stringify(value));}
    status(state,detail=''){this.state=state;this.onStatus({state,detail,email:this.session?.user?.email||''});}
    changed(){if(this.session&&equal(pack(this.getData()),this.read('base_'+this.session.user.id)?.document))return;this.pending=true;if(this.conflict)return;clearTimeout(this.timer);if(this.session)this.timer=setTimeout(()=>this.sync(),this.delay);}
    async request(path,{body,method=body?'POST':'GET',auth=true}={}){
      const headers={apikey:this.config.publishableKey,'Content-Type':'application/json'};
      if(auth&&this.session?.access_token)headers.Authorization='Bearer '+this.session.access_token;
      const response=await this.fetch(this.config.url.replace(/\/$/,'')+path,{method,headers,body:body?JSON.stringify(body):undefined});
      const data=await response.json().catch(()=>null);
      if(!response.ok){const e=new Error(data?.msg||data?.message||data?.error_description||'No se ha podido conectar con la nube.');e.status=response.status;throw e;}
      return data;
    }
    storeSession(session){
      if(!session?.access_token||!session.user?.id)throw Error('La sesión no es válida.');
      this.session={access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at||Math.floor(Date.now()/1000)+(session.expires_in||3600),user:{id:session.user.id,email:session.user.email}};
      this.write('session',this.session);
    }
    async signIn(email,password){
      if(!this.enabled)throw Error('La sincronización necesita activar su servidor privado.');
      this.status('connecting');
      try{const session=await this.request('/auth/v1/token?grant_type=password',{auth:false,body:{email,password}});
        if(this.owner&&this.owner!==session.user?.id)throw Error('Este dispositivo contiene datos de otra cuenta. Usa otro perfil de navegador para esa cuenta.');
        this.storeSession(session);await this.sync();
      }catch(e){this.status('error',e.message);throw e;}
    }
    async signUp(email,password){
      if(!this.enabled)throw Error('La sincronización necesita activar su servidor privado.');
      const session=await this.request('/auth/v1/signup',{auth:false,body:{email,password}});
      if(session?.access_token){
        if(this.owner&&this.owner!==session.user?.id)throw Error('Este dispositivo contiene datos de otra cuenta. Usa otro perfil de navegador para esa cuenta.');
        this.storeSession(session);await this.sync();return;
      }
      this.status('signedout','Cuenta solicitada. Confirma el correo y después entra.');
    }
    async confirmEmail(link){
      if(!this.enabled)throw Error('La sincronización necesita activar su servidor privado.');
      let url;try{url=new URL(link.trim())}catch{throw Error('Pega el enlace de confirmación del correo de Gym Coach.');}
      if(url.origin!==new URL(this.config.url).origin||url.pathname!=='/auth/v1/verify'||url.searchParams.get('type')!=='signup'||!url.searchParams.get('token'))throw Error('Ese enlace no corresponde a la confirmación de Gym Coach.');
      try{
        const session=await this.request('/auth/v1/verify',{auth:false,body:{token_hash:url.searchParams.get('token'),type:'signup'}});
        if(this.owner&&this.owner!==session.user?.id)throw Error('Este dispositivo contiene datos de otra cuenta. Usa otro perfil de navegador para esa cuenta.');
        this.storeSession(session);await this.sync();
      }catch(e){this.status('error',e.message);throw e;}
    }
    async refresh(){
      const saved=this.read('session');if(saved?.user?.id===this.session?.user?.id)this.session=saved;
      if(this.session.expires_at>Date.now()/1000+60)return;
      const refresh=()=>this.request('/auth/v1/token?grant_type=refresh_token',{auth:false,body:{refresh_token:this.session.refresh_token}}).then(s=>this.storeSession(s)).catch(e=>{e.authExpired=e.status===400||e.status===401;throw e;});
      if(globalThis.navigator?.locks)await globalThis.navigator.locks.request(this.prefix+'_auth',async()=>{const newer=this.read('session');if(newer)this.session=newer;if(this.session.expires_at<=Date.now()/1000+60)await refresh();});
      else await refresh();
    }
    backup(reason){
      const backups=this.read('backups')||[];backups.push({at:new Date().toISOString(),reason,data:clone(this.getData())});this.write('backups',backups.slice(-5));
    }
    checkpoint(doc,revision){this.write('base_'+this.session.user.id,{document:clone(doc),revision});this.owner=this.session.user.id;this.write('owner',this.owner);}
    apply(doc){this.onApply(unpack(doc,this.getData()));}
    async sync(){
      if(!this.enabled||!this.session||this.conflict)return;
      if(this.busy){this.pending=true;return;}
      if(!this.online()){this.status('offline');return;}
      this.busy=true;this.pending=false;this.status('syncing');
      try{
        await this.refresh();
        const uid=this.session.user.id;
        for(let attempt=0;attempt<4;attempt++){
          const rows=await this.request('/rest/v1/gym_coach_state?select=document,revision&user_id=eq.'+encodeURIComponent(uid));
          if(this.session?.user?.id!==uid)return;
          const remote=rows[0]||null,base=this.read('base_'+uid);
          if(!base&&remote){
            this.backup('Antes de traer la cuenta a este dispositivo');
            this.checkpoint(remote.document,remote.revision);this.apply(remote.document);
            this.status('synced');return;
          }
          const local=pack(this.getData()),remoteDoc=remote?.document||{},baseDoc=remote?base?.document||{}:{};
          const result=merge(baseDoc,local,remoteDoc);
          if(result.conflicts.length){
            this.conflict={remote,base:baseDoc,local,document:result.value,paths:result.conflicts};
            this.write('conflict_'+uid,{at:new Date().toISOString(),local,remote,paths:result.conflicts});
            this.status('conflict',result.conflicts.join(', '));return;
          }
          if(remote&&equal(result.value,remoteDoc)){
            this.checkpoint(result.value,remote.revision);this.apply(result.value);this.status('synced');return;
          }
          const resultRow=await this.request('/rest/v1/rpc/gym_coach_save',{body:{p_document:result.value,p_expected_revision:remote?.revision||0}});
          if(this.session?.user?.id!==uid)return;
          if(!resultRow?.ok)continue; // concurrent write: fetch and rebase again
          // Edits made while the request was in flight are rebased, never overwritten.
          const latest=pack(this.getData()),after=merge(local,latest,result.value);
          this.checkpoint(result.value,resultRow.revision);
          if(after.conflicts.length){this.conflict={base:local,local:latest,remote:{document:result.value,revision:resultRow.revision},document:after.value,paths:after.conflicts};this.write('conflict_'+uid,{local:latest,remote:this.conflict.remote,paths:after.conflicts});this.status('conflict',after.conflicts.join(', '));return;}
          this.apply(after.value);this.pending=!equal(after.value,result.value);this.status(this.pending?'pending':'synced');return;
        }
        this.pending=true;this.status('pending','Otro dispositivo está guardando; volveré a intentarlo.');
      }catch(e){
        if(!this.session){this.status('signedout');return;}
        this.pending=true;const expired=e.status===401||e.authExpired;
        if(expired){this.session=null;this.storage.removeItem(this.prefix+'_session');}
        this.status(!this.online()?'offline':expired?'signedout':'error',expired?'Vuelve a entrar para sincronizar.':e.message);
      }finally{this.busy=false;if(this.pending&&this.online()&&!this.conflict&&this.state!=='signedout')this.timer=setTimeout(()=>this.sync(),5000);}
    }
    async resolve(choice){
      if(!this.conflict)return;
      this.backup('Antes de resolver cambios simultáneos');
      if(!['remote','local'].includes(choice))return;
      const resolved=merge(this.conflict.base,pack(this.getData()),this.conflict.remote.document,'',[],choice).value;
      this.checkpoint(this.conflict.remote.document,this.conflict.remote.revision);this.apply(resolved);
      this.conflict=null;this.write('conflict_'+this.session.user.id,null);await this.sync();
    }
    async signOut(){
      const old=this.session;this.session=null;clearTimeout(this.timer);this.storage.removeItem(this.prefix+'_session');this.status('signedout');
      if(old)await this.fetch(this.config.url.replace(/\/$/,'')+'/auth/v1/logout',{method:'POST',headers:{apikey:this.config.publishableKey,Authorization:'Bearer '+old.access_token}}).catch(()=>{});
    }
  }
  return {Sync,merge,pack,unpack,validConfig};
});
