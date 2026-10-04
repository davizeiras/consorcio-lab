import {planStorage} from './account.js';
import {DEFAULTS,simulate,validatePoints} from './engine.js';
import {GOALS,duration,firstPayment,syncChoices,assetCopy,afterPayment,contemplationOptions,chartMonthAt,assertSupportedScenario} from './journey.js';
import {savePlan,listPlans,getPlan,removePlan,parseImport,MAX_IMPORT_BYTES} from './storage.js';
import {DEFAULT_SAVINGS_RATE,simulateSavings} from './savings.js';
const UI_DEFAULTS={...DEFAULTS,name:''};
const $=id=>document.getElementById(id),form=$('config-form');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(n);
const pct=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n)+'%';
const tone=n=>n===null||Math.abs(n)<0.005?'neutral':n>0?'positive':'negative';
const compact=n=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(n);
const monthName=date=>new Date(date+'-01T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
const emptyIndex=()=>({points:[],provenance:'unavailable',status:'unavailable'});
const state={config:{...UI_DEFAULTS},committed:{...UI_DEFAULTS},index:emptyIndex(),result:null,selected:DEFAULTS.horizon,page:0,valid:false,indexRequest:0,step:0,furthest:0,error:'',dirty:false,saving:false,savingsRate:DEFAULT_SAVINGS_RATE,savingsResult:null,resultTab:'consortium'};
let toastTimer,editTimer;
const nullable=new Set(['insuranceMonthly']);
const n=(key,label,unit='',min=0,max=100,step='any',placeholder='')=>`<label for="field-${key}">${label}${unit?`<span class="label-unit">${unit}</span>`:''}<input form="config-form" id="field-${key}" name="${key}" data-label="${label}" type="number" min="${min}" max="${max}" step="${step}" ${nullable.has(key)?'':'required'} placeholder="${placeholder}"></label>`;
const select=(key,label,options)=>`<label for="field-${key}">${label}<select form="config-form" id="field-${key}" name="${key}" data-label="${label}">${options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label>`;
const fields=(...items)=>`<div class="fields">${items.join('')}</div>`;
const help=text=>`<p class="field-help">${text}</p>`;
$('segment-field').innerHTML=select('segment','Qual tipo de consórcio?',[['imovel','Imóvel'],['veiculo','Veículo'],['bens','Outros bens móveis'],['servicos','Serviços']]);
const presets=(key,options)=>`<div class="quick-choices" role="group" aria-label="Sugestões para ${key==='credit'?'o crédito':'o mês da liberação'}">${options.map(([v,t])=>`<button type="button" data-preset-field="${key}" data-preset-value="${v}" aria-pressed="false">${t}</button>`).join('')}</div>`;
$('amount-fields').innerHTML=n('credit','Quanto você precisa?','R$ · valor do crédito',1000,100000000,'any','Ex.: 150000')+presets('credit',[[100000,'R$ 100 mil'],[150000,'R$ 150 mil'],[200000,'R$ 200 mil'],[300000,'R$ 300 mil']])+n('term','Em quantos meses quer pagar?','Pode digitar outro prazo',2,480,'1');
$('fees-fields').innerHTML=fields(n('adminPercent','Taxa de administração','% do crédito, no contrato inteiro',0,100),n('reservePercent','Fundo de reserva','% do crédito, no contrato inteiro',0,20))+
 '<div class="section-divider"></div>'+n('insuranceMonthly','Seguro por mês','R$ · deixe vazio se ainda não souber',0,100000,'any','Informe a cotação')+
 '<label class="check"><input form="config-form" name="insuranceBefore" type="checkbox">Incluir seguro também antes da contemplação</label>'+help('No modelo, o seguro entra a partir da contemplação. Sem uma cotação, esse custo fica fora da simulação e o resultado aparece como parcial.');
$('index-fields').innerHTML=select('indexVariant','Índice previsto no contrato',[['INCC-M','INCC-M'],['INCC-DI','INCC-DI'],['manual','Informar outro índice / importar histórico']])+
 fields(n('forecastAnnual','Reajuste estimado para o futuro','% ao ano · hipótese editável',-50,100),select('adjustmentFrequency','Quando aplicar o reajuste?',[['annual','Uma vez por ano'],['monthly','Todo mês']]))+
 help('O índice corrige só o saldo do crédito ainda não pago neste modelo. Taxas e seguro ficam fixos.')+n('indexLag','Usar o índice de quantos meses antes?','meses · conforme o contrato',1,6,'1');
$('period-fields').innerHTML=fields('<label for="field-startMonth">Quando começa?<input id="field-startMonth" form="config-form" name="startMonth" type="month" required min="1900-01" max="2199-12" data-label="Quando começa?"></label>',n('horizon','Por quantos meses quer simular?','Pode ir além do prazo do contrato',2,600,'1'));
$('contemplation-fields').innerHTML=fields('<label for="contemplation-year">Quando quer ser contemplado?<span class="label-unit">Todos os anos dentro do prazo do contrato</span><select id="contemplation-year"></select></label>',n('contemplationMonth','Ou escolha um mês específico','Exemplo: 12 meses = 1 ano',1,480,'1'))+'<p id="contemplation-help" class="field-help"></p>';
$('bid-method-field').innerHTML=select('bidType','Como quer tentar a liberação?',[['draw','Sorteio · sem lance'],['free','Lance livre'],['fixed25','Lance fixo de 25%'],['fixed40','Lance fixo de 40%'],['loyalty','Lance fidelidade']]);
$('bid-fields').innerHTML=fields(n('ownBidPercent','Lance do seu bolso','% do crédito',0,100),n('embeddedBidPercent','Lance retirado da carta','% do crédito · lance embutido',0,100))+'<p id="bid-summary" class="bid-summary"></p>'+help('O lance do seu bolso exige dinheiro extra. O lance retirado da carta diminui o crédito que você poderá usar. Os dois reduzem o saldo a pagar neste modelo.');
$('loyalty-inputs').innerHTML=fields(n('loyaltyMin','Primeiro mês permitido','meses pagos',1,480,'1'),n('loyaltyMax','Último mês permitido','meses pagos',1,480,'1'),n('loyaltyMinBid','Lance mínimo','% do crédito',0,100),n('loyaltyMaxBid','Lance máximo','% do crédito',0,100))+help('O lance fidelidade considera apenas a faixa de participação informada. Não prevê concorrentes nem lance vencedor.');
$('hold-settings').innerHTML='<div id="credit-return-holder">'+n('creditAnnualReturn','Quanto espera que o crédito renda?','% ao ano · estimativa, não garantia',-50,100)+help('O crédito continua vinculado à administradora. O rendimento começa no mês seguinte à contemplação.')+'</div>';
$('sale-settings').innerHTML=n('salePercent','Que parte do crédito você receberia na venda?','% do crédito disponível · até 45%',0,45)+help('Exemplo: 45% de R$ 100.000 = R$ 45.000 recebidos. Reembolso adicional e custos ficam nos ajustes abaixo.')+n('cashAnnualReturn','Quanto espera render após a venda?','% ao ano · estimativa, não garantia',-50,100)+'<p class="info-note">A simulação considera que o comprador assume as parcelas restantes, após a transferência ser aprovada.</p>';
$('sale-extra-fields').innerHTML=n('saleMonth','Em qual mês quer vender?','Contando a partir do início',1,600,'1')+fields(n('saleExtra','Reembolso além do preço da venda','R$',0,100000000),n('saleFee','Custos para transferir a cota','R$',0,100000000))+n('saleGainTaxPercent','Imposto estimado sobre o ganho na venda','% efetiva',0,100)+help('Se os 45% forem um ágio, informe acima o reembolso adicional negociado. O simulador não calcula automaticamente os impostos devidos.');
$('tax-fields').innerHTML=n('incomeTaxPercent','Desconto estimado sobre os rendimentos','% efetiva · informe conforme sua simulação',0,100)+help('Com 0%, o rendimento não tem desconto de imposto. Este campo é uma hipótese de custo; não faz apuração tributária automática.');
function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
async function api(url){
 const response=await fetch(url,{credentials:'omit'}),data=await response.json();
 if(!response.ok)throw new Error(data.error||'Não foi possível consultar o índice.');return data;
}
function setFields(config){
 state.config={...DEFAULTS,...config};
 for(const el of form.elements){if(!el.name||!Object.hasOwn(state.config,el.name))continue;const value=state.config[el.name];if(el.type==='checkbox')el.checked=value;else if(el.type==='radio')el.checked=el.value===value;else el.value=value??'';}
 updateVisibility();
}
function readFields(){const c={...state.config};for(const el of form.elements){if(!el.name||!Object.hasOwn(c,el.name)||(el.type==='radio'&&!el.checked))continue;c[el.name]=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?null:Number(el.value)):el.value;}return c;}
function updateVisibility(){
 const c=state.config;
 $('bid-fields').hidden=c.bidType==='draw';$('loyalty-fields').hidden=c.bidType!=='loyalty';$('manual-upload-label').hidden=c.indexVariant!=='manual';
 for(const [id,visible] of [['hold-settings',c.scenario==='hold'],['sale-settings',c.scenario==='sale'],['sale-extra-fields',c.scenario==='sale']])$(id).hidden=!visible;
 const holder=$('credit-return-holder'),parent=c.scenario==='hold'?$('hold-settings'):$('extra-return-fields');if(holder.parentElement!==parent)parent.append(holder);
 $('extra-return-fields').hidden=c.scenario==='hold';
 $('scenario-heading').textContent=c.scenario==='sale'?'Venda da carta':'Rendimento do crédito';
 $('contemplation-help').textContent=Number.isInteger(c.contemplationMonth)&&c.contemplationMonth>0?`Você está testando a liberação após ${duration(c.contemplationMonth)}, dentro de um contrato de ${duration(c.term)}.`:'';
 const method=c.bidType==='draw'?'Neste exemplo, a liberação acontece por sorteio.':'Neste exemplo, você está simulando um lance.';
 $('contemplation-method').textContent=method+' A data é só uma hipótese; não é uma previsão.';
 document.querySelectorAll('[data-preset-field]').forEach(b=>{b.setAttribute('aria-pressed',String(c[b.dataset.presetField]===Number(b.dataset.presetValue)));b.disabled=b.dataset.presetField==='contemplationMonth'&&Number(b.dataset.presetValue)>c.term;});
 $('bid-summary').textContent=c.ownBidPercent!==null&&c.embeddedBidPercent!==null?`Lance total: ${pct(c.ownBidPercent+c.embeddedBidPercent)} do crédito.`:'';
 $('field-contemplationMonth').max=c.term??480;
 const options=contemplationOptions(c.term),year=$('contemplation-year');
 year.innerHTML='<option value="">Mês personalizado</option>'+options.map(o=>`<option value="${o.month}">${o.label}</option>`).join('');
 year.value=options.some(o=>o.month===c.contemplationMonth)?String(c.contemplationMonth):'';year.disabled=options.length===0;
 for(const key of ['saleMonth']){$('field-'+key).min=c.contemplationMonth??1;$('field-'+key).max=c.horizon??600;}
}
function markDirty(){state.dirty=true;$('save-status').textContent='Você fez alterações. Salve para guardar esta versão.';}
function clearError(){ $('calculation-error').hidden=true;document.querySelectorAll('[aria-invalid=true]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');}); }
function showStep(target,focus=true){
 state.step=target;state.furthest=Math.max(state.furthest,target);
 document.querySelectorAll('[data-panel]').forEach(el=>el.hidden=Number(el.dataset.panel)!==target);
 $('journey-layout').hidden=target===3;$('results-panel').hidden=target!==3;$('previous-step').hidden=target===0;
 $('step-progress').textContent=`Passo ${target+1} de 3`;$('next-step').textContent=target===2?'Ver meu resultado →':'Continuar →';
 document.querySelectorAll('[data-step]').forEach(b=>{const s=Number(b.dataset.step);b.disabled=s>state.furthest;b.classList.toggle('done',s<target);if(s===target)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 clearError();if(focus)$('step-title-'+target).focus({preventScroll:true});
 if(focus)document.querySelector('.stepper').scrollIntoView({behavior:'auto',block:'start'});
 if(target===2&&state.config.bidType!=='draw')$('bid-options').open=true;
}
function showError(message,el){
 if(el){const pane=el.closest('[data-panel]');if(pane&&Number(pane.dataset.panel)!==state.step)showStep(Number(pane.dataset.panel),false);for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby','calculation-error');}
 $('calculation-error').textContent=message;$('calculation-error').hidden=false;
 if(el){el.focus();el.scrollIntoView({behavior:'auto',block:'center'});}else $('calculation-error').scrollIntoView({behavior:'auto',block:'center'});
}
function inactiveField(el){for(let p=el;p&&!p.hasAttribute('data-panel');p=p.parentElement)if(p.hidden)return true;return false;}
function validatePanel(step){
 const pane=document.querySelector(`[data-panel="${step}"]`);
 for(const el of pane.querySelectorAll('input,select')){
  if(el.disabled||inactiveField(el)||el.type==='file')continue;
  if(!el.checkValidity()){
   const label=el.dataset.label||'este campo';let message=`Confira “${label}”.`;
   if(el.validity.valueMissing||el.validity.badInput)message=`Preencha “${label}” para continuar.`;
   else if(el.type==='number')message=`Em “${label}”, informe ${el.step==='1'?'um número inteiro':'um valor'} entre ${el.min} e ${el.max}.`;
   showError(message,el);return false;
  }
 }
 return true;
}
function engineErrorField(message){
 const rules=[[/lance|Próprio|embutido/i,'ownBidPercent'],[/Fidelidade/i,'contemplationMonth'],[/venda|cessão/i,'saleMonth'],[/horizonte/i,'horizon'],[/contemplação/i,'contemplationMonth'],[/Data inicial/i,'startMonth'],[/Seguro/i,'insuranceMonthly']];
 const match=rules.find(([re])=>re.test(message));return match?$('field-'+match[1]):null;
}
function navigate(target){
 clearTimeout(editTimer);recalculate();
 if(target>state.step||target===3){for(let i=0;i<Math.min(target,3);i++)if(!validatePanel(i))return;}
 if(target===3&&!state.valid){const el=engineErrorField(state.error);if(!el&&state.step===3)showStep(2,false);showError(state.error||'Confira os valores informados.',el);return;}
 if(target===3){state.selected=state.config.horizon;state.page=Math.floor((state.selected-1)/12);renderSelected();renderTable();}
 showStep(target);
}
function renderPreview(){
 const c=state.config,payment=firstPayment(c);
 $('first-preview').textContent=payment===null?'—':money(payment);
 $('first-preview-note').textContent=`${c.insuranceMonthly===null?'Seguro ainda não incluído. ':''}${c.plan==='reduced'?'Quando o crédito for liberado, a parcela será recalculada. ':''}O reajuste também pode mudar esse valor.`;
 $('amount-help').textContent=c.credit>=1000&&c.term>=2?`${money(c.credit)} de crédito, para pagar ao longo de ${duration(c.term)}.`:'Preencha os valores acima.';
 $('contract-summary').textContent=`Nesta conta: ${pct(c.adminPercent??0)} de administração e ${pct(c.reservePercent??0)} de reserva, no contrato inteiro. Reajuste futuro estimado: ${pct(c.forecastAnnual??0)} ao ano.`;
}
function recalculate(){
 state.config=readFields();updateVisibility();renderPreview();
 try{
  // O nome não interfere na conta: pode ficar vazio enquanto a pessoa o edita.
  state.result=simulate({...state.config,name:state.config.name.trim()||`${GOALS[state.config.scenario]} · ${money(state.config.credit)}`},state.index);state.valid=true;state.error='';
  state.selected=Math.max(1,Math.min(state.selected,state.result.rows.length));state.page=Math.min(state.page,Math.ceil(state.result.rows.length/12)-1);
  $('result-content').hidden=false;renderResult();renderSelected();renderTable();
 }catch(e){state.valid=false;state.result=null;state.error=e.message;$('operation-preview').hidden=true;$('result-content').hidden=true;if(state.step===3){$('calculation-error').textContent=e.message;$('calculation-error').hidden=false;}}
 $('save').disabled=!state.valid||state.saving;
}
function renderResult(){
 const {config:c,summary:s}=state.result;
 $('plan-sentence').textContent=`${money(c.credit)} de crédito · ${duration(c.term)} para pagar · liberação simulada no mês ${c.contemplationMonth}.`;
 const next=afterPayment(state.result);$('payment-first').textContent=money(s.firstInstallment);$('payment-first-note').textContent=c.insuranceMonthly===null?'Inclui taxas. Seguro ainda não informado.':'Inclui taxas e o seguro quando aplicável.';$('payment-after-label').textContent=next.label;$('payment-after').textContent=next.value===null?'Não calculada':money(next.value);$('payment-after-note').textContent=next.note;
 const rate=c.scenario==='sale'?c.cashAnnualReturn:c.creditAnnualReturn;
 const source=state.index.status==='unavailable'?'O índice não está disponível agora; usamos a estimativa informada.':state.index.status==='stale'?'Usamos o histórico preservado; a atualização do índice falhou.':state.index.imported?'Histórico importado por você, sem verificação da fonte.':'';
 const notes=[`Liberação: mês ${c.contemplationMonth}. ${c.scenario==='sale'?'Rendimento após a venda':'Rendimento do crédito'}: ${pct(rate)} ao ano. São hipóteses, não garantias.`];
 if(s.estimatedMonths)notes.push(`Reajuste para meses sem índice conhecido: ${pct(c.forecastAnnual)} ao ano (estimativa).`);
 if(source)notes.push(source);
 if(c.incomeTaxPercent===0)notes.push('Sem desconto de imposto sobre os rendimentos.');
 if(c.segment!=='imovel')notes.push('Confirme o índice do contrato para este tipo de consórcio.');
 $('essential-notes').innerHTML=(c.insuranceMonthly===null?'<p class="partial"><strong>Falta incluir o seguro.</strong> Por isso, os custos ainda estão incompletos. <button class="inline-link" data-edit="1" data-open-details="contract-options">Informar valor</button></p>':'')+'<p class="assumption-line">'+notes.map(esc).join(' ')+'</p>';
 $('operation-preview').hidden=c.scenario==='hold';
 if(c.scenario==='sale')$('operation-preview').textContent=`Venda no mês ${c.saleMonth}: você receberia ${money(s.sale.net)}, já descontados os custos e impostos da venda informados.`;
 $('warnings').innerHTML=state.result.messages.map(x=>`<li>${esc(x)}</li>`).join('');
 const assumptions=[['Administração no contrato',pct(c.adminPercent)],['Fundo de reserva no contrato',pct(c.reservePercent)],['Seguro por mês',c.insuranceMonthly===null?'Não informado':money(c.insuranceMonthly)],['Reajuste futuro estimado',pct(c.forecastAnnual)+' ao ano'],['Rendimento do crédito',pct(c.creditAnnualReturn)+' ao ano'],['Desconto sobre rendimentos',pct(c.incomeTaxPercent)],['Prazo do contrato',c.term+' meses'],['Duração da simulação',c.horizon+' meses']];
 if(c.scenario==='sale')assumptions.push(['Rendimento depois da venda',pct(c.cashAnnualReturn)+' ao ano']);
 $('assumption-values').innerHTML=assumptions.map(([l,v])=>`<div><span>${l}</span><strong>${v}</strong></div>`).join('');renderIndex();
}
function renderSelected(){
 if(!state.result)return;const {config:c,rows,summary}=state.result,r=rows[state.selected-1],copy=assetCopy(c,r);
 $('timeline').max=rows.length;$('timeline').value=state.selected;$('timeline').setAttribute('aria-valuetext',`Mês ${r.month} de ${c.horizon}, ${monthName(r.date)}`);
 $('time-label').innerHTML=`Após ${duration(r.month)} <span>· mês ${r.month}</span>`;$('time-date').textContent=monthName(r.date);
 $('phase-label').textContent=r.sold?'Depois da venda':r.month<c.contemplationMonth?'Antes da contemplação':r.month===c.contemplationMonth?'Contemplação simulada':'Crédito aplicado';
 $('contemplation-marker').textContent=`Contemplação: mês ${c.contemplationMonth}`;$('end-marker').textContent=`${c.horizon} meses`;
 $('jump-event').hidden=c.scenario==='hold';
 document.querySelectorAll('[data-jump]').forEach(b=>b.setAttribute('aria-pressed',String(jumpMonth(b.dataset.jump)===r.month)));
 $('asset-label').textContent=copy.label;$('metric-assets-note').textContent=copy.note;
 $('metric-assets').textContent=money(r.assets);$('metric-paid').textContent=money(r.totalPaid);$('metric-debt').textContent=money(r.debt);$('metric-result').textContent=money(r.result);$('metric-result').className=tone(r.result);
 $('metric-roi').textContent=r.roiPercent===null?'—':pct(r.roiPercent);$('metric-roi').className=tone(r.roiPercent);
 $('roi-period').textContent=`Até o mês ${r.month}, sobre o total pago. Não anualizado.`;
 const totalBid=summary.ownBid+summary.embeddedBid;
 $('metric-bid-label').textContent=totalBid===0?'Sem lance':r.month<c.contemplationMonth?'Lance previsto na simulação':'Lance utilizado na simulação';
 $('metric-bid').textContent=money(totalBid);$('metric-bid-own').textContent=money(summary.ownBid);$('metric-bid-embedded').textContent=money(summary.embeddedBid);
 $('metric-bid-period').textContent=totalBid===0?'Contemplação por sorteio é a hipótese escolhida.':`${pct(c.ownBidPercent+c.embeddedBidPercent)} do crédito corrigido na contemplação · mês ${c.contemplationMonth}.`;
 $('detail-month').textContent=`Valores no mês ${r.month}`;
 const uninsured=c.insuranceMonthly===null&&(c.insuranceBefore||r.month>=c.contemplationMonth)&&r.month<=c.term&&(!r.sold||r.month===c.saleMonth);
 const pairs=[['Resultado sobre o total pago',r.roiPercent===null?'—':pct(r.roiPercent)+' no período'],['Parcela neste mês',money(r.installment)],['Parte da parcela que abate o crédito',money(r.amortization)],['Administração neste mês',money(r.adminFee)],['Reserva neste mês',money(r.reserveFee)],['Seguro neste mês',uninsured?'Não informado':money(r.insurance)],['Reajuste do saldo neste mês',money(r.correction)],['Reajuste acumulado aplicado',pct(r.correctionPercent)],['Lance do seu bolso',money(r.bidCash)],['Lance retirado da carta',money(r.bidEmbedded)],['Desconto estimado sobre rendimentos',money(r.hypotheticalTax)],['Valor estimado menos o que falta pagar',money(r.netEquity)]];
 $('breakdown').innerHTML=pairs.map(([l,v])=>`<div><span>${l}</span><strong>${v}</strong></div>`).join('');$('event-details').hidden=true;
 if(summary.sale&&r.month>=summary.sale.month){const s=summary.sale;$('event-details').hidden=false;$('event-details').innerHTML=`<h3>Valores na venda · mês ${s.month}</h3><div class="sale-values"><div><span>Valor da carta antes da venda</span><strong id="sale-credit-value">${money(s.availableCredit)}</strong></div><span class="sale-arrow" aria-hidden="true">→</span><div><span>Você recebe na venda</span><strong id="sale-net-value">${money(s.net)}</strong><small>Líquido de custos e impostos informados.</small></div></div><p class="field-help">Crédito contratado: ${money(c.credit)}. O valor da carta considera o lance embutido e os rendimentos até a venda.</p><p class="field-help">Preço: ${pct(c.salePercent)} da carta${c.saleExtra?` + ${money(c.saleExtra)} de reembolso`:''}. Até a venda, você pagou ${money(s.paidUntilSale)}; resultado naquele momento: <b class="${tone(s.resultAtSale)}">${money(s.resultAtSale)}</b>. O comprador assume ${money(s.transferredDebt)} de saldo e taxas restantes.</p>`;}
 if($('chart-details').open&&state.resultTab==='consortium')renderChart();
 renderSavings();
}
function setResultTab(tab,focus=false){
 state.resultTab=tab;
 document.querySelectorAll('[data-result-tab]').forEach(button=>{const selected=button.dataset.resultTab===tab;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
 $('consortium-panel').hidden=tab!=='consortium';$('consortium-payments').hidden=tab!=='consortium';$('savings-panel').hidden=tab!=='savings';
 if(focus)$('tab-'+tab).focus();
 if(tab==='consortium'&&state.result&&$('chart-details').open)renderChart();
}
function renderSavings(){
 if(!state.result)return;
 try{
  state.savingsResult=simulateSavings(state.result.rows,state.savingsRate);
  $('savings-error').hidden=true;$('savings-rate').removeAttribute('aria-invalid');$('savings-results').hidden=false;$('savings-monthly').hidden=false;
  const r=state.result.rows[state.selected-1],s=state.savingsResult.rows[state.selected-1],c=state.result.config;
  $('savings-period').textContent=`Após ${duration(r.month)} · mês ${r.month} · ${monthName(r.date)}`;
  $('comparison-goal').textContent=`Consórcio · ${GOALS[c.scenario]}`;
  const values=[['Total pago / depositado',r.totalPaid,s.totalDeposited],['Valor estimado',r.assets,s.balance],['Saldo a pagar',r.debt,0],['Lucro / prejuízo',r.result,s.profit]];
  $('comparison-body').innerHTML=values.map(([label,a,b],i)=>`<tr${i===3?' class="comparison-profit"':''}><th scope="row">${label}</th><td${i===3?` class="${tone(a)}"`:''}>${money(a)}</td><td${i===3?` class="${tone(b)}"`:''}>${money(b)}</td></tr>`).join('')+`<tr class="comparison-roi"><th scope="row">ROI no período</th><td class="${tone(r.roiPercent)}">${r.roiPercent===null?'—':pct(r.roiPercent)}</td><td class="${tone(s.roiPercent)}">${s.roiPercent===null?'—':pct(s.roiPercent)}</td></tr>`;
  const difference=r.result-s.profit;
  $('comparison-difference').textContent=Math.abs(difference)<0.005?'As duas opções têm o mesmo resultado neste cenário.':`${difference>0?'Consórcio':'Poupança'}: ${money(Math.abs(difference))} a mais de resultado neste cenário.`;
  $('comparison-note').textContent=`ROI acumulado sobre o total pago ou depositado, sem anualização. ${r.sold?'Na venda, o comprador assume as parcelas restantes. Depois dela, a poupança continua rendendo sem novos depósitos.':'No consórcio, o crédito continua vinculado à administradora; o resultado já desconta o saldo a pagar.'}`;
 }catch(e){state.savingsResult=null;$('savings-error').textContent=e.message;$('savings-error').hidden=false;$('savings-rate').setAttribute('aria-invalid','true');$('savings-results').hidden=true;$('savings-monthly').hidden=true;}
 renderSavingsTable();
}
function renderSavingsTable(){
 if(!state.savingsResult)return;
 const rows=state.savingsResult.rows.slice(state.page*12,state.page*12+12);
 $('savings-monthly-body').innerHTML=rows.map(r=>`<tr class="${r.month===state.selected?'selected':''}"><td>${r.month}<small>${r.date}</small></td><td>${money(r.deposit)}</td><td>${money(r.totalDeposited)}</td><td class="${tone(r.interest)}">${money(r.interest)}</td><td>${money(r.balance)}</td><td class="${tone(r.profit)}">${money(r.profit)}</td></tr>`).join('');
 const pages=Math.ceil(state.savingsResult.rows.length/12);$('savings-page-label').textContent=`Página ${state.page+1} de ${pages}`;$('savings-prev-page').disabled=state.page===0;$('savings-next-page').disabled=state.page>=pages-1;
}
function validComparisonForSaving(){
 if(state.savingsResult)return true;
 setResultTab('savings');$('savings-rate').focus();toast('Confira a taxa da poupança antes de guardar a simulação.',true);return false;
}
function jumpMonth(target){const c=state.result.config;return target==='start'?1:target==='end'?c.horizon:target==='event'?c.saleMonth:c.contemplationMonth;}
let chartGeometry;
function renderChart(){
 const rows=state.result.rows,w=720,h=260,left=50,right=10,top=14,bottom=35,max=Math.max(1,...rows.flatMap(r=>[r.assets,r.totalPaid,r.debt]))*1.12;
 const x=m=>left+(m-1)/(rows.length-1)*(w-left-right),y=v=>h-bottom-v/max*(h-top-bottom);
 const line=key=>rows.map((r,i)=>`${i?'L':'M'}${x(r.month).toFixed(2)},${y(r[key]).toFixed(2)}`).join(' ');
 let guides='';for(let i=0;i<=4;i++){const value=max*i/4,yy=y(value),m=Math.round(1+(rows.length-1)*i/4);guides+=`<line x1="${left}" x2="${w-right}" y1="${yy}" y2="${yy}" stroke="#dedede" stroke-dasharray="3 5"/><text x="${left-10}" y="${yy+3}" text-anchor="end" fill="#616161" font-size="9">${compact(value)}</text><text x="${x(m)}" y="${h-12}" text-anchor="middle" fill="#616161" font-size="9">${m}m</text>`;}
 $('chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#da0029" stop-opacity=".13"/><stop offset="100%" stop-color="#da0029" stop-opacity="0"/></linearGradient></defs>${guides}<path d="${line('assets')} L${x(rows.length)},${y(0)} L${x(1)},${y(0)} Z" fill="url(#area)"/><path d="${line('assets')}" fill="none" stroke="#da0029" stroke-width="2.5" vector-effect="non-scaling-stroke"/><path d="${line('totalPaid')}" fill="none" stroke="#202020" stroke-width="1.8" vector-effect="non-scaling-stroke"/><path d="${line('debt')}" fill="none" stroke="#777" stroke-width="1.5" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/><g id="chart-guide"><line y1="${top}" y2="${h-bottom}" stroke="#777" stroke-dasharray="3 4"/>${['assets','totalPaid','debt'].map((key,i)=>`<circle data-series="${key}" r="4" fill="white" stroke="${['#da0029','#202020','#777'][i]}" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('')}</g></svg><div id="chart-tooltip" class="chart-tooltip"></div>`;
 chartGeometry={rows,w,left,right,x,y};$('chart-month').max=rows.length;renderChartMonth(state.selected);
}
function renderChartMonth(month){
 if(!chartGeometry)return;const {rows,w,x,y}=chartGeometry,r=rows[month-1];if(!r)return;
 const guide=$('chart-guide'),line=guide.querySelector('line');line.setAttribute('x1',x(month));line.setAttribute('x2',x(month));
 guide.querySelectorAll('circle').forEach(dot=>{dot.setAttribute('cx',x(month));dot.setAttribute('cy',y(r[dot.dataset.series]));});
 const tooltip=$('chart-tooltip');tooltip.innerHTML=`<strong>Mês ${r.month} · ${esc(monthName(r.date))}</strong><dl><div><dt>Valor estimado</dt><dd>${money(r.assets)}</dd></div><div><dt>Total pago</dt><dd>${money(r.totalPaid)}</dd></div><div><dt>Falta pagar</dt><dd>${money(r.debt)}</dd></div></dl>`;
 const width=$('chart').clientWidth,point=x(month)/w*width,tipWidth=tooltip.offsetWidth;
 tooltip.style.left=`${Math.max(0,Math.min(width-tipWidth,point+16+tipWidth>width?point-tipWidth-16:point+16))}px`;
 $('chart-month').value=month;$('chart-month-label').textContent=`Mês ${month} · ${monthName(r.date)}`;
 $('chart-month').setAttribute('aria-valuetext',`Mês ${month}, ${monthName(r.date)}. Valor estimado ${money(r.assets)}, total pago ${money(r.totalPaid)}, falta pagar ${money(r.debt)}.`);
}
function inspectChart(event){
 if(!chartGeometry)return;const {w,left,right,rows}=chartGeometry,rect=$('chart').querySelector('svg').getBoundingClientRect();if(!rect.width)return;
 renderChartMonth(chartMonthAt(((event.clientX-rect.left)/rect.width*w-left)/(w-left-right),rows.length));
}
function renderTable(){
 if(!state.result)return;const rows=state.result.rows.slice(state.page*12,state.page*12+12);
 $('monthly-body').innerHTML=rows.map(r=>`<tr class="${r.month===state.selected?'selected':''}"><td>${r.month}<small>${r.date}</small></td><td>${money(r.installment)}</td><td>${money(r.totalPaid)}</td><td>${money(r.debt)}</td><td>${money(r.assets)}</td><td class="${tone(r.result)}">${money(r.result)}</td><td>${r.indexMonth?pct(r.indexPercent):'—'}<small class="origin ${r.indexSource.startsWith('Publicado')?'real':''}">${esc(r.indexSource)}</small></td></tr>`).join('');
 const pages=Math.ceil(state.result.rows.length/12);$('page-label').textContent=`Página ${state.page+1} de ${pages}`;$('prev-page').disabled=state.page===0;$('next-page').disabled=state.page>=pages-1;
 renderSavingsTable();
}
function renderIndex(){
 const d=state.index,status={loading:'Consultando o histórico…',updated:'Histórico atualizado',cached:'Histórico da última consulta',stale:'Consulta indisponível · histórico preservado',unavailable:'Consulta indisponível · usando estimativas',manual:'Histórico informado por você',snapshot:'Histórico da simulação salva'};
 $('index-title').textContent=state.config.indexVariant==='manual'?'Histórico informado':state.config.indexVariant;$('index-status').textContent=d.imported?'Histórico importado por você':status[d.status]||'Histórico informado';
 const last=d.latest||d.points?.at(-1);$('index-value').textContent=last?pct(last.percent)+' no mês':'Sem valor publicado disponível';$('index-date').textContent=last?`${monthName(last.month)}${d.trailing12!=null?' · Em 12 meses: '+pct(d.trailing12):''}`:'O reajuste futuro é sempre uma estimativa.';
 $('index-status').title=d.error||(d.fetchedAt?'Consulta: '+new Date(d.fetchedAt).toLocaleString('pt-BR'):'Nenhuma consulta confirmada.');
 $('result-index-note').textContent=`${$('index-title').textContent}: ${$('index-status').textContent}. ${last?$('index-value').textContent+' em '+monthName(last.month)+'. ':''}${d.fetchedAt?'Consultado em '+new Date(d.fetchedAt).toLocaleString('pt-BR')+'. ':''}Os índices futuros não são conhecidos.`;
 $('refresh-index').hidden=state.config.indexVariant==='manual';
}
async function refreshIndex(quiet=false){
 const variant=state.config.indexVariant;if(variant==='manual'){renderIndex();$('refresh-index').disabled=false;return;}
 const id=++state.indexRequest;state.index={...state.index,status:'loading'};renderIndex();$('refresh-index').disabled=true;
 try{const d=await api('/api/indices?variant='+encodeURIComponent(variant));if(id!==state.indexRequest||variant!==state.config.indexVariant)return;state.index=d;renderIndex();recalculate();if(d.error&&!quiet)toast('O índice não atualizou. Confira os detalhes do reajuste.',true);}
 catch(e){if(id===state.indexRequest){state.index={...state.index,status:state.index.points.length?'stale':'unavailable',error:e.message};renderIndex();recalculate();if(!quiet)toast(e.message,true);}}
 finally{if(id===state.indexRequest)$('refresh-index').disabled=false;}
}
function closeDetails(){document.querySelectorAll('#config-form details,#results-panel details').forEach(d=>d.open=false);}
function newSimulation(){
 state.indexRequest++;clearTimeout(editTimer);state.index=emptyIndex();state.committed={...UI_DEFAULTS};setFields(UI_DEFAULTS);state.selected=DEFAULTS.horizon;state.page=0;state.furthest=0;state.dirty=false;
 state.savingsRate=DEFAULT_SAVINGS_RATE;$('savings-rate').value=state.savingsRate;setResultTab('consortium');
 $('timing-note').hidden=true;$('manual-upload').value='';closeDetails();recalculate();renderIndex();showStep(0,false);$('save-status').textContent='Salve neste navegador ou baixe uma cópia.';
}
form.addEventListener('submit',e=>{e.preventDefault();if(state.step<3)navigate(state.step+1);});
$('contemplation-year').addEventListener('change',e=>{if(!e.target.value){$('field-contemplationMonth').focus();return;}const input=$('field-contemplationMonth');input.value=e.target.value;input.dispatchEvent(new Event('change',{bubbles:true}));});
$('next-step').addEventListener('click',()=>navigate(state.step+1));$('previous-step').addEventListener('click',()=>navigate(state.step-1));
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>navigate(Number(b.dataset.step))));
document.addEventListener('click',e=>{
 const edit=e.target.closest('[data-edit]');if(edit){navigate(Number(edit.dataset.edit));if(edit.dataset.openDetails)$(edit.dataset.openDetails).open=true;}
 const preset=e.target.closest('[data-preset-field]');if(preset){const input=form.elements.namedItem(preset.dataset.presetField);input.value=preset.dataset.presetValue;input.dispatchEvent(new Event('change',{bubbles:true}));}
});
document.addEventListener('input',e=>{
 const el=e.target;if(el.form!==form||!el.name||['SELECT'].includes(el.tagName)||['radio','checkbox'].includes(el.type))return;
 clearError();clearTimeout(editTimer);editTimer=setTimeout(()=>{recalculate();markDirty();},140);
});
document.addEventListener('change',e=>{
 const el=e.target;if(el.form!==form||!el.name)return;clearTimeout(editTimer);clearError();
 const {config,changes}=syncChoices(readFields(),state.committed,el.name);setFields(config);state.committed={...config};
 $('timing-note').hidden=changes.length===0;$('timing-note').textContent=changes.length?`Para manter seu plano coerente, ajustamos: ${[...new Set(changes)].join(', ')}. Você pode conferir e alterar esses valores.`:'';
 if(el.name==='indexVariant'){state.indexRequest++;state.index={...emptyIndex(),status:el.value==='manual'?'manual':'unavailable'};$('manual-upload').value='';renderIndex();}
 recalculate();markDirty();if(el.name==='indexVariant')refreshIndex();
});
document.querySelectorAll('[data-result-tab]').forEach(button=>{
 button.addEventListener('click',()=>setResultTab(button.dataset.resultTab));
 button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();setResultTab(event.key==='Home'?'consortium':event.key==='End'?'savings':state.resultTab==='consortium'?'savings':'consortium',true);});
});
$('savings-rate').addEventListener('input',e=>{state.savingsRate=e.target.value===''?null:Number(e.target.value);renderSavings();markDirty();});
for(const id of ['savings-prev-page','savings-next-page'])$(id).addEventListener('click',()=>{if(!state.savingsResult)return;state.page=Math.max(0,Math.min(Math.ceil(state.savingsResult.rows.length/12)-1,state.page+(id==='savings-next-page'?1:-1)));renderTable();});
$('timeline').addEventListener('input',e=>{state.selected=Number(e.target.value);state.page=Math.floor((state.selected-1)/12);renderSelected();renderTable();});
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>{if(!state.result)return;state.selected=jumpMonth(b.dataset.jump);state.page=Math.floor((state.selected-1)/12);renderSelected();renderTable();}));
$('chart-details').addEventListener('toggle',()=>{if($('chart-details').open&&state.result)renderChart();});
$('chart').addEventListener('pointermove',inspectChart);$('chart').addEventListener('pointerdown',inspectChart);
$('chart-month').addEventListener('input',e=>renderChartMonth(Number(e.target.value)));
$('prev-page').addEventListener('click',()=>{state.page=Math.max(0,state.page-1);renderTable();});$('next-page').addEventListener('click',()=>{state.page=Math.min(Math.ceil(state.result.rows.length/12)-1,state.page+1);renderTable();});$('refresh-index').addEventListener('click',()=>refreshIndex());
$('reset').addEventListener('click',()=>{if(state.dirty&&!confirm('Começar uma nova simulação? As alterações ainda não salvas serão descartadas.'))return;newSimulation();refreshIndex(true);$('step-title-0').focus();});
function download(name,type,contents){const url=URL.createObjectURL(new Blob([contents],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-csv').addEventListener('click',()=>{
 if(!state.result)return;const heads=['Mes','Competencia','Parcela','Principal pago','Administracao','Reserva','Seguro','Lance proprio','Lance embutido','Total pago','Principal restante','Falta pagar','Valor estimado','Resultado nominal','Retorno no periodo %','Indice %','Reajuste aplicado %','Origem'];
 const lines=state.result.rows.map(r=>[r.month,r.date,r.installment,r.amortization,r.adminFee,r.reserveFee,r.insurance,r.bidCash,r.bidEmbedded,r.totalPaid,r.principal,r.debt,r.assets,r.result,r.roiPercent,r.indexPercent,r.appliedPercent,r.indexSource]);
 const csv=[heads,...lines].map(row=>row.map(v=>typeof v==='number'?v.toFixed(2).replace('.',','):`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\r\n');download('demonstrativo-consorcio.csv','text/csv;charset=utf-8','\ufeff'+csv);
});
$('manual-upload').addEventListener('change',async e=>{
 const file=e.target.files[0],variant=state.config.indexVariant,requestId=state.indexRequest;if(!file)return;
 try{
  if(file.size>150000)throw new Error('Use um arquivo CSV de até 150 KB.');
  const text=(await file.text()).replace(/^\uFEFF/,''),lines=text.trim().split(/\r?\n/);
  const points=lines.map((line,i)=>{if(i===0&&/competencia|competência|month/i.test(line))return null;const parts=line.split(';').map(x=>x.trim().replace(/^"|"$/g,''));if(parts.length!==2||! /^-?\d+(?:[.,]\d+)?$/.test(parts[1]))throw new Error(`Linha ${i+1}: use competencia;percentual, por exemplo 2025-01;0,71.`);return {month:parts[0],percent:Number(parts[1].replace(',','.'))};}).filter(Boolean);
  if(variant!=='manual'||state.config.indexVariant!==variant||requestId!==state.indexRequest)return;
  state.index={points:validatePoints(points),provenance:'manual',status:'manual',fetchedAt:null};renderIndex();recalculate();markDirty();toast(`${points.length} meses importados. O histórico está identificado como informado por você.`);
 }catch(e){toast(e.message,true);}
});
$('download-plan').addEventListener('click',()=>{
 clearTimeout(editTimer);recalculate();if(!state.result||!validComparisonForSaving())return;
 download('meu-plano-consorcio.json','application/json',JSON.stringify({version:2,config:state.result.config,index:state.index,comparison:{monthlyRate:state.savingsRate}},null,2));
 toast('Arquivo preparado. Guarde-o para abrir em outro momento.');
});
$('save').addEventListener('click',()=>{
 clearTimeout(editTimer);recalculate();if(!state.valid||!validComparisonForSaving())return;
 try{
  const d=savePlan(planStorage,{config:state.result.config,index:state.index,comparison:{monthlyRate:state.savingsRate}});state.indexRequest++;state.index=d.index;$('refresh-index').disabled=false;state.dirty=false;recalculate();
  $('save-status').textContent='Guardado neste navegador. Encontre em “Planos guardados”.';toast('Plano guardado aqui.');
 }catch(e){toast(e.message,true);}
});
function loadSaved(){
 try{const plans=listPlans(planStorage);$('saved-list').innerHTML=plans.length?plans.map(s=>`<div class="saved-item"><div><strong>${esc(s.name)}</strong><small>${new Date(s.savedAt).toLocaleString('pt-BR')}</small></div><div class="actions"><button class="button secondary small" data-load="${s.id}">Abrir</button><button class="text-button" data-delete="${s.id}">Excluir</button></div></div>`).join(''):'<p>Ainda não há planos guardados aqui. Faça uma simulação e clique em “Guardar aqui” no resultado.</p>';}catch(e){$('saved-list').textContent=e.message;}
}
function openSnapshot(d,{imported=false}={}){
 assertSupportedScenario(d.config.scenario);
 state.indexRequest++;clearTimeout(editTimer);state.index={...d.index,status:'snapshot'};setFields(d.config);state.committed={...state.config};state.selected=d.config.horizon;state.page=Math.floor((state.selected-1)/12);state.dirty=imported;
 state.savingsRate=d.comparison.monthlyRate;$('savings-rate').value=state.savingsRate;setResultTab('consortium');
 $('timing-note').hidden=true;$('manual-upload').value='';closeDetails();recalculate();renderIndex();$('refresh-index').disabled=false;
 $('save-status').textContent=imported?'Arquivo aberto. Clique em “Guardar aqui” para salvá-lo neste navegador.':'Plano guardado aberto. Salvar de novo cria outra cópia.';
 if(state.valid)showStep(3);else{showStep(2);showError(state.error,engineErrorField(state.error));}
}
$('open-saved').addEventListener('click',()=>{$('saved-dialog').showModal();loadSaved();});
$('saved-list').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 try{
  if(b.dataset.load){if(state.dirty&&!confirm('Abrir outro plano e descartar as alterações ainda não guardadas?'))return;const d=getPlan(planStorage,b.dataset.load);$('saved-dialog').close();openSnapshot(d);toast('Plano aberto com os índices usados no salvamento.');}
  if(b.dataset.delete&&confirm('Excluir este plano deste navegador?')){removePlan(planStorage,b.dataset.delete);loadSaved();}
 }catch(e){toast(e.message,true);}
});
$('open-import').addEventListener('click',()=>$('import-plan').click());
$('import-plan').addEventListener('change',async e=>{
 const file=e.target.files[0],requestId=state.indexRequest,configBefore=JSON.stringify(readFields());if(!file)return;
 try{
  if(file.size>MAX_IMPORT_BYTES)throw new Error('Escolha um arquivo JSON de até 2 MB.');
  const d=parseImport(await file.text());
  if(requestId!==state.indexRequest||JSON.stringify(readFields())!==configBefore){toast('O plano foi alterado durante a leitura. Escolha o arquivo novamente.',true);return;}
  if(state.dirty&&!confirm('Abrir este arquivo e descartar as alterações ainda não guardadas?'))return;
  openSnapshot(d,{imported:true});toast('Arquivo aberto. Os valores foram recalculados.');
 }catch(e){toast(e.message,true);}finally{e.target.value='';}
});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
setInterval(()=>{if(document.visibilityState==='visible'&&state.index.status!=='snapshot')refreshIndex(true);},6*3600000);
newSimulation();
void refreshIndex(true);
