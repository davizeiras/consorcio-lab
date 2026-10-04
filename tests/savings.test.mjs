import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,simulate} from '../public/engine.js';
import {DEFAULT_SAVINGS_RATE,simulateSavings,normalizeComparison} from '../public/savings.js';
import {savePlan,getPlan,parseImport} from '../public/storage.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
const payments=(n,value)=>Array.from({length:n},(_,i)=>({month:i+1,date:'2026-01',outflow:value}));
const config=overrides=>({...DEFAULTS,credit:100000,term:120,horizon:120,contemplationMonth:48,saleMonth:48,indexVariant:'manual',forecastAnnual:0,insuranceMonthly:0,...overrides});

test('taxa zero conserva os depósitos e não inventa ganho ou ROI',()=>{
 const original=payments(120,250),copy=structuredClone(original),r=simulateSavings(original,0);
 assert.equal(r.final.balance,30000);assert.equal(r.final.profit,0);assert.equal(r.final.roiPercent,0);assert.deepEqual(original,copy);
 assert.equal(simulateSavings(payments(2,0)).final.roiPercent,null);
});
test('juros compostos coincidem com a fórmula de depósitos no fim do mês',()=>{
 const rate=0.5,n=60,deposit=337.27,r=simulateSavings(payments(n,deposit),rate);
 close(r.final.balance,deposit*((1+rate/100)**n-1)/(rate/100));
 assert.equal(r.rows[0].interest,0);close(r.rows[1].interest,deposit*rate/100);
 close(r.final.roiPercent,r.final.profit/(n*deposit)*100);
});
test('a comparação inclui lance próprio, ignora lance embutido e para os depósitos após a venda',()=>{
 const plan=simulate(config({scenario:'sale',bidType:'free',ownBidPercent:10,embeddedBidPercent:10})),s=simulateSavings(plan.rows,0.5);
 close(s.rows[47].deposit,plan.rows[47].installment+10000);
 close(s.rows[47].totalDeposited,39680);close(s.final.totalDeposited,39680);
 assert.ok(s.rows.slice(48).every(row=>row.deposit===0));
 close(s.final.balance,s.rows[47].balance*1.005**72);
 for(let i=0;i<plan.rows.length;i++)close(s.rows[i].totalDeposited,plan.rows[i].totalPaid);
});
test('reajustes, seguro e taxas viram depósitos nas mesmas datas, sem antecipar a última parcela',()=>{
 const plan=simulate(config({term:60,horizon:84,contemplationMonth:60,insuranceMonthly:30,insuranceBefore:true,forecastAnnual:6}));
 const s=simulateSavings(plan.rows,0.5);
 for(let i=0;i<plan.rows.length;i++){close(s.rows[i].deposit,plan.rows[i].outflow);close(s.rows[i].totalDeposited,plan.rows[i].totalPaid);}
 assert.ok(s.rows[59].deposit>s.rows[0].deposit*20);
 close(s.rows[59].interest,s.rows[58].balance*0.005);
 assert.ok(s.rows.slice(60).every(row=>row.deposit===0));
});
test('taxas inválidas, fluxos negativos e meses fora de ordem são rejeitados',()=>{
 for(const rate of [null,'',NaN,Infinity,-0.1,10.1,'0.5'])assert.throws(()=>simulateSavings(payments(2,100),rate),/taxa mensal/);
 assert.throws(()=>simulateSavings([]),/600 meses/);
 assert.throws(()=>simulateSavings([{month:1,outflow:-1}]),/depósitos/);
 assert.throws(()=>simulateSavings([{month:2,outflow:100}]),/depósitos/);
 assert.ok(Number.isFinite(simulateSavings(payments(600,1e8),10).final.balance));
});
test('a taxa da poupança é preservada ao salvar e importar, e planos antigos recebem a hipótese inicial',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const payload={config:config({scenario:'sale'}),index:{points:[]},comparison:{monthlyRate:0.75,final:{balance:1e30}}};
 const saved=savePlan(storage,payload),loaded=getPlan(storage,saved.id),imported=parseImport(JSON.stringify(payload));
 assert.deepEqual(loaded.comparison,{monthlyRate:0.75});assert.deepEqual(imported.comparison,{monthlyRate:0.75});
 assert.deepEqual(parseImport(JSON.stringify({config:config()})).comparison,{monthlyRate:DEFAULT_SAVINGS_RATE});
 for(const comparison of [null,[],{monthlyRate:null},{monthlyRate:-1}])assert.throws(()=>normalizeComparison(comparison));
});
