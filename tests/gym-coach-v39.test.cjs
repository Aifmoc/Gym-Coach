const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function definition(name){const start=[...source.matchAll(new RegExp('^function '+name+'\\(','gm'))].at(-1).index,end=source.indexOf('\n',start);return source.slice(start,end).endsWith('}')?source.slice(start,end):source.slice(start,source.indexOf('\n}',end)+2);}
function harness(){
 const plans={1:{items:[{id:'reverse'},{id:'row_t'}]},2:{items:[{id:'triceps_v'},{id:'military'}]},5:{items:[{id:'pulldown_bi'},{id:'row_bi'},{id:'reverse'}]},6:{items:[{id:'triceps_v'},{id:'inc_plate'}]}};
 const ctx=vm.createContext({Date,Number,String,Math,Set,db:{sessions:[],settings:{workoutOverrides:{},combine:{}}},today:()=> '2026-10-09',TRAINING_PLAN_V21:plans,gcSlot:(k,id)=>`routine:${k}:${id}`,v21WorkSets:x=>x.sets.filter(s=>s.reps>0&&s.weight>0&&!s.warmup)});
 for(const name of ['normKey','gcConfiguration39','gcSameConfiguration39','gcLegacyLogSlot39','gcTargetSlot39','gcHistoryLogs','gcComparableHistory'])vm.runInContext(definition(name),ctx);
 return ctx;
}
const log=(exerciseId,extra={})=>({exerciseId,location:'Goya',machine:'',variant:'',baseLoad:null,sets:[{weight:73,reps:7,rir:1}],...extra});
test('Legacy Pull B history is recovered using the moved session and never mutates stored logs',()=>{
 const c=harness();c.db.settings.workoutOverrides['2026-10-02']='5';c.db.sessions=[{date:'2026-10-02',exercises:[log('pulldown_bi'),log('reverse')]}];
 const original=JSON.stringify(c.db),scope=log('reverse',{workoutSlotId:'routine:5:reverse'});
 assert.equal(c.gcComparableHistory(scope)[0].date,'2026-10-02');assert.equal(JSON.stringify(c.db),original);
 assert.equal(c.gcTargetSlot39({...scope,workoutSlotId:undefined,createdAt:'2026-10-02T15:00:00Z'}),'routine:5:reverse');
});
test('Ambiguous legacy slots and explicit different slots never replace the current reference',()=>{
 const c=harness();c.db.sessions=[{date:'2026-10-07',exercises:[log('reverse')]},{date:'2026-10-08',exercises:[log('reverse',{workoutSlotId:'routine:1:reverse'})]}];
 assert.equal(c.gcComparableHistory(log('reverse',{workoutSlotId:'routine:5:reverse'})).length,0);
});
test('Known outside machine labels match the combined form field while inside, locations and units stay separate',()=>{
 const c=harness(),a=log('row_bi',{machine:'Polea fuera'}),b=log('row_bi',{variant:'Fuera'});
 assert.equal(c.gcSameConfiguration39(a,b),true);
 for(const extra of [{variant:'Dentro'},{location:'Otro gym'},{machine:'Otra polea',variant:''},{baseLoad:10}])assert.equal(c.gcSameConfiguration39(a,{...b,...extra}),false);
 assert.equal(c.gcSameConfiguration39({...a,loadUnit:'per_side_kg'},{...b,loadUnit:'total_kg'}),false);
});
test('The latest valid comparable execution wins even when older or other-slot marks are better',()=>{
 const c=harness();c.db.sessions=[{date:'2026-10-03',exercises:[log('triceps_v',{workoutSlotId:'routine:6:triceps_v',sets:[{weight:18,reps:11,rir:1}]})]},{date:'2026-10-06',exercises:[log('triceps_v',{workoutSlotId:'routine:2:triceps_v',sets:[{weight:13.5,reps:8,rir:0}]})]}];
 assert.equal(c.gcComparableHistory(log('triceps_v',{workoutSlotId:'routine:2:triceps_v'}))[0].sets[0].weight,13.5);
});
test('Archived reports cannot override the target selector, and null base loads stay blank',()=>{
 const start=source.indexOf('function gcStartAutomaticCoach38'),end=source.indexOf('let gcCloudViewPending39',start);
 assert.doesNotMatch(source.slice(start,end),/coachTargetForV22\s*=/);
 assert.match(definition('loadVariantMeta'),/m\.baseLoad!=null/);
 assert.match(definition('saveExercise'),/const _coach=coachTargetForV22\(e\).*exercises\.push\(log\)/);
 assert.match(html,/Gym Coach v39/);
});
