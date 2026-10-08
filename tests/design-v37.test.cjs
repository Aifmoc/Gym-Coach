const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function definition(name){
  const start=[...source.matchAll(new RegExp('^function '+name+'\\(','gm'))].at(-1)?.index;
  assert.notEqual(start,undefined,name);
  const end=source.indexOf('\n',start),line=source.slice(start,end);
  return line.endsWith('}')?line:source.slice(start,source.indexOf('\n}',end)+2);
}
test('Remaining macros distinguish an excess, a reached target and a travel day without a target',()=>{
  const c=vm.createContext({Number,Math,fmt:String});vm.runInContext(definition('gcRemaining37'),c);
  assert.equal(c.gcRemaining37(2300,1880).value,'420');
  assert.equal(c.gcRemaining37(2300,2500).caption,'Por encima');
  assert.equal(c.gcRemaining37(2300,2500).value,'200');
  assert.equal(c.gcRemaining37(140,140).caption,'Objetivo alcanzado');
  assert.equal(c.gcRemaining37(null,2000).caption,'Sin objetivo fijo');
  assert.equal(c.gcRemaining37(null,2000).value,'—');
});
test('Session overview uses slot coverage and replacements, deduplicates pending slots, and counts real work sets',()=>{
  const c=vm.createContext({Map,db:{sessions:[{date:'2026-10-08',exercises:[{sets:[{reps:8},{reps:5,warmup:true},{reps:4,drop:true},{reps:0}]}]}]},
    today:()=> '2026-10-08',trainingDurationLabel:()=> '45 min',
    v21CombinedItems:()=>[{id:'a',workoutSlotId:'routine:4:a'},{id:'b',workoutSlotId:'routine:4:b'},{id:'a',workoutSlotId:'routine:4:a'}],
    gcCovered:slot=>slot==='routine:4:a'});
  vm.runInContext(definition('gcOverview37'),c);const x=c.gcOverview37();
  assert.equal(x.done,1);assert.equal(x.total,2);assert.equal(x.next.id,'b');assert.equal(x.series,1);assert.equal(x.duration,'45 min');
});
test('Switching to v36 and back changes only a device UI preference; data and account stay intact',()=>{
  const old=fs.readFileSync(path.join(root,'v36/index.html'),'utf8');
  const data=new Map([['gymCoachDiegoV1','personal-records'],['gymCoachCloudV1_session','same-account'],['gymCoachUiVersion','36']]);
  const location={href:'https://aifmoc.github.io/Gym-Coach/',replace(url){this.redirect=url;}};
  const c=vm.createContext({URL,location,localStorage:{getItem:k=>data.get(k),removeItem:k=>data.delete(k)}});
  const redirect=html.match(/<script data-ui-preference>([\s\S]*?)<\/script>/)[1];vm.runInContext(redirect,c);
  assert.equal(location.redirect,'https://aifmoc.github.io/Gym-Coach/v36/');
  const back=old.match(/onclick="(localStorage.removeItem\('gymCoachUiVersion'\);location.href='\.\.\/')"/)[1];vm.runInContext(back,c);
  assert.equal(data.has('gymCoachUiVersion'),false);assert.equal(location.href,'../');
  assert.equal(data.get('gymCoachDiegoV1'),'personal-records');assert.equal(data.get('gymCoachCloudV1_session'),'same-account');
  assert.match(old,/Gym Coach v36/);assert.doesNotMatch(old,/gcInitUx37/);
  for(const file of ['cloud-sync.js','cloud-config.js'])assert.equal(fs.readFileSync(path.join(root,file),'utf8'),fs.readFileSync(path.join(root,'v36',file),'utf8'));
});
test('Main service worker never stores the v36 page as the v37 offline shell',()=>{
  const handlers={};let responded=false;
  const c=vm.createContext({URL,encodeURIComponent,self:{registration:{scope:'https://aifmoc.github.io/Gym-Coach/'},addEventListener:(type,fn)=>handlers[type]=fn}});
  vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),c);
  handlers.fetch({request:{url:'https://aifmoc.github.io/Gym-Coach/v36/index.html'},respondWith(){responded=true;}});
  assert.equal(responded,false);
  assert.match(fs.readFileSync(path.join(root,'.github/workflows/pages.yml'),'utf8'),/cp -R v36 _site\/v36/);
});
