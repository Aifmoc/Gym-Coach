const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),source=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function definition(name){const start=[...source.matchAll(new RegExp('^function '+name+'\\(','gm'))].at(-1)?.index;assert.notEqual(start,undefined,name);const end=source.indexOf('\n',start);return source.slice(start,end).endsWith('}')?source.slice(start,end):source.slice(start,source.indexOf('\n}',end)+2);}
function harness(){
 let clock=Date.parse('2026-10-12T10:00:00Z'),rows=[],limit=Infinity,denied=false,lastElapsed=-1,alerts=0;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const key='journal',storage=new Map(),fields=new Map(),timeouts=new Map();let sequence=0;
 const localStorage={getItem:k=>storage.get(k)??null,removeItem:k=>storage.delete(k),setItem(k,v){const next=new Map(storage);next.set(k,String(v));if(denied||[...next.values()].reduce((n,v)=>n+v.length,0)>limit){const e=new Error('Full storage');e.name='QuotaExceededError';throw e;}storage.set(k,String(v));}};
 const byId=id=>{if(!fields.has(id))fields.set(id,{value:'',classList:{add(){},remove(){},toggle(){}},querySelectorAll:()=>id==='sets'?rows:[]});return fields.get(id);};
 const exercises=[{id:'pullover',name:'Pullover',group:'Espalda',rest:90},{id:'row_t',name:'Remo T',group:'Espalda',rest:120},{id:'row_uni',name:'Remo unilateral',group:'Espalda',rest:120}];
 byId('exerciseSelect').value='Pullover';byId('location').value='Test gym';byId('loadUnit').value='stack_kg';
 const noop=()=>{},c=vm.createContext({Date:Clock,Math,Number,String,JSON,structuredClone,APPKEY:key,DRAFT_KEY:key+'_active_draft_v11',SNAPSHOT_KEY:key+'_snapshots_v11',REST_END_KEY:key+'_rest_ends_v21',localStorage,byId,db:{profile:{},sessions:[],exercises,variantMeta:{},coachTargets:[{id:'goal',status:'pending'}],weeklyPending:[{status:'pending'}]},gcCloud:null,gcSelectedSlot:'extra:pullover',gcReplacement:{slot:'routine:1:row_t'},gcLoadedExercise40:'pullover',
  today:()=> '2026-10-12',exById:id=>c.db.exercises.find(e=>e.id===id),exerciseFromInput:()=>c.db.exercises.find(e=>e.name===byId('exerciseSelect').value),
  ensureExerciseFromInput:()=>({exercise:c.exerciseFromInput(),isNew:false}),saveVariantMeta:()=>{c.db.variantMeta.test={loadUnit:'stack_kg',variantKey:'test'};return c.db.variantMeta.test},rawSetText:z=>`${z.reps}x${z.weight}`,gcDefaultSlot40:id=>`extra:${id}`,coachTargetForV22:()=>c.db.coachTargets[0],gcCompletePending:()=>{c.db.weeklyPending[0].status='covered'},
  renderTrainingDuration:noop,renderAll:noop,renderNutritionTarget:noop,refreshNutritionDayType:noop,updateNextSetSuggestion:noop,clearSetRows:()=>rows=[],
  toast:text=>c.lastToast=text,setAutosaveStatus:(text,state)=>{c.status={text,state}},cancelRestNotification:noop,releaseWakeLockV21:noop,requestWakeLockV21:noop,scheduleRestNotification:noop,startKeepAlive:noop,
  updateTimer:elapsed=>lastElapsed=elapsed,triggerRestAlert:()=>alerts++,document:{querySelectorAll:()=>[],visibilityState:'visible'},
  restStarted:null,restEndsAt:0,restSec:90,pausedAt:null,restAlerted:false,timerInterval:null,draftTimer:null,
  setTimeout:(fn,ms)=>{timeouts.set(++sequence,{fn,at:clock+ms});return sequence},clearTimeout:id=>timeouts.delete(id),setInterval:()=>1,clearInterval:noop,
  gcHistoryLogs:()=>[],normKey:s=>s,renderPerformanceComparison:noop,renderQuickPlan:noop,activateTab:noop,gcRenderExerciseRoutine40:noop,
  gcLoadContext39:preserve=>{if(!preserve)c.setRest(90)},gcChoose:id=>{byId('exerciseSelect').value=c.exById(id).name;c.loadExerciseContext()},safeClone:structuredClone});
 for(const name of ['gcSetLocal41','gcWriteDb','gcCurrentSlot','hasUnsavedSeries','gcValidSet41','gcConfirmSet41','confirmCurrentSet','currentRestElapsed','currentSession','markTrainingEntry','consumeCoachTargetV22','saveExercise','collectActiveDraft','readDraft','restoreActiveDraft','gcSaveDraft41','clearDraft','writeSnapshot','storeRestEndV21','setRest','startRest','tick','toggleRestV21','syncRestV21','gcFinishBeforeChange41','gcLoad'])vm.runInContext(definition(name),c);
 const start=source.indexOf('loadExerciseContext=function(){',source.indexOf('let gcLoadedExercise40=null;'));vm.runInContext(source.slice(start,source.indexOf('\n};',start)+4),c);
 function addRow({reps='12',weight='30',rir='1',warmup=false,partial=false,drop=false,note=''}={}){
  const nodes={'.reps':{value:reps},'.weight':{value:weight},'.setnote':{value:note},'.warmup':{checked:warmup},'.partial':{checked:partial},'.drop':{checked:drop}},classes=new Set();
  const w={dataset:rir===null?{}:{rir},classList:{add:k=>classes.add(k)},querySelector:s=>nodes[s],querySelectorAll:()=>[]};rows.push(w);return w;
 }
 c.addSetRow=opts=>addRow(opts);Object.defineProperty(byId('sets'),'lastElementChild',{get:()=>rows.at(-1)});Object.defineProperty(byId('sets'),'innerHTML',{set:()=>rows=[]});
 return {c,storage,byId,addRow,setLimit:n=>limit=n,deny:on=>denied=on,advance:ms=>{clock+=ms;c.tick();},elapsed:()=>lastElapsed,alerts:()=>alerts,rows:()=>rows,flush:()=>{for(const [id,t]of [...timeouts]){timeouts.delete(id);t.fn()}},timeouts};
}
test('Snapshot quota is reclaimed without evicting the journal, draft, account or cloud recovery',()=>{
 const h=harness(),latest={ts:3,db:{retained:true}};
 h.storage.set('journal','old');h.storage.set('account','token');h.storage.set('cloud-recovery','copy');h.storage.set('journal_active_draft_v11','active');
 h.storage.set('journal_snapshots_v11',JSON.stringify([{ts:1,db:{text:'x'.repeat(1500)}},{ts:2,db:{text:'y'.repeat(1500)}},latest]));
 h.setLimit(600);h.c.gcSetLocal41('journal','new journal');
 assert.deepEqual(JSON.parse(h.storage.get('journal_snapshots_v11')),[latest]);
 assert.equal(h.storage.get('journal'),'new journal');assert.equal(h.storage.get('journal_active_draft_v11'),'active');assert.equal(h.storage.get('account'),'token');assert.equal(h.storage.get('cloud-recovery'),'copy');
});
test('Snapshots have a bounded two-copy retention instead of filling storage with twelve complete journals',()=>{
 const h=harness();for(let i=0;i<15;i++){h.c.db.profile.iteration=i;h.c.writeSnapshot();}
 const snapshots=JSON.parse(h.storage.get('journal_snapshots_v11'));assert.equal(snapshots.length,2);assert.equal(snapshots[0].db.profile.iteration,13);assert.equal(snapshots[1].db.profile.iteration,14);
});
test('Automatic confirmation starts rest once and immediately persists confirmation, notes and RIR in the draft',()=>{
 const h=harness(),row=h.addRow({note:'Test setup'});assert.equal(h.c.gcConfirmSet41(row,true),true);const end=h.c.restEndsAt;
 const draft=JSON.parse(h.storage.get('journal_active_draft_v11'));assert.equal(draft.rows[0].confirmed,true);assert.equal(draft.rows[0].note,'Test setup');assert.equal(draft.rows[0].rir,'1');
 h.advance(5000);row.dataset.rir='2';assert.equal(h.c.gcConfirmSet41(row,true),false);assert.equal(h.c.restEndsAt,end);assert.equal(h.elapsed(),5);
 h.c.gcConfirmSet41(h.addRow({reps:'15',weight:'25'}),true);assert.equal(row.dataset.restActual,'5');
});
test('Incomplete or invalid sets never confirm automatically; zero added load and missing RIR for manual confirmation remain valid',()=>{
 const h=harness();for(const options of [{reps:''},{weight:''},{reps:'0'},{weight:'-1'},{reps:'NaN'},{rir:null}])assert.equal(h.c.gcConfirmSet41(h.addRow(options),true),false);
 const zero=h.addRow({weight:'0'});assert.equal(h.c.gcConfirmSet41(zero,true),true);
 const manual=h.addRow({rir:null});assert.equal(h.c.gcConfirmSet41(manual),true);
});
test('Storage failure cannot stop confirmation or rest; pause, resume and the alert work without storage',()=>{
 const h=harness(),row=h.addRow();h.deny(true);assert.doesNotThrow(()=>h.c.gcConfirmSet41(row,true));assert.equal(row.dataset.confirmed,'1');
 h.advance(30000);assert.equal(h.elapsed(),30);h.c.toggleRestV21();assert.equal(h.c.pausedAt,30000);h.advance(10000);h.c.toggleRestV21();h.advance(60000);assert.equal(h.elapsed(),90);assert.equal(h.alerts(),1);h.advance(2000);assert.equal(h.alerts(),1);
});
test('Failed Finish rolls back the journal, targets and replacement coverage; retry commits once and cancels stale draft writes',()=>{
 const h=harness(),row=h.addRow();h.c.gcConfirmSet41(row,true);const baseline=JSON.stringify(h.c.db);
 h.deny(true);assert.equal(h.c.saveExercise(),false);assert.equal(JSON.stringify(h.c.db),baseline);assert.equal(h.rows()[0],row);assert.equal(h.c.gcReplacement.slot,'routine:1:row_t');assert.equal(h.c.status.state,'warn');
 h.deny(false);h.c.draftTimer=h.c.setTimeout(()=>h.c.gcSaveDraft41(),120);assert.equal(h.c.saveExercise(),true);h.flush();
 const stored=JSON.parse(h.storage.get('journal')),logs=stored.sessions.flatMap(s=>s.exercises);
 assert.equal(logs.length,1);assert.equal(logs[0].exerciseId,'pullover');assert.equal(logs[0].workoutSlotId,'extra:pullover');assert.equal(logs[0].coversWorkoutSlotId,'routine:1:row_t');assert.equal(logs[0].sets[0].weight,30);assert.equal(stored.coachTargets[0].status,'done');assert.equal(stored.weeklyPending[0].status,'covered');assert.equal(h.rows().length,0);assert.equal(h.storage.has('journal_active_draft_v11'),false);assert.equal(h.c.saveExercise(),false);
});
test('Selecting the next exercise saves confirmed substitution sets and opens a clean exercise; incomplete rows remain assigned to the original',()=>{
 const h=harness();h.c.gcConfirmSet41(h.addRow(),true);assert.equal(h.c.gcLoad({id:'row_uni',workoutSlotId:'routine:1:row_uni'}),true);
 assert.equal(h.c.db.sessions[0].exercises[0].coversWorkoutSlotId,'routine:1:row_t');assert.equal(h.byId('exerciseSelect').value,'Remo unilateral');assert.equal(h.c.gcSelectedSlot,'routine:1:row_uni');
 h.addRow({weight:''});assert.equal(h.c.gcLoad({id:'row_t',workoutSlotId:'routine:1:row_t'}),false);assert.equal(h.byId('exerciseSelect').value,'Remo unilateral');assert.equal(h.rows().length,1);
});
test('A failed automatic Finish blocks reassignment, and a same-exercise context refresh preserves the running rest',()=>{
 const h=harness();h.c.gcConfirmSet41(h.addRow(),true);const end=h.c.restEndsAt;h.advance(8000);h.c.loadExerciseContext();assert.equal(h.c.restEndsAt,end);assert.equal(h.elapsed(),8);
 h.deny(true);h.byId('exerciseSelect').value='Remo T';h.c.loadExerciseContext();assert.equal(h.byId('exerciseSelect').value,'Pullover');assert.equal(h.c.gcSelectedSlot,'extra:pullover');assert.equal(h.c.gcReplacement.slot,'routine:1:row_t');assert.equal(h.rows().length,1);
});
test('Warmups, partials and weight-only drafts are protected on exercise changes',()=>{
 for(const row of [{reps:'',weight:'20',rir:null},{warmup:true},{partial:true},{drop:true}]){const h=harness();h.addRow(row);assert.equal(h.c.hasUnsavedSeries(),true);assert.equal(h.c.gcFinishBeforeChange41(),false);}
});

test('Rest recovery at startup preserves the original 90-second deadline and remaining time',()=>{
 const h=harness();h.c.gcLoadedExercise40=null;h.c.restSec=90;h.c.restEndsAt=Date.now();
 const end=vm.runInContext('Date.now()+90000',h.c);h.c.restEndsAt=end;h.c.loadExerciseContext();assert.equal(h.c.restEndsAt,end);
 h.advance(30000);h.c.syncRestV21();assert.equal(h.elapsed(),30);assert.equal(h.c.restEndsAt,end);h.advance(60000);assert.equal(h.alerts(),1);
});
test('Restoring a draft retains confirmation, notes, rest intervals and replacement coverage without restarting the clock',()=>{
 const h=harness(),row=h.addRow({note:'seat 2'});h.c.gcConfirmSet41(row,true);row.dataset.restActual='35';h.c.gcSaveDraft41();const end=h.c.restEndsAt;
 h.byId('sets').innerHTML='';assert.equal(h.c.restoreActiveDraft(true),true);const restored=h.rows()[0];
 assert.equal(restored.dataset.confirmed,'1');assert.equal(restored.dataset.rir,'1');assert.equal(restored.dataset.restActual,'35');assert.equal(restored.querySelector('.setnote').value,'seat 2');assert.equal(h.c.gcReplacement.slot,'routine:1:row_t');assert.equal(h.c.restEndsAt,end);assert.equal(h.c.gcConfirmSet41(restored,true),false);
});

test('Typing the next search query after confirmation commits the original exercise before releasing its identity',()=>{
 const h=harness();h.c.gcConfirmSet41(h.addRow(),true);h.byId('exerciseSelect').value='Remo';h.c.loadExerciseContext();
 assert.equal(h.c.db.sessions[0].exercises.length,1);assert.equal(h.c.db.sessions[0].exercises[0].exerciseId,'pullover');assert.equal(h.byId('exerciseSelect').value,'Remo');assert.equal(h.c.gcLoadedExercise40,null);assert.equal(h.rows().length,0);
});
