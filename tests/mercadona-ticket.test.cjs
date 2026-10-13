const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function definition(name){const start=[...source.matchAll(new RegExp('^function '+name+'\\(','gm'))].at(-1)?.index;assert.notEqual(start,undefined);const end=source.indexOf('\n',start);return source.slice(start,end).endsWith('}')?source.slice(start,end):source.slice(start,source.indexOf('\n}',end)+2);}
function harness(foods=[]){let saved=0;const c=vm.createContext({db:{profile:{foodDbVersion:31},foods,dayFood:{today:[{name:'Existing lunch',kcal:600}]},myPlates:[{items:[{foodIndex:0}]}]},gcStore:()=>saved++});for(const name of ['v22CoachNorm','gcTicketFoods42','foodMacros','suggestedQty'])vm.runInContext(definition(name),c);return {c,saved:()=>saved};}
test('Ticket migration appends missing food rows once and preserves existing indices, custom edits, recipes and diary entries',()=>{
 const edited={name:'Pan Campeón del Mundo rebanado',userEdited:true,kcal:259,p:8.9,c:40.5,f:5.7,unit:'g',base:100},h=harness([edited,{name:'Atún al natural Hacendado',kcal:116}]);const prior=JSON.stringify(h.c.db);
 h.c.gcTicketFoods42();assert.equal(h.c.db.foods[0],edited);assert.equal(h.c.db.foods.length,5);assert.equal(h.c.db.foods[0].kcal,259);assert.equal(h.c.db.myPlates[0].items[0].foodIndex,0);assert.equal(h.c.db.dayFood.today[0].kcal,600);assert.equal(h.c.db.profile.foodDbVersion,31);
 const next=JSON.stringify(h.c.db);h.c.gcTicketFoods42();assert.equal(JSON.stringify(h.c.db),next);assert.equal(h.saved(),1);assert.notEqual(prior,next);
});
test('Median and half bread slices use editable gram estimates consistently with the per-100g reference',()=>{
 const h=harness();h.c.gcTicketFoods42();const bread=h.c.db.foods.find(x=>x.name==='Pan Campeón del Mundo');assert.equal(bread.unit,'g');assert.equal(bread.base,100);assert.equal(bread.estimated,true);
 const amounts=Array.from(bread.portions,x=>x[1]);assert.deepEqual(amounts,[17.5,35,70,105]);
 for(const g of amounts){const m=h.c.foodMacros(bread,g);assert.ok(Math.abs(m.kcal-241*g/100)<1e-8);assert.ok(Math.abs(m.c-36*g/100)<1e-8);}
 assert.equal(Math.round(h.c.foodMacros(bread,35).kcal),84);assert.equal(Math.round(h.c.foodMacros(bread,17.5).kcal),42);assert.equal(h.c.suggestedQty(bread),35);assert.equal(h.c.foodMacros(bread,50).kcal,120.5);
});
test('Official cookie and light coffee labels retain their grams/ml and unknown added sugar; cumin stays an explicit estimate',()=>{
 const h=harness();h.c.gcTicketFoods42();const cookie=h.c.db.foods.find(x=>x.name.startsWith('Digestive')),coffee=h.c.db.foods.find(x=>x.name.startsWith('Café')),cumin=h.c.db.foods.find(x=>x.name.startsWith('Comino'));
 assert.equal(Math.round(h.c.foodMacros(cookie,16.5).kcal),80);assert.equal(cookie.estimated,false);assert.equal(cookie.sugar,31);assert.equal(cookie.addedSugar,null);assert.equal(h.c.suggestedQty(cookie),16.5);
 const cup=h.c.foodMacros(coffee,250);assert.equal(coffee.unit,'ml');assert.equal(coffee.kcal,42);assert.equal(cup.p,7.5);assert.equal(cup.f,2);assert.equal(coffee.addedSugar,null);assert.equal(h.c.suggestedQty(coffee),250);
 assert.equal(cumin.estimated,true);assert.equal(h.c.suggestedQty(cumin),2);assert.equal(cumin.addedSugar,0);assert.match(cumin.note,/no es una etiqueta nutricional de Hacendado/);
 assert.equal(h.c.db.foods.length,4);assert.equal(h.c.db.foods.some(f=>/gel coco|enjuague|serum|desinfect/i.test(f.name)),false);
});
