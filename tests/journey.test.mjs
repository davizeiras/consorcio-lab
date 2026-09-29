import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,simulate} from '../public/engine.js';
import {duration,firstPayment,syncChoices,assetCopy,afterPayment} from '../public/journey.js';
const config=overrides=>({...DEFAULTS,credit:220000,indexVariant:'manual',forecastAnnual:0,insuranceMonthly:0,creditAnnualReturn:0,cashAnnualReturn:0,...overrides});

test('o resumo traduz o prazo sem arredondar os meses',()=>{
 assert.equal(duration(220),'18 anos e 4 meses');assert.equal(duration(13),'1 ano e 1 mês');assert.equal(duration(24),'2 anos');assert.equal(duration(null),'Informe o prazo');
});
test('a prévia da primeira parcela coincide com o cálculo, inclusive seguro no primeiro mês',()=>{
 for(const plan of ['reduced','linear'])for(const insuranceBefore of [false,true])for(const contemplationMonth of [1,60]){
  const c=config({plan,insuranceBefore,contemplationMonth,insuranceMonthly:51.25});
  assert.ok(Math.abs(firstPayment(c)-simulate(c).rows[0].installment)<1e-8);
 }
 assert.equal(firstPayment(config({credit:null})),null);
 assert.equal(firstPayment(config()),742);
 assert.equal(firstPayment(config({plan:'linear'})),1242);
});
test('encurtar o contrato mantém contemplação, venda e uso dentro do período, sem mudar taxas',()=>{
 const old=config(),{config:c,changes}=syncChoices({...old,term:30},old,'term');
 assert.equal(c.contemplationMonth,30);assert.equal(c.horizon,30);assert.equal(c.saleMonth,30);assert.equal(c.useMonth,30);assert.equal(c.adminPercent,24);assert.ok(changes.length>0);
 assert.doesNotThrow(()=>simulate(c));
});
test('a data da venda acompanha a contemplação quando estava no mesmo mês; uma data posterior é preservada',()=>{
 const old=config({scenario:'sale'}),c=syncChoices({...old,contemplationMonth:24},old,'contemplationMonth').config;
 assert.equal(c.saleMonth,24);assert.equal(c.useMonth,24);assert.doesNotThrow(()=>simulate(c));
 const custom=config({scenario:'sale',saleMonth:100,horizon:300}),changed=syncChoices({...custom,contemplationMonth:24},custom,'contemplationMonth').config;
 assert.equal(changed.saleMonth,100);assert.equal(changed.horizon,300);
 const shorter=syncChoices({...custom,term:180},custom,'term').config;assert.equal(shorter.horizon,300);
});
test('lance fidelidade ajusta a participação e explicita a alteração da data',()=>{
 const old=config(),r=syncChoices({...old,bidType:'loyalty'},old,'bidType');
 assert.equal(r.config.contemplationMonth,36);assert.equal(r.config.ownBidPercent+r.config.embeddedBidPercent,45);assert.ok(r.changes.includes('mês da contemplação'));
 assert.doesNotThrow(()=>simulate(r.config));
 const noBid=syncChoices({...r.config,bidType:'draw'},r.config,'bidType').config;assert.equal(noBid.ownBidPercent,0);assert.equal(noBid.embeddedBidPercent,0);
});
test('uso imobiliário e segmento ficam coerentes, preservando o valor contratado',()=>{
 const old=config({segment:'veiculo'}),a=syncChoices({...old,scenario:'property'},old,'scenario');
 assert.equal(a.config.segment,'imovel');assert.equal(a.config.credit,old.credit);
 const b=syncChoices({...a.config,segment:'servicos'},a.config,'segment');assert.equal(b.config.scenario,'hold');assert.ok(b.changes.length>0);
});
test('o texto distingue crédito não liberado, aplicação, venda e patrimônio',()=>{
 const r=simulate(config());assert.match(assetCopy(r.config,r.rows[0]).label,/não liberado/);assert.match(assetCopy(r.config,r.rows[59]).note,/Não representa dinheiro livre/);
 const sale=simulate(config({scenario:'sale'}));assert.match(assetCopy(sale.config,sale.rows[59]).label,/após a venda/);
 const property=simulate(config({scenario:'property'}));assert.match(assetCopy(property.config,property.rows[59]).note,/crédito que sobrou/);
});
test('período encerrado na contemplação não aparece como parcela zero',()=>{
 const r=simulate(config({horizon:60}));assert.equal(afterPayment(r).value,null);assert.match(afterPayment(r).note,/Aumente a duração/);
});
test('a última parcela reduzida é exibida quando a contemplação cai no último mês',()=>{
 const r=simulate(config({contemplationMonth:220})),display=afterPayment(r);assert.equal(display.value,r.rows[219].installment);assert.ok(display.value>100000);assert.match(display.label,/Última parcela/);
});
test('venda na contemplação identifica a transferência das parcelas; sem venda, mostra a parcela seguinte',()=>{
 const sold=simulate(config({scenario:'sale'})),display=afterPayment(sold);assert.equal(display.value,0);assert.match(display.note,/comprador assume/);
 const kept=simulate(config());assert.equal(afterPayment(kept).value,1429.5);
});
