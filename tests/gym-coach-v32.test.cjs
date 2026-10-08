const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source); // Parse the complete app, including the existing code.
function definition(name){
  const re=new RegExp('^(?:async )?function '+name+'\\(','m');
  const start=source.search(re);assert.notEqual(start,-1,name);
  const lineEnd=source.indexOf('\n',start),line=source.slice(start,lineEnd);
  return line.endsWith('}')?line:source.slice(start,source.indexOf('\n}',lineEnd)+2);
}
class Element{
  constructor(){this.value='';this.children=[];this.dataset={};this.html='';this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x)};}
  set innerHTML(s){this.html=s;this.children=[];}
  get innerHTML(){return this.html;}
  append(...children){this.children.push(...children);}
  setAttribute(){}
  focus(){this.focused=true;}
  select(){this.selected=true;}
  querySelectorAll(){return [];}
}
const elements=new Map();
const el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const storage=new Map();
let plan={key:1,rest:false},combined=[];
const context=vm.createContext({console,Math,Date,Number,String,Event,db:{profile:{foodDbVersion:31},foods:[{name:'Existing',userEdited:true}],nutrition:[],settings:{},dayFood:{},sessions:[],weeklyPending:[],exercises:[{id:'row',name:'Remo'}],nutritionTargets:{trainKcal:2350,restKcal:2050,protein:155,trainC:275,restC:215,trainF:65,restF:60}},today:()=> '2026-10-05',dateLabel:d=>d,fmt:n=>Number.isFinite(+n)?String(Math.round(+n*100)/100).replace('.',','):'—',byId:el,document:{createElement:()=>new Element()},localStorage:{setItem:(k,v)=>storage.set(k,v)},APPKEY:'gymCoachDiegoV1',navigator:{clipboard:{writeText:async text=>{context.copied=text;}}},toast:text=>{context.lastToast=text;},workoutPlanSelection:()=>plan,combineSelectionForToday:()=>combined,TRAINING_PLAN_V21:{1:{}},renderNutritionTarget:()=>{},renderFoodSearch:()=>{},exById:id=>context.db.exercises.find(e=>e.id===id),v21CombinedItems:()=>[{id:'row',workoutSlotId:'routine:1:row',sets:[[8,12,1]]}],gcLoad:()=>{},gcMarkPending:()=>{},renderTodayPlan:()=>{},renderQuickPlan:()=>{},escapeHtml:s=>s,renderFoodMatrix:()=>{},renderFoods:()=>{}});
context.gcCloud=null;
for(const name of ['gcWriteDb','v22FoodNorm','gcStore','gcBeverages32','foodMacros','todayFoodLog','dayTotals','currentDayType','nutritionGoal','inferNutritionDayType','refreshNutritionDayType','nutritionDayText','copyNutritionDay','suggestedQty','gcWeek','gcCovered','gcReconcilePending'])vm.runInContext(definition(name),context);
const run=code=>vm.runInContext(code,context);
function test(name,fn){fn();console.log('PASS',name);}
test('Additive beverage migration keeps indices, preserves edits and is idempotent',()=>{
  context.db.foods.push({name:'Coca-Cola Zero',userEdited:true,kcal:0});
  run('gcBeverages32()');
  assert.equal(context.db.foods[0].name,'Existing');
  assert.equal(context.db.foods[1].kcal,0);
  const count=context.db.foods.length;run('gcBeverages32()');assert.equal(context.db.foods.length,count);
  assert.equal(context.db.foods.filter(f=>f.cat==='Bebidas').length,15);
  assert.equal(context.db.profile.foodDbVersion,31);
  assert.equal(context.db.profile.beverageDbVersion,32);
});
test('Wine and beer keep alcohol calories separate from P/C/G; portions use ml',()=>{
  const wine=run("foodMacros(db.foods.find(f=>f.name==='Vino blanco'),150)");
  assert.equal(wine.kcal,120);assert.equal(wine.c,3);
  assert.ok(wine.kcal>wine.p*4+wine.c*4+wine.f*9);
  const beer=run("foodMacros(db.foods.find(f=>f.name==='Cerveza normal'),330)");
  assert.equal(Math.round(beer.kcal),142);assert.ok(Math.abs(beer.c-11.55)<1e-9);
  assert.equal(run("suggestedQty(db.foods.find(f=>f.name==='Vino blanco'))"),150);
  const juice=run("foodMacros(db.foods.find(f=>f.name==='Zumo de naranja 100%'),250)");
  assert.equal(juice.kcal,112.5);assert.equal(juice.addedSugar,0);
});
test('Day copy includes live totals, food quantities, actual targets and correct remaining',()=>{
  el('dayType').value='train';
  context.db.dayFood['2026-10-05']=[{name:'Comida',qty:'200 g',kcal:1600,p:120,c:170,f:45},{name:'Vino blanco',qty:'150 ml',kcal:120,p:0.2,c:3,f:0}];
  const text=run('nutritionDayText()');
  assert.match(text,/1720 kcal/);assert.match(text,/2350 kcal/);assert.match(text,/630 kcal/);
  assert.match(text,/Vino blanco \(150 ml\)/);assert.match(text,/Comida \(200 g\)/);assert.match(text,/Sugiere una cena/);
  el('dayType').value='rest';assert.match(run('nutritionDayText()'),/2050 kcal/);
  el('dayType').value='travel';const travel=run('nutritionDayText()');assert.match(travel,/no hay objetivo calórico estricto/);assert.doesNotMatch(travel,/Restante/);
  el('dayType').value='train';context.db.dayFood['2026-10-05'][0].kcal=2600;
  assert.match(run('nutritionDayText()'),/Por encima del objetivo central: 370 kcal/);
  context.db.dayFood['2026-10-05']=[];assert.match(run('nutritionDayText()'),/Sin alimentos registrados/);
});
test('Day type follows routine/rest and retains manual travel after reload',()=>{
  assert.equal(run('inferNutritionDayType()'),'train');
  plan={key:3,rest:false};assert.equal(run('inferNutritionDayType()'),'rest');
  combined=['1'];assert.equal(run('inferNutritionDayType()'),'train');combined=[];
  context.db.settings.nutritionDayTypes={'2026-10-05':'travel'};
  run('refreshNutritionDayType()');assert.equal(el('dayType').value,'travel');
  assert.equal(run('inferNutritionDayType()'),'travel');context.db.settings.nutritionDayTypes={};plan={key:1,rest:false};
});
test('Green card follows completion of the correct slot, substitution, deletion and week',()=>{
  const override=source.split('\n').find(line=>line.startsWith('renderQuickPlan=function(){'));
  run(override);run('renderQuickPlan()');assert.doesNotMatch(el('quickPlanExercises').children[0].className,/exerciseComplete/);
  context.db.sessions=[{date:'2026-10-05',exercises:[{exerciseId:'row',workoutSlotId:'routine:2:row'}]}];
  run('renderQuickPlan()');assert.doesNotMatch(el('quickPlanExercises').children[0].className,/exerciseComplete/);
  context.db.sessions[0].exercises[0].coversWorkoutSlotId='routine:1:row';
  run('renderQuickPlan()');assert.match(el('quickPlanExercises').children[0].className,/exerciseComplete/);
  context.db.sessions[0].exercises=[];run('renderQuickPlan()');assert.doesNotMatch(el('quickPlanExercises').children[0].className,/exerciseComplete/);
  context.db.sessions=[{date:'2026-09-28',exercises:[{workoutSlotId:'routine:1:row'}]}];
  run('renderQuickPlan()');assert.doesNotMatch(el('quickPlanExercises').children[0].className,/exerciseComplete/);
  context.db.sessions=[];
});
(async()=>{
  await run('copyNutritionDay()');assert.match(context.copied,/NUTRICIÓN/);
  context.navigator.clipboard.writeText=async()=>{throw Error('Permission denied');};
  await run('copyNutritionDay()');assert.equal(el('nutritionCopyFallback').classes.has('hidden'),false);assert.equal(el('nutritionDayText').selected,true);
  console.log('PASS clipboard success and selected-text fallback');
})().catch(error=>{console.error(error);process.exitCode=1;});
