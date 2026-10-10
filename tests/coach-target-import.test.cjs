const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function definition(name){const start=[...source.matchAll(new RegExp('^function '+name+'\\(','gm'))].at(-1).index,end=source.indexOf('\n',start);return source.slice(start,end).endsWith('}')?source.slice(start,end):source.slice(start,source.indexOf('\n}',end)+2);}
function harness(){
 const fields={coachTargetInput:{value:''},coachTargetImportStatus:{innerHTML:''},location:{value:'Test Gym'},machine:{value:''},variant:{value:''},loadUnit:{value:'added_kg'},baseLoad:{value:'22.7'}};
 const e={id:'hipthrust',name:'Hip thrust máquina'};
 const ctx=vm.createContext({Date,Number,String,Math,Set,db:{coachTargets:[],exercises:[e],settings:{coachImportDay:'5'}},byId:id=>fields[id],gcImportSlot:()=> 'routine:5:hipthrust',gcValidSlot:slot=>['routine:4:hipthrust','routine:6:hipthrust'].includes(slot),gcWriteDb:()=>{},renderCoachTargetsV22:()=>{},renderPerformanceComparison:()=>{},updateNextSetSuggestion:()=>{},refreshSetTargetHintsV22:()=>{},toast:()=>{},gcCurrentSlot:()=> 'routine:6:hipthrust',gcTargetSlot39:t=>t.workoutSlotId,gcComparableHistory:()=>[]});
 for(const name of ['normKey','v22CoachNorm','v22ParseRange','v22ParseTargetSet','v22FindExerciseByName','gcConfiguration39','gcSameConfiguration39','gcSameTargetConfiguration41','importCoachTargetsV22'])vm.runInContext(definition(name),ctx);
 const start=source.lastIndexOf('coachTargetForV22=function(e){');vm.runInContext(source.slice(start,source.indexOf('\n};',start)+4),ctx);
 return {ctx,fields,e};
}
test('Import accepts the pasted RIR and middle-dot series format with an explicit destination',()=>{
 const {ctx,fields,e}=harness();fields.coachTargetInput.value='GC_TARGETS\nHip thrust máquina | Test Gym | slot=routine:6:hipthrust | 30 x 12-13@RIR1 · 27,5 x 13-15@RIR1';
 ctx.importCoachTargetsV22();assert.equal(ctx.db.coachTargets.length,1);const t=ctx.db.coachTargets[0];
 assert.equal(t.sets.length,2);assert.equal(t.sets[0].weight,30);assert.equal(t.sets[1].weight,27.5);assert.equal(t.sets[1].repMax,15);assert.equal(ctx.coachTargetForV22(e).id,t.id);
});
test('A sticky destination for another routine rejects the import and names the destination problem',()=>{
 const {ctx,fields}=harness();fields.coachTargetInput.value='GC_TARGETS\nHip thrust máquina | Test Gym | 30 x 12-13@RIR1 · 27,5 x 13-15@RIR1';
 ctx.importCoachTargetsV22();assert.equal(ctx.db.coachTargets.length,0);assert.match(fields.coachTargetImportStatus.innerHTML,/día de destino elegido/);
});
test('Legacy pipe separators and numeric RIR still import both sets',()=>{
 const {ctx,fields}=harness();fields.coachTargetInput.value='Hip thrust máquina | Test Gym | slot=routine:6:hipthrust | 30 x 12-13@1 | 27,5 x 13-15@1';ctx.importCoachTargetsV22();
 assert.equal(ctx.db.coachTargets[0].sets.length,2);assert.equal(ctx.v22ParseTargetSet('30 x 12@RIRno'),null);
});
test('Unspecified target units/base allow the configured machine, while explicit metadata and configurations stay separate',()=>{
 const {ctx}=harness(),target={location:'Test Gym',machine:'',variant:''},scope={...target,baseLoad:22.7,loadUnit:'added_kg'};
 assert.equal(ctx.gcSameTargetConfiguration41(target,scope),true);
 assert.equal(ctx.gcSameConfiguration39(target,scope),false); // historical comparisons remain strict
 for(const change of [{location:'Another Gym'},{machine:'Another machine'},{variant:'Another variant'},{baseLoad:30},{baseLoad:null},{loadUnit:'total_kg'}])assert.equal(ctx.gcSameTargetConfiguration41({...target,...change},scope),false);
});
