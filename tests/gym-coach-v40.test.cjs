const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function definition(name){const start=[...source.matchAll(new RegExp('^function '+name+'\\(','gm'))].at(-1).index,end=source.indexOf('\n',start);return source.slice(start,end).endsWith('}')?source.slice(start,end):source.slice(start,source.indexOf('\n}',end)+2);}
function harness(){
  const fields={exerciseSelect:{value:''},location:{value:'Gym'},machine:{value:'Other machine'},variant:{value:'Other variant'}};
  const exercises=[{id:'crunch',name:'Crunch máquina',repMin:12,repMax:20},{id:'row_a',name:'Remo A'},{id:'row_b',name:'Remo B'}];
  const plans={1:{items:[{id:'row_a',sets:[[8,12,'1']]}]},4:{items:[{id:'crunch',sets:[[12,20,'1'],[12,20,'1'],[12,20,'0–1']]}]},5:{items:[{id:'row_b',sets:[[8,12,'1']]}]}};
  const history=[{exerciseId:'crunch',workoutSlotId:'routine:4:crunch',location:'Gym',machine:'',variant:'',sets:[{weight:40,reps:20}]}];
  const c=vm.createContext({Date,Number,String,Math,Set,db:{exercises,coachTargets:[],settings:{defaultLocation:'Gym'}},TRAINING_PLAN_V21:plans,byId:id=>fields[id],gcBaseItems:()=>[{id:'row_b',workoutSlotId:'routine:5:row_b'}],gcHistoryLogs:()=>history,gcTargetSlot39:t=>t.workoutSlotId,gcSlot:(k,id)=>`routine:${k}:${id}`,v21CombinedItems:()=>[{id:'row_b',workoutSlotId:'routine:5:row_b'}],exById:id=>exercises.find(e=>e.id===id),gcComparableHistory:()=>history,v21WorkSets:x=>x?.sets||[],gcSelectedSlot:null,gcReplacement:null});
  for(const name of ['normKey','v22CoachNorm','exerciseFromInput','gcDefaultSlot40','gcCurrentSlot'])vm.runInContext(definition(name),c);
  vm.runInContext(source.slice(source.indexOf('plannedItem=function(id){'),source.indexOf('\n};',source.indexOf('plannedItem=function(id){'))+4),c);
  return {c,fields,history};
}
test('Short accent-insensitive names resolve only one exercise; ambiguous Remo cannot select another exercise',()=>{
  const {c,fields}=harness();fields.exerciseSelect.value='crunch';assert.equal(c.exerciseFromInput().id,'crunch');
  fields.exerciseSelect.value='CRUNCH MAQUINA';assert.equal(c.exerciseFromInput().id,'crunch');
  fields.exerciseSelect.value='Remo';assert.equal(c.exerciseFromInput(),null);
});
test('Off-day Crunch retains its own routine and three prescribed series through search',()=>{
  const {c}=harness();assert.equal(c.gcCurrentSlot('crunch'),'routine:4:crunch');
  assert.equal(c.plannedItem('crunch').sets.length,3);assert.equal(c.gcCurrentSlot('row_b'),'routine:5:row_b');
  c.gcSelectedSlot='extra:crunch';assert.equal(c.plannedItem('crunch').sets.length,2);
});
test('A newly selected exercise loads its own machine and variant; an active draft cannot be silently reassigned',()=>{
  const {c,fields}=harness();fields.exerciseSelect.value='Crunch';
  Object.assign(c,{gcLoadedExercise40:'row_b',hasUnsavedSeries:()=>false,gcLoadContext39:()=>{},gcRenderExerciseRoutine40:()=>{},toast:()=>{}});
  const start=source.indexOf('loadExerciseContext=function(){',source.indexOf('let gcLoadedExercise40=null;'));
  vm.runInContext(source.slice(start,source.indexOf('\n};',start)+4),c);
  c.loadExerciseContext();assert.equal(fields.machine.value,'');assert.equal(fields.variant.value,'');assert.equal(c.gcSelectedSlot,'routine:4:crunch');
  c.hasUnsavedSeries=()=>true;fields.exerciseSelect.value='Remo A';c.loadExerciseContext();
  assert.equal(fields.exerciseSelect.value,'Crunch máquina');assert.equal(c.gcLoadedExercise40,'crunch');
});
test('Read-only cloud repaint updates diet and workout summaries without loading exercise context',()=>{
  const calls=[],dayType={value:''},c=vm.createContext({byId:id=>id==='dayType'?dayType:null,document:{activeElement:null},db:{nutrition:[]},today:()=> '2026-10-09',inferNutritionDayType:()=> 'train'});
  for(const name of ['renderToday','renderTodayPlan','renderDayFoodLog','renderNutritionTarget','renderCoachTargetsV22','renderProfile','renderProgress'])c[name]=()=>calls.push(name);
  vm.runInContext(definition('gcPaintCloudReadOnly40'),c);c.gcPaintCloudReadOnly40();
  assert.ok(calls.includes('renderTodayPlan'));assert.ok(calls.includes('renderDayFoodLog'));assert.ok(calls.includes('renderNutritionTarget'));
});

test('Conflict details look up a dated session even when it also has an ID',()=>{
  const c=vm.createContext({});vm.runInContext(definition('gcConflictValue40'),c);
  assert.equal(c.gcConflictValue40({sessions:[{id:'session-id',date:'2026-10-09',readiness:{weight:70}}]},'sessions[2026-10-09].readiness.weight'),70);
});
