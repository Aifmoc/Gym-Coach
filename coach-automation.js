(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GymCoachAutomation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
  function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
  function reference(log){
    if(!log)return null;
    return {id:log.id||'',exerciseId:log.exerciseId||'',workoutSlotId:log.workoutSlotId||'',location:log.location||'',machine:log.machine||'',variant:log.variant||'',loadUnit:log.loadUnit||'unknown',baseLoad:log.baseLoad??null,notes:log.notes||'',painScore:log.painScore||0,valid:log.valid!==false&&!log.invalid,sets:(log.sets||[]).map(s=>({reps:s.reps??null,weight:s.weight??null,rir:s.rir??null,warmup:!!s.warmup,drop:!!s.drop,partial:!!s.partial,loadUnit:s.loadUnit||log.loadUnit||'unknown',baseLoad:s.baseLoad??null,note:s.note||''}))};
  }
  function sameScope(a,b){return a.exerciseId===b.exerciseId&&!!a.workoutSlotId&&a.workoutSlotId===b.workoutSlotId&&['location','machine','variant'].every(k=>norm(a[k])===norm(b[k]));}
  function validSets(sets){return Array.isArray(sets)&&sets.length>0&&sets.length<=10&&sets.every(s=>Number.isFinite(s.weight)&&s.weight>=0&&Number.isFinite(s.repMin)&&Number.isFinite(s.repMax)&&s.repMin>=1&&s.repMax>=s.repMin&&s.repMax<=60&&Number.isFinite(s.rirMin)&&Number.isFinite(s.rirMax)&&s.rirMin>=0&&s.rirMax>=s.rirMin&&s.rirMax<=5);}
  function targetFor(reports,scope,history){
    const latest=history?.[0];if(!latest||latest.valid===false||latest.invalid)return null;
    for(const report of [...(reports||[])].sort((a,b)=>String(b.generated_at||'').localeCompare(String(a.generated_at||'')))){
      for(const target of report.targets||[]){
        if(!sameScope(target,scope)||!validSets(target.sets)||target.reference_date!==latest.date||stable(target.reference_log)!==stable(reference(latest)))continue;
        if(scope.loadUnit!==undefined&&scope.loadUnit!==target.reference_log.loadUnit)continue;
        if(scope.baseLoad!==undefined&&scope.baseLoad!==target.reference_log.baseLoad)continue;
        if(scope.loadUnit!==undefined&&scope.loadUnit!==target.reference_log.loadUnit)continue;
        if(scope.baseLoad!==undefined&&scope.baseLoad!==target.reference_log.baseLoad)continue;
        return {...target,id:'auto:'+report.report_date+':'+target.reference_log.id,createdAt:report.generated_at,status:'pending',source:'automation',exerciseName:target.exerciseName||scope.exerciseId,sets:target.sets.map(s=>({...s,rirLabel:s.rirMin===s.rirMax?String(s.rirMin):s.rirMin+'–'+s.rirMax}))};
      }
    }
    return null;
  }
  // Reports are plain text and immutable to browser clients. The cache is account-scoped.
  class Client{
    constructor({getCloud,onChange,storage=globalThis.localStorage}){Object.assign(this,{getCloud,onChange,storage,rows:[],uid:null,busy:false,lastFetch:0,state:'signedout'});}
    cacheKey(uid){return 'gymCoachReportsV1_'+uid;}
    reconcile(){const uid=this.getCloud()?.session?.user?.id||null;if(uid===this.uid)return;this.uid=uid;this.rows=[];this.lastFetch=0;this.state=uid?'waiting':'signedout';if(uid)try{const rows=JSON.parse(this.storage.getItem(this.cacheKey(uid))||'[]');if(Array.isArray(rows))this.rows=rows;}catch{}this.onChange();}
    async refresh(force=false){
      this.reconcile();const cloud=this.getCloud(),uid=this.uid;
      if(!uid||this.busy||(!force&&Date.now()-this.lastFetch<30000))return;
      if(globalThis.navigator?.onLine===false){this.state='offline';this.onChange();return;}
      this.busy=true;
      try{await cloud.refresh();if(this.uid!==uid||cloud.session?.user?.id!==uid)return;
        const rows=await cloud.request('/rest/v1/gym_coach_reports?select=report_date,generated_at,report,targets,source_session,source_nutrition&user_id=eq.'+encodeURIComponent(uid)+'&order=report_date.desc&limit=60');
        if(cloud.session?.user?.id!==uid||this.uid!==uid)return;
        if(!Array.isArray(rows))throw Error('Invalid reports');this.rows=rows;this.lastFetch=Date.now();this.state='ready';
        try{this.storage.setItem(this.cacheKey(uid),JSON.stringify(rows));}catch{}
      }catch(e){if(this.uid===uid)this.state=e.status===401?'auth':'error';}
      finally{this.busy=false;this.reconcile();this.onChange();}
    }
  }
  return {reference,stable,sameScope,validSets,targetFor,Client};
});
