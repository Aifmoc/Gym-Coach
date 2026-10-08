const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pack,unpack,merge}=require('../cloud-sync.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
function definition(name){
  const start=[...source.matchAll(new RegExp('^function '+name+'\\(','gm'))].at(-1)?.index;
  assert.notEqual(start,undefined,name);
  const end=source.indexOf('\n',start),line=source.slice(start,end);
  return line.endsWith('}')?line:source.slice(start,source.indexOf('\n}',end)+2);
}
function harness(){
  let clock=Date.parse('2026-10-08T10:00:00Z'),day='2026-10-08',saved;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
  const elements=new Map();
  const byId=id=>{
    if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',listeners:{},classes:new Set(),
      classList:{toggle(name,on){const c=elements.get(id).classes;if(on)c.add(name);else c.delete(name);}},
      addEventListener(type,fn){this.listeners[type]=fn;},querySelectorAll(){return [];}});
    return elements.get(id);
  };
  const exercise={id:'row',name:'Remo',group:'Espalda',increment:2.5};
  const noop=()=>{};
  const context=vm.createContext({Date:Clock,Number,String,Math,db:{sessions:[],profile:{},exercises:[exercise],foods:[]},today:()=>day,byId,
    gcWriteDb:()=>{saved=JSON.stringify(context.db);},dateLabel:d=>d,fmt:String,exById:()=>exercise,exerciseTrendText:()=>'',
    toast:noop,startRest:noop,updateNextSetSuggestion:noop,restStarted:null,restEndsAt:0,pausedAt:null,
    ensureExerciseFromInput:()=>({exercise,isNew:false}),saveVariantMeta:()=>({loadUnit:'total_kg',variantKey:'row|goya'}),
    rawSetText:()=>'',gcCurrentSlot:()=> 'routine:1:row',gcReplacement:null,
    refreshNutritionDayType:noop,consumeCoachTargetV22:noop,gcCompletePending:noop,persist:()=>{saved=JSON.stringify(context.db);},
    clearSetRows:noop,storeRestEndV21:noop,cancelRestNotification:noop,releaseWakeLockV21:noop,updateTimer:noop});
  for(const name of ['currentSession','markTrainingEntry','trainingDurationLabel','renderTrainingDuration','bindTrainingTimeListeners','todayText','currentRestElapsed','confirmCurrentSet','saveExercise'])vm.runInContext(definition(name),context);
  context.bindTrainingTimeListeners();
  function event(selector,{type='input',value='8',invalid=false}={}){
    const target={value,type:'number',valueAsNumber:invalid?NaN:Number(value),matches:s=>s.split(',').includes(selector),closest:s=>s.split(',').includes(selector)?target:null};
    byId('record').listeners[type]({type,target});
  }
  return {context,byId,event,setMinutes:m=>{clock=Date.parse('2026-10-08T10:00:00Z')+m*60000;},setDay:d=>{day=d;},saved:()=>JSON.parse(saved)};
}
test('Time starts on data entry, not opening, selecting, blank or invalid fields; RIR and zero load count',()=>{
  const h=harness();
  h.event('#exerciseSelect');h.event('#preWeight');h.event('[data-score] button',{type:'click'});h.event('.reps',{value:''});h.event('.weight',{invalid:true});h.event('#restoreDraft',{type:'click'});
  assert.equal(h.context.db.sessions.length,0);
  h.event('.reps',{value:'8'});
  const start=h.context.db.sessions[0].startedAt;
  h.setMinutes(5);h.event('.rirbtn',{type:'click'});
  h.setMinutes(10);h.event('.weight',{value:'0'});
  assert.equal(h.context.db.sessions[0].startedAt,start);
  assert.equal(h.context.trainingDurationLabel(h.saved().sessions[0]),'10 min');
  assert.match(h.byId('trainingDuration').innerHTML,/10 min/);
  assert.equal(h.byId('trainingDuration').classes.has('hidden'),false);
});
test('Series confirmation and exercise finish extend the interval; copying later does not',()=>{
  const h=harness();h.event('.weight',{value:'25'});
  const fields={'.reps':{value:'10'},'.weight':{value:'25'},'.warmup':{checked:false},'.partial':{checked:false},'.drop':{checked:false},'.setnote':{value:''}};
  const wrap={dataset:{rir:'1'},classList:{add(){}},querySelector:s=>fields[s]};
  h.byId('sets').querySelectorAll=()=>[wrap];
  h.setMinutes(20);h.context.confirmCurrentSet();
  assert.equal(h.context.trainingDurationLabel(h.context.db.sessions[0]),'20 min');
  h.setMinutes(68);h.context.saveExercise();
  assert.equal(h.context.trainingDurationLabel(h.saved().sessions[0]),'1 h 8 min');
  const before=JSON.stringify(h.context.db.sessions);
  h.setMinutes(120);
  for(const prompt of [false,true])assert.match(h.context.todayText(prompt),/Duración registrada: 1 h 8 min/);
  assert.equal(JSON.stringify(h.context.db.sessions),before);
});
test('Reopening a persisted session preserves start; a new date gets its own interval',()=>{
  const h=harness();h.event('.reps');h.setMinutes(35);h.event('.reps');
  const reloaded=harness();reloaded.context.db=h.saved();reloaded.setMinutes(50);reloaded.event('.reps');
  assert.equal(reloaded.context.trainingDurationLabel(reloaded.context.db.sessions[0]),'50 min');
  reloaded.setDay('2026-10-09');reloaded.setMinutes(1440);reloaded.event('.reps');
  assert.equal(reloaded.context.db.sessions.length,2);
  assert.equal(reloaded.context.trainingDurationLabel(reloaded.context.db.sessions[1]),'0 min');
});
test('Cloud transfer preserves timestamps and combines the earliest start and latest entry across devices',()=>{
  const h=harness();h.event('.reps');h.setMinutes(25);h.event('.reps');
  const base=h.saved();
  const local=structuredClone(base),remote=structuredClone(base);
  local.sessions[0].startedAt-=60000;local.sessions[0].lastEntryAt+=60000;
  remote.sessions[0].startedAt-=120000;remote.sessions[0].lastEntryAt+=120000;
  const result=merge(pack(base),pack(local),pack(remote));
  assert.deepEqual(result.conflicts,[]);
  const transferred=unpack(result.value);
  assert.equal(transferred.sessions[0].startedAt,remote.sessions[0].startedAt);
  assert.equal(transferred.sessions[0].lastEntryAt,remote.sessions[0].lastEntryAt);
  assert.equal(h.context.trainingDurationLabel(transferred.sessions[0]),'29 min');
});
test('Old sessions and malformed timestamps never invent a duration',()=>{
  const h=harness();h.context.db.sessions=[{date:'2026-10-08',exercises:[{exerciseId:'row',sets:[]}]}];
  assert.match(h.context.todayText(true),/Duración registrada: no disponible/);
  for(const ss of [{},{startedAt:null,lastEntryAt:null},{startedAt:0,lastEntryAt:1},{startedAt:20,lastEntryAt:10},{startedAt:NaN,lastEntryAt:10}])assert.equal(h.context.trainingDurationLabel(ss),'');
  h.context.renderTrainingDuration();assert.equal(h.byId('trainingDuration').classes.has('hidden'),true);
});
