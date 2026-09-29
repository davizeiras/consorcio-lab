import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,simulate} from '../public/engine.js';
import {STORAGE_KEY,MAX_PLANS,MAX_IMPORT_BYTES,listPlans,savePlan,getPlan,removePlan,parseImport} from '../public/storage.js';
const fixture=()=>({config:{...DEFAULTS,indexVariant:'manual',forecastAnnual:0,insuranceMonthly:0},index:{points:[],provenance:'manual'}});
function memory(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
const id=i=>'11111111-1111-4111-8111-'+String(i).padStart(12,'0');
test('guardar, abrir e excluir funcionam sem conta; outro navegador não vê os planos',()=>{
 const a=memory(),b=memory();assert.deepEqual(listPlans(a),[]);
 const saved=savePlan(a,fixture(),{id:id(1)});assert.equal(listPlans(a).length,1);assert.equal(listPlans(b).length,0);assert.equal(getPlan(a,saved.id).config.credit,150000);assert.throws(()=>getPlan(b,saved.id),/não encontrada/);
 removePlan(a,saved.id);assert.deepEqual(listPlans(a),[]);
});
test('o histórico e as escolhas são preservados na cópia local, sem armazenar resultados derivados',()=>{
 const a=memory(),f=fixture();f.config.name='Meu imóvel';f.config.startMonth='2020-01';f.index.points=[{month:'2020-01',percent:0.71}];const expected=simulate(f.config,f.index);
 const saved=savePlan(a,{...f,result:{final:{assets:999999999}}},{id:id(2)}),loaded=getPlan(a,saved.id);
 assert.equal(loaded.config.name,'Meu imóvel');assert.deepEqual(loaded.index.points,f.index.points);assert.equal(loaded.index.status,'snapshot');assert.equal(loaded.result,undefined);assert.equal(simulate(loaded.config,loaded.index).final.assets,expected.final.assets);
});
test('JSON da versão anterior é aceito; resultados forjados são ignorados e o histórico é marcado como informado',()=>{
 const f=fixture();f.index.provenance='bcb';f.index.points=[{month:'2020-01',percent:0.5}];f.config.scenario='sale';
 const loaded=parseImport('\uFEFF'+JSON.stringify({version:'1.0.0',...f,result:{final:{result:1e30}}}));
 assert.equal(loaded.config.scenario,'sale');assert.equal(loaded.index.provenance,'manual');assert.equal(loaded.index.imported,true);assert.equal(loaded.result,undefined);assert.notEqual(simulate(loaded.config,loaded.index).final.result,1e30);
});
test('importação rejeita arquivo inválido, muito grande ou com valores e índices inconsistentes',()=>{
 assert.throws(()=>parseImport('não é JSON'),/JSON/);assert.throws(()=>parseImport('{}'),/não contém uma simulação/);assert.throws(()=>parseImport(' '.repeat(MAX_IMPORT_BYTES+1)),/2 MB/);
 const f=fixture();f.config.term=0;assert.throws(()=>parseImport(JSON.stringify(f)),/Prazo/);f.config.term=220;f.index.points=[{month:'2020-01',percent:'0.5'}];assert.throws(()=>parseImport(JSON.stringify(f)),/Índices/);
});
test('falha ao guardar preserva a cópia anterior e oferece baixar o arquivo',()=>{
 const a=memory();savePlan(a,fixture(),{id:id(3)});const before=a.getItem(STORAGE_KEY);
 const quota={getItem:a.getItem,setItem(){throw new Error('QuotaExceededError')}};assert.throws(()=>savePlan(quota,fixture(),{id:id(4)}),/Baixe o arquivo/);assert.equal(a.getItem(STORAGE_KEY),before);
 const blocked={getItem(){throw new Error('SecurityError')}};assert.throws(()=>listPlans(blocked),/bloqueou/);
});
test('dados locais corrompidos não são apagados nem substituídos automaticamente',()=>{
 const a=memory();a.setItem(STORAGE_KEY,'arquivo anterior corrompido');assert.throws(()=>listPlans(a),/preservados/);assert.throws(()=>savePlan(a,fixture(),{id:id(5)}),/preservados/);assert.equal(a.getItem(STORAGE_KEY),'arquivo anterior corrompido');
});
test('limite de planos mantém os existentes e a exclusão libera espaço',()=>{
 const a=memory();for(let i=1;i<=MAX_PLANS;i++)savePlan(a,fixture(),{id:id(i)});const before=a.getItem(STORAGE_KEY);
 assert.throws(()=>savePlan(a,fixture(),{id:id(99)}),/50 simulações/);assert.equal(a.getItem(STORAGE_KEY),before);removePlan(a,id(1));savePlan(a,fixture(),{id:id(99)});assert.equal(listPlans(a).length,MAX_PLANS);
});
