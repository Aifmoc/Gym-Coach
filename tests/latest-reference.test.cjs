const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function definition(name){const start=[...source.matchAll(new RegExp('^function '+name+'\\(','gm'))].at(-1)?.index;assert.notEqual(start,undefined,name);const end=source.indexOf('\n',start);return source.slice(start,end).endsWith('}')?source.slice(start,end):source.slice(start,source.indexOf('\n}',end)+2);}
function harness(){
 const fields={location:{value:'Test gym'},machine:{value:''},variant:{value:''},loadUnit:{value:'added_kg'},baseLoad:{value:'50'}};
 const c=vm.createContext({Date,Number,String,Math,Set,db:{sessions:[],coachTargets:[],settings:{}},today:()=> '2026-10-15',byId:id=>fields[id],gcCurrentSlot:()=> 'routine:4:test',gcLegacyLogSlot39:log=>log.workoutSlotId,gcTargetSlot39:t=>t.workoutSlotId});
 for(const name of ['normKey','gcConfiguration39','gcSameConfiguration39','v21WorkSets','gcHistoryLogs','gcComparableHistory','comparableLogs','v21FindExact','gcContextReference43','v22ParseRange','v22ParseTargetSet'])vm.runInContext(definition(name),c);
 return {c,fields};
}
const log=(id,baseLoad,extra={})=>({id,exerciseId:'test',workoutSlotId:'routine:4:test',location:'Test gym',machine:'',variant:'',loadUnit:'added_kg',baseLoad,sets:[{weight:20,reps:10,rir:1}],...extra});
test('The current base load reaches every historical comparison, selecting today instead of an August record without base metadata',()=>{
 const {c,fields}=harness();c.db.sessions=[{date:'2026-08-27',exercises:[log('august',null)]},{date:'2026-10-08',exercises:[log('previous',50)]},{date:'2026-10-15',exercises:[log('today',50)]}];
 for(const base of [50,22.7,30.4,0]){fields.baseLoad.value=String(base);c.db.sessions[1].exercises[0].baseLoad=base;c.db.sessions[2].exercises[0].baseLoad=base;const reference=c.v21FindExact({id:'test'});assert.equal(reference.log.id,'today');assert.equal(reference.exact,true);}
});
test('Updating the current base/unit changes the reference without combining incompatible configurations',()=>{
 const {c,fields}=harness();c.db.sessions=[{date:'2026-10-14',exercises:[log('old-base',40)]},{date:'2026-10-15',exercises:[log('new-base',50),log('different-unit',50,{loadUnit:'kg_per_side'}),log('different-machine',50,{machine:'Machine 2'})]}];
 assert.equal(c.comparableLogs('test','')[0].id,'new-base');fields.baseLoad.value='40';assert.equal(c.comparableLogs('test','')[0].id,'old-base');fields.baseLoad.value='99';assert.equal(c.comparableLogs('test','').length,0);assert.equal(c.v21FindExact({id:'test'}).exact,false);
 fields.baseLoad.value='50';fields.loadUnit.value='kg_per_side';assert.equal(c.comparableLogs('test','')[0].id,'different-unit');
});
test('The pasted kg/RIR format accepts decimal commas, ranges and multiplication signs without changing legacy imports',()=>{
 const {c}=harness();const a=c.v22ParseTargetSet('37,5 kg × 10-11@RIR1');assert.equal(a.weight,37.5);assert.equal(a.repMin,10);assert.equal(a.repMax,11);assert.equal(a.rirMin,1);
 const b=c.v22ParseTargetSet('35 KG x 10@RIR1-2');assert.equal(b.rirMax,2);assert.equal(c.v22ParseTargetSet('32.5 x 12@1').weight,32.5);assert.equal(c.v22ParseTargetSet('35 lb x 10@1'),null);
});
test('Only an explicit new baseline selects an unrecorded technique, and a later execution keeps its own configuration',()=>{
 const {c}=harness();c.db.sessions=[{date:'2026-10-09',exercises:[log('short-ROM',null,{variant:'Short ROM'})]}];
 c.db.coachTargets=[{exerciseId:'test',workoutSlotId:'routine:4:test',location:'Test gym',machine:'',variant:'Full ROM',createdAt:'2026-10-15T18:00:00Z',status:'pending'}];
 assert.equal(c.gcContextReference43('test','routine:4:test','Test gym').id,'short-ROM');c.db.coachTargets[0].newBaseline=true;assert.equal(c.gcContextReference43('test','routine:4:test','Test gym').variant,'Full ROM');
 c.db.sessions.push({date:'2026-10-15',exercises:[log('full-ROM',null,{variant:'Full ROM',savedAt:'2026-10-15T19:00:00Z'})]});assert.equal(c.gcContextReference43('test','routine:4:test','Test gym').id,'full-ROM');
});
