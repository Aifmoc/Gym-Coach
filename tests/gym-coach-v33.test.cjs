const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
function definition(name){
  const matches=[...source.matchAll(new RegExp('^(?:async )?function '+name+'\\(','gm'))];
  const start=matches.at(-1)?.index;assert.notEqual(start,undefined,name);
  const end=source.indexOf('\n',start),line=source.slice(start,end);
  return line.endsWith('}')?line:source.slice(start,source.indexOf('\n}',end)+2);
}
class Element{
  constructor(){this.value='';this.dataset={};this.children=[];this.classes=new Set();this.nodes={};this.textContent='';this.innerHTML='';this.classList={toggle:(x,on)=>{if(on)this.classes.add(x);else this.classes.delete(x)}};}
  querySelector(selector){return this.nodes[selector]||this.children.find(e=>'.'+e.className===selector)||null;}
  querySelectorAll(selector){return this.nodes[selector]||[];}
  appendChild(el){el.parent=this;this.children.push(el);return el;}
  remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
}
const elements=new Map(),byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
let day='2026-10-06',currentSlot='routine:2:triceps_v',coach=null;
const exercise={id:'triceps_v',name:'Tríceps polea V',increment:1,group:'Tríceps'};
const context=vm.createContext({Math,Date,Number,String,db:{sessions:[],settings:{defaultLocation:'Basic Fit Goya'}},today:()=>day,byId,document:{createElement:()=>new Element()},gcCurrentSlot:()=>currentSlot,gcLegacyLogSlot39:x=>x.workoutSlotId,exerciseFromInput:()=>exercise,exById:()=>exercise,coachTargetForV22:()=>coach,plannedItem:()=>({sets:[[8,12,'1'],[10,15,'1']]}),v9UnitLabel:()=> ' kg',fmt:n=>String(Math.round(n*100)/100).replace('.',','),dateLabel:d=>d,escapeHtml:x=>x,prefatigueNote:()=> 'Fatiga previa: solo contexto',refreshSetTargetHintsV22:()=>{},v22CoachScope:()=> 'Basic Fit Goya',v22CoachSetHtml:t=>`${t.weight} kg × ${t.repMin} · RIR ${t.rirLabel}`});
for(const name of ['normKey','gcConfiguration39','gcSameConfiguration39','gcHistoryLogs','gcComparableHistory','comparableLogs','v21FindExact','v21WorkSets','v21RirMin','v21RirHtml','v21Unit','v21SeriesTarget','renderPerformanceComparison','refreshRecordedTargets','exerciseTrendText','todayText','trainingDurationLabel','bestSetOf','e1rm'])vm.runInContext(definition(name),context);
const run=code=>vm.runInContext(code,context);
const log=(id,opts={})=>({id,exerciseId:'triceps_v',workoutSlotId:'routine:2:triceps_v',location:'Basic Fit Goya',machine:'',variant:'',sets:[{weight:13.5,reps:8,rir:0},{weight:10.1,reps:14,rir:1}],...opts});
byId('location').value='Basic Fit Goya';
function test(name,fn){fn();console.log('PASS',name);}
test('Today is the reference, even with a better Saturday mark and an older comparable',()=>{
  context.db.sessions=[{date:'2026-09-29',exercises:[log('previous',{sets:[{weight:17,reps:11,rir:1}]})]},{date:'2026-10-03',exercises:[log('saturday',{workoutSlotId:'routine:6:triceps_v',sets:[{weight:18,reps:11,rir:1}]})]},{date:day,exercises:[log('today')]}];
  assert.equal(run('v21FindExact(exerciseFromInput()).log.id'),'today');
  run('renderPerformanceComparison()');
  assert.match(byId('todayGoal').innerHTML,/13,5 kg × 9/);
  assert.match(byId('todayGoal').innerHTML,/10,1 kg × 15/);
  assert.doesNotMatch(byId('todayGoal').innerHTML,/18 kg/);
  assert.match(byId('lastComparableDate').textContent,/2026-10-06.*mismo slot/);
  assert.match(byId('lastComparableMini').innerHTML,/<div>Serie 1 · 8 × 13,5 · RIR 0<\/div>/);
  assert.match(byId('lastComparableMini').innerHTML,/<div>Serie 2 · 14 × 10,1 · RIR 1<\/div>/);
});
test('Same-day order uses the latest saved execution, never the best',()=>{
  context.db.sessions.at(-1).exercises.push(log('later',{sets:[{weight:10.1,reps:10,rir:1}]}));
  assert.equal(run('v21FindExact(exerciseFromInput()).log.id'),'later');
  context.db.sessions.at(-1).exercises.at(-1).invalid=true;
  assert.equal(run('v21FindExact(exerciseFromInput()).log.id'),'today');
});
test('Wrong slot, missing slot, other gym, machine, variant, invalid and empty work logs are context only',()=>{
  for(const opts of [{workoutSlotId:'routine:6:triceps_v'},{workoutSlotId:null},{location:'Otro gimnasio'},{machine:'Polea 2'},{variant:'Cuff'},{invalid:true},{valid:false},{sets:[{weight:20,reps:20,warmup:true}]}]){
    context.db.sessions=[{date:'2026-10-03',exercises:[log('context',opts)]}];
    assert.equal(run('v21FindExact(exerciseFromInput()).exact'),false);
    run('renderPerformanceComparison()');assert.match(byId('todayGoal').innerHTML,/calibra carga/);assert.doesNotMatch(byId('todayGoal').innerHTML,/13,5 kg/);
  }
});
test('Explicit invalidity, not fatigue, controls exclusion; future data never supplies targets',()=>{
  context.db.sessions=[{date:day,exercises:[log('valid',{notes:'Fatiga acumulada',painScore:2})]},{date:'2026-10-07',exercises:[log('future')]}];
  assert.equal(run('v21FindExact(exerciseFromInput()).log.id'),'valid');
  day='2026-10-07';assert.equal(run('v21FindExact(exerciseFromInput()).log.id'),'future');day='2026-10-06';
});
test('Imported coach targets keep priority in the upper series goals',()=>{
  coach={sets:[{weight:13.5,repMin:9,rirLabel:'1'},{weight:10.1,repMin:15,rirLabel:'1'}]};
  run('renderPerformanceComparison()');assert.match(byId('todayGoal').innerHTML,/COACH/);assert.match(byId('todayGoal').innerHTML,/13.5 kg × 9/);coach=null;
});
function row(reps='',weight='',rir,opts={}){
  const w=new Element();w.nodes['.reps']={value:String(reps)};w.nodes['.weight']={value:String(weight)};
  if(rir!==undefined)w.dataset.rir=String(rir);
  for(const key of ['warmup','partial','drop'])w.nodes['.'+key]={checked:!!opts[key]};
  return w;
}
function goal(){const line=new Element();line.lastElementChild=new Element();line.querySelector=s=>line.lastElementChild.querySelector(s);return line;}
test('Upper targets turn green by registered series, not target achievement; blank rows keep their place',()=>{
  const a=goal(),b=goal(),c=goal();byId('todayGoal').nodes['.v21TargetLine']=[a,b,c];
  const first=row(5,13.5,0),second=row(),third=row(14,10.1,1);
  byId('sets').nodes['.setwrap']=[row(15,5,3,{warmup:true}),first,second,row(8,5,0,{drop:true}),third];
  run('refreshRecordedTargets()');assert.equal(a.classes.has('completed'),true);assert.equal(b.classes.has('completed'),false);assert.equal(c.classes.has('completed'),true);
  assert.equal(a.querySelector('.setCompletionStatus').textContent,'✓ Serie registrada');
  first.nodes['.weight'].value='';run('refreshRecordedTargets()');assert.equal(a.classes.has('completed'),false);assert.equal(a.querySelector('.setCompletionStatus'),null);
  first.nodes['.weight'].value='13.5';first.dataset.rir='';run('refreshRecordedTargets()');assert.equal(a.classes.has('completed'),false);
  first.dataset.rir='0';run('refreshRecordedTargets()');assert.equal(a.classes.has('completed'),true);
  first.nodes['.partial'].checked=true;run('refreshRecordedTargets()');assert.equal(a.classes.has('completed'),false);assert.equal(b.classes.has('completed'),true);
  byId('sets').nodes['.setwrap']=[];run('refreshRecordedTargets()');assert.equal(b.classes.has('completed'),false);assert.equal(b.querySelector('.setCompletionStatus'),null);
});
test('Copy-for-analysis explicitly anchors GC_TARGETS to today; trend ignores another routine slot',()=>{
  context.db.sessions=[{date:'2026-10-03',exercises:[log('saturday',{workoutSlotId:'routine:6:triceps_v'})]},{date:day,exercises:[log('today')]}];
  const text=run('todayText(true)');assert.match(text,/GC_TARGETS siempre parte de la última ejecución válida/);assert.match(text,/incluida la de hoy/);assert.match(text,/nunca sustituyas la última ejecución/);assert.match(text,/sin referencia previa válida del mismo slot/);
});
