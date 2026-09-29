import {DEFAULTS,simulate,validatePoints} from './engine.js';
import {GOALS,duration,firstPayment,syncChoices,assetCopy,afterPayment} from './journey.js';
import {savePlan,listPlans,getPlan,removePlan,parseImport,MAX_IMPORT_BYTES} from './storage.js';
const UI_DEFAULTS={...DEFAULTS,name:''};
const $=id=>document.getElementById(id),form=$('config-form');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(n);
const pct=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n)+'%';
const compact=n=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(n);
const monthName=date=>new Date(date+'-01T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
const emptyIndex=()=>({points:[],provenance:'unavailable',status:'unavailable'});
const state={config:{...UI_DEFAULTS},committed:{...UI_DEFAULTS},index:emptyIndex(),result:null,selected:DEFAULTS.horizon,page:0,valid:false,indexRequest:0,step:0,furthest:0,error:'',dirty:false,saving:false};
let toastTimer,editTimer;
const nullable=new Set(['insuranceMonthly','propertyBenefit']);
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
$('contemplation-fields').innerHTML=n('contemplationMonth','Em qual mês quer testar a liberação?','Exemplo: 12 meses = 1 ano',1,480,'1')+presets('contemplationMonth',[[12,'1 ano'],[24,'2 anos'],[36,'3 anos'],[60,'5 anos']])+'<p id="contemplation-help" class="field-help"></p>';
$('bid-method-field').innerHTML=select('bidType','Como quer tentar a liberação?',[['draw','Sorteio · sem lance'],['free','Lance livre'],['fixed25','Lance fixo de 25%'],['fixed40','Lance fixo de 40%'],['loyalty','Lance fidelidade']]);
$('bid-fields').innerHTML=fields(n('ownBidPercent','Lance do seu bolso','% do crédito',0,100),n('embeddedBidPercent','Lance retirado da carta','% do crédito · lance embutido',0,100))+'<p id="bid-summary" class="bid-summary"></p>'+help('O lance do seu bolso exige dinheiro extra. O lance retirado da carta diminui o crédito que você poderá usar. Os dois reduzem o saldo a pagar neste modelo.');
$('loyalty-inputs').innerHTML=fields(n('loyaltyMin','Primeiro mês permitido','meses pagos',1,480,'1'),n('loyaltyMax','Último mês permitido','meses pagos',1,480,'1'),n('loyaltyMinBid','Lance mínimo','% do crédito',0,100),n('loyaltyMaxBid','Lance máximo','% do crédito',0,100))+help('O lance fidelidade considera apenas a faixa de participação informada. Não prevê concorrentes nem lance vencedor.');
$('hold-settings').innerHTML='<div id="credit-return-holder">'+n('creditAnnualReturn','Quanto espera que o crédito renda?','% ao ano · estimativa, não garantia',-50,100)+help('O crédito continua vinculado à administradora. O rendimento começa no mês seguinte à contemplação.')+'</div>';
$('sale-settings').innerHTML=n('salePercent','Que parte do crédito você receberia na venda?','% do crédito disponível · até 45%',0,45)+help('Exemplo: 45% de R$ 100.000 = R$ 45.000 recebidos. Reembolso adicional e custos ficam nos ajustes abaixo.')+n('cashAnnualReturn','Quanto espera render após a venda?','% ao ano · estimativa, não garantia',-50,100)+'<p class="info-note">A simulação considera que o comprador assume as parcelas restantes, após a transferência ser aprovada.</p>';
$('property-settings').innerHTML=select('usePurpose','O que quer fazer com o imóvel?',[['buy','Comprar'],['build','Construir'],['renovate','Reformar'],['payoff','Quitar financiamento']])+'<div class="section-divider"></div>'+n('propertyPrice','Quanto vai custar?','R$ · valor da compra, obra, reforma ou quitação',1,100000000)+'<div id="property-benefit-field" hidden>'+n('propertyBenefit','Quanto isso acrescenta ao seu patrimônio?','R$ · informe o benefício, separado do gasto',0,100000000,'any','Informe para reforma ou quitação')+help('Na reforma, estime o valor acrescentado ao imóvel. Na quitação, informe o benefício da dívida quitada considerado no seu patrimônio.')+'</div><p class="info-note">Se o crédito não cobrir a operação, mostramos quanto você precisará completar. O uso depende de aprovação e das garantias exigidas.</p>';
$('sale-extra-fields').innerHTML=n('saleMonth','Em qual mês quer vender?','Contando a partir do início',1,600,'1')+fields(n('saleExtra','Reembolso além do preço da venda','R$',0,100000000),n('saleFee','Custos para transferir a cota','R$',0,100000000))+n('saleGainTaxPercent','Imposto estimado sobre o ganho na venda','% efetiva',0,100)+help('Se os 45% forem um ágio, informe acima o reembolso adicional negociado. O simulador não calcula automaticamente os impostos devidos.');
$('property-extra-fields').innerHTML=n('useMonth','Em qual mês quer usar o crédito?','Contando a partir do início',1,600,'1')+fields(n('propertyCosts','Custos pagos do seu bolso','R$',0,100000000),n('propertyAnnualReturn','Valorização esperada do imóvel','% ao ano · estimativa',-50,100))+'<div id="optional-property-benefit"></div>';
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
 const c=state.config,isProperty=c.scenario==='property';
 $('bid-fields').hidden=c.bidType==='draw';$('loyalty-fields').hidden=c.bidType!=='loyalty';$('manual-upload-label').hidden=c.indexVariant!=='manual';
 for(const [id,visible] of [['hold-settings',c.scenario==='hold'],['sale-settings',c.scenario==='sale'],['sale-extra-fields',c.scenario==='sale'],['property-settings',isProperty],['property-extra-fields',isProperty]])$(id).hidden=!visible;
 const holder=$('credit-return-holder'),parent=c.scenario==='hold'?$('hold-settings'):$('extra-return-fields');if(holder.parentElement!==parent)parent.append(holder);
 $('extra-return-fields').hidden=c.scenario==='hold';
 const benefitRequired=isProperty&&['renovate','payoff'].includes(c.usePurpose),benefit=$('property-benefit-field');
 const benefitParent=benefitRequired?$('property-settings'):$('optional-property-benefit');if(benefit.parentElement!==benefitParent)benefitParent.append(benefit);
 benefit.hidden=!isProperty;$('field-propertyBenefit').required=benefitRequired;
 const benefitLabel=document.querySelector('label[for="field-propertyBenefit"]');benefitLabel.firstChild.textContent=benefitRequired?'Quanto isso acrescenta ao seu patrimônio?':'Valor estimado do imóvel após a operação';
 benefitLabel.querySelector('.label-unit').textContent=benefitRequired?'R$ · informe o benefício, separado do gasto':'R$ · em branco, usamos o valor da operação';
 $('field-propertyBenefit').placeholder=benefitRequired?'Informe para reforma ou quitação':'Opcional: valor diferente do custo';
 $('property-choice').querySelector('input').disabled=c.segment!=='imovel';
 $('goal-note').textContent=c.segment!=='imovel'?'Para veículo, bens ou serviços, confirme o índice de reajuste do contrato em “Ajustes avançados”. O uso no imóvel está disponível para consórcio imobiliário.':c.scenario==='hold'?'O crédito aplicado continua vinculado à administradora. Aqui você explora o crescimento estimado desse valor.':c.scenario==='sale'?'Você testa uma venda depois da contemplação e vê o que acontece ao investir o valor recebido.':'Você informa o preço da operação e nós mostramos se será preciso completar com dinheiro do seu bolso.';
 $('scenario-heading').textContent=c.scenario==='sale'?'E depois, como seria a venda?':isProperty?'Como pretende usar no imóvel?':'Quanto esse crédito pode render?';
 $('contemplation-help').textContent=Number.isInteger(c.contemplationMonth)&&c.contemplationMonth>0?`Você está testando a liberação após ${duration(c.contemplationMonth)}, dentro de um contrato de ${duration(c.term)}.`:'';
 $('segment-current').textContent={imovel:'Imóvel',veiculo:'Veículo',bens:'Outros bens',servicos:'Serviços'}[c.segment];
 const method=c.bidType==='draw'?'Neste exemplo, a liberação acontece por sorteio.':'Neste exemplo, você está simulando um lance.';
 $('contemplation-method').textContent=method+' A data é só uma hipótese; não é uma previsão.';
 document.querySelectorAll('[data-preset-field]').forEach(b=>{b.setAttribute('aria-pressed',String(c[b.dataset.presetField]===Number(b.dataset.presetValue)));b.disabled=b.dataset.presetField==='contemplationMonth'&&Number(b.dataset.presetValue)>c.term;});
 $('bid-summary').textContent=c.ownBidPercent!==null&&c.embeddedBidPercent!==null?`Lance total: ${pct(c.ownBidPercent+c.embeddedBidPercent)} do crédito.`:'';
 $('field-contemplationMonth').max=c.term??480;
 for(const key of ['saleMonth','useMonth']){$('field-'+key).min=c.contemplationMonth??1;$('field-'+key).max=c.horizon??600;}
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
 if(focus)document.querySelector('.stepper').scrollIntoView({behavior:'smooth',block:'start'});
 if(target===2&&state.config.bidType!=='draw')$('bid-options').open=true;
}
function showError(message,el){
 if(el){const pane=el.closest('[data-panel]');if(pane&&Number(pane.dataset.panel)!==state.step)showStep(Number(pane.dataset.panel),false);for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby','calculation-error');}
 $('calculation-error').textContent=message;$('calculation-error').hidden=false;
 if(el){el.focus();el.scrollIntoView({behavior:'smooth',block:'center'});}else $('calculation-error').scrollIntoView({behavior:'smooth',block:'center'});
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
 const rules=[[/lance|Próprio|embutido/i,'ownBidPercent'],[/Fidelidade/i,'contemplationMonth'],[/benefício patrimonial/i,'propertyBenefit'],[/venda ou o uso|cessão/i,state.config.scenario==='sale'?'saleMonth':'useMonth'],[/horizonte/i,'horizon'],[/contemplação/i,'contemplationMonth'],[/Data inicial/i,'startMonth'],[/Seguro/i,'insuranceMonthly']];
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
 const c=state.config,payment=firstPayment(c);$('preview-goal').textContent=GOALS[c.scenario];$('preview-credit').textContent=c.credit>=1000?money(c.credit):'Informe o valor';$('preview-term').textContent=c.term?`${c.term} meses · ${duration(c.term)}`:'Informe o prazo';$('preview-plan').textContent=c.plan==='reduced'?'Começar com parcela reduzida':'Parcela integral (linear)';
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
  $('result-content').hidden=false;$('comparison').hidden=true;renderResult();renderSelected();renderTable();
 }catch(e){state.valid=false;state.result=null;state.error=e.message;$('operation-preview').hidden=true;$('result-content').hidden=true;if(state.step===3){$('calculation-error').textContent=e.message;$('calculation-error').hidden=false;}}
 $('save').disabled=!state.valid||state.saving;$('export-json').disabled=!state.valid;
}
function renderResult(){
 const {config:c,summary:s}=state.result;
 $('plan-sentence').textContent=`${money(c.credit)} de crédito · ${duration(c.term)} para pagar · liberação simulada no mês ${c.contemplationMonth}.`;
 const next=afterPayment(state.result);$('payment-first').textContent=money(s.firstInstallment);$('payment-first-note').textContent=c.insuranceMonthly===null?'Inclui taxas. Seguro ainda não informado.':'Inclui taxas e o seguro quando aplicável.';$('payment-after-label').textContent=next.label;$('payment-after').textContent=next.value===null?'Não calculada':money(next.value);$('payment-after-note').textContent=next.note;
 const rate=c.scenario==='sale'?c.cashAnnualReturn:c.scenario==='property'?c.propertyAnnualReturn:c.creditAnnualReturn;
 const source=state.index.status==='unavailable'?'O índice não está disponível agora; usamos a estimativa informada.':state.index.status==='stale'?'Usamos o histórico preservado; a atualização do índice falhou.':state.index.imported?'Histórico importado por você, sem verificação da fonte.':'';
 const notes=[`Liberação: mês ${c.contemplationMonth}. ${c.scenario==='property'?'Valorização do imóvel':c.scenario==='sale'?'Rendimento após a venda':'Rendimento do crédito'}: ${pct(rate)} ao ano. São hipóteses, não garantias.`];
 if(s.estimatedMonths)notes.push(`Reajuste para meses sem índice conhecido: ${pct(c.forecastAnnual)} ao ano (estimativa).`);
 if(source)notes.push(source);
 if(c.incomeTaxPercent===0)notes.push('Sem desconto de imposto sobre os rendimentos.');
 if(c.segment!=='imovel')notes.push('Confirme o índice do contrato para este tipo de consórcio.');
 $('essential-notes').innerHTML=(c.insuranceMonthly===null?'<p class="partial"><strong>Falta incluir o seguro.</strong> Por isso, os custos ainda estão incompletos. <button class="inline-link" data-edit="1" data-open-details="contract-options">Informar valor</button></p>':'')+'<p class="assumption-line">'+notes.map(esc).join(' ')+'</p>';
 $('operation-preview').hidden=c.scenario==='hold';
 if(c.scenario==='sale')$('operation-preview').textContent=`Venda no mês ${c.saleMonth}: você receberia ${money(s.sale.net)}, já descontados os custos e impostos da venda informados.`;
 if(c.scenario==='property')$('operation-preview').textContent=`Uso no mês ${c.useMonth}: ${money(s.property.creditUsed)} viriam do crédito. Você precisaria completar ${money(s.property.complement)} do seu bolso, incluindo os custos informados.`;
 const bid=s.ownBid||s.embeddedBid?`Lance do seu bolso: ${money(s.ownBid)}. Retirado da carta: ${money(s.embeddedBid)}.`:'Sem lance: contemplação por sorteio é a hipótese escolhida.';
 const third=c.scenario==='sale'?{title:`Venda simulada · mês ${c.saleMonth}`,text:`Você receberia ${money(s.sale.net)} líquidos. O comprador assumiria o saldo restante, e esse dinheiro começaria a render no mês seguinte.`}:c.scenario==='property'?{title:`Uso no imóvel · mês ${c.useMonth}`,text:`Crédito utilizado: ${money(s.property.creditUsed)}. Você completaria com ${money(s.property.complement)} do seu bolso, já incluindo os custos informados.`}:{title:'Crédito rendendo',text:`A partir do mês ${c.contemplationMonth+1}, o crédito rende pela taxa hipotética de ${pct(c.creditAnnualReturn)} ao ano, vinculado à administradora. Você continua pagando as parcelas restantes.`};
 $('plan-story').innerHTML=[{title:'Você começa a pagar',text:`Primeira parcela de ${money(s.firstInstallment)}. O contrato tem ${c.term} meses e os valores podem mudar com o reajuste.`},{title:`Contemplação simulada · mês ${c.contemplationMonth}`,text:`Crédito disponível: ${money(s.availableAtContemplation)}. ${bid}`},third].map(x=>`<li><strong>${esc(x.title)}</strong><p>${esc(x.text)}</p></li>`).join('');
 $('warnings').innerHTML=state.result.messages.map(x=>`<li>${esc(x)}</li>`).join('');
 const assumptions=[['Administração no contrato',pct(c.adminPercent)],['Fundo de reserva no contrato',pct(c.reservePercent)],['Seguro por mês',c.insuranceMonthly===null?'Não informado':money(c.insuranceMonthly)],['Reajuste futuro estimado',pct(c.forecastAnnual)+' ao ano'],['Rendimento do crédito',pct(c.creditAnnualReturn)+' ao ano'],['Desconto sobre rendimentos',pct(c.incomeTaxPercent)],['Prazo do contrato',c.term+' meses'],['Duração da simulação',c.horizon+' meses']];
 if(c.scenario==='sale')assumptions.push(['Rendimento depois da venda',pct(c.cashAnnualReturn)+' ao ano']);
 $('assumption-values').innerHTML=assumptions.map(([l,v])=>`<div><span>${l}</span><strong>${v}</strong></div>`).join('');renderIndex();
}
function renderSelected(){
 if(!state.result)return;const {config:c,rows,summary}=state.result,r=rows[state.selected-1],copy=assetCopy(c,r);
 $('timeline').max=rows.length;$('timeline').value=state.selected;$('timeline').setAttribute('aria-valuetext',`Mês ${r.month} de ${c.horizon}, ${monthName(r.date)}`);
 $('time-label').innerHTML=`Após ${duration(r.month)} <span>· mês ${r.month}</span>`;$('time-date').textContent=monthName(r.date);
 $('phase-label').textContent=r.sold?'Depois da venda':r.used?'Crédito utilizado':r.month<c.contemplationMonth?'Antes da contemplação':r.month===c.contemplationMonth?'Contemplação simulada':'Crédito aplicado';
 $('contemplation-marker').textContent=`Contemplação: mês ${c.contemplationMonth}`;$('end-marker').textContent=`${c.horizon} meses`;
 $('jump-event').hidden=c.scenario==='hold';$('jump-event').textContent=c.scenario==='sale'?'Na venda':'No uso do crédito';
 document.querySelectorAll('[data-jump]').forEach(b=>b.setAttribute('aria-pressed',String(jumpMonth(b.dataset.jump)===r.month)));
 $('asset-label').textContent=copy.label;$('metric-assets-note').textContent=copy.note;
 $('metric-assets').textContent=money(r.assets);$('metric-paid').textContent=money(r.totalPaid);$('metric-debt').textContent=money(r.debt);$('metric-result').textContent=money(r.result);$('metric-result').className=r.result>=0?'positive':'negative';
 $('metric-roi').textContent=r.month<c.contemplationMonth?'O crédito ainda não estaria liberado.':r.sold?'Considera o dinheiro recebido e investido.':r.used?'Inclui o valor do imóvel ou benefício informado.':'Inclui crédito vinculado à administradora.';
 $('result-explanation').textContent=Math.abs(r.result)<0.005?'O valor estimado empata com o total que você pagou e ainda deve.':`Depois de descontar o que você já pagou e o que ainda deve, a diferença seria de ${money(Math.abs(r.result))} ${r.result>=0?'a seu favor':'contra você'}.`;
 $('detail-month').textContent=`Valores no mês ${r.month}`;
 const uninsured=c.insuranceMonthly===null&&(c.insuranceBefore||r.month>=c.contemplationMonth)&&r.month<=c.term&&(!r.sold||r.month===c.saleMonth);
 const pairs=[['Resultado sobre o total pago',r.roiPercent===null?'—':pct(r.roiPercent)+' no período'],['Parcela neste mês',money(r.installment)],['Parte da parcela que abate o crédito',money(r.amortization)],['Administração neste mês',money(r.adminFee)],['Reserva neste mês',money(r.reserveFee)],['Seguro neste mês',uninsured?'Não informado':money(r.insurance)],['Reajuste do saldo neste mês',money(r.correction)],['Reajuste acumulado aplicado',pct(r.correctionPercent)],['Lance do seu bolso',money(r.bidCash)],['Lance retirado da carta',money(r.bidEmbedded)],['Complemento para usar no imóvel',money(r.complement)],['Desconto estimado sobre rendimentos',money(r.hypotheticalTax)],['Valor estimado menos o que falta pagar',money(r.netEquity)]];
 $('breakdown').innerHTML=pairs.map(([l,v])=>`<div><span>${l}</span><strong>${v}</strong></div>`).join('');$('event-details').hidden=true;
 if(summary.sale&&r.month>=summary.sale.month){const s=summary.sale;$('event-details').hidden=false;$('event-details').innerHTML=`Na venda simulada do mês <b>${s.month}</b>, você recebe <b>${money(s.net)}</b> líquidos.<br>Até a venda, já pagou ${money(s.paidUntilSale)}. Resultado naquele momento: <b>${money(s.resultAtSale)}</b>.<br>O comprador assume ${money(s.transferredDebt)} de saldo e taxas restantes.`;}
 else if(summary.property&&r.month>=summary.property.month){const p=summary.property;$('event-details').hidden=false;$('event-details').innerHTML=`No mês <b>${p.month}</b>, você usa <b>${money(p.creditUsed)}</b> do crédito.<br>Precisará completar com <b>${money(p.complement)}</b> do seu bolso, incluindo ${money(p.costs)} de custos.<br>Crédito que sobra, vinculado à administradora: ${money(p.residualCredit)}. Desconto informado sobre rendimentos no uso: ${money(p.realizedTax)}.`;}
 if($('chart-details').open)renderChart();
}
function jumpMonth(target){const c=state.result.config;return target==='start'?1:target==='end'?c.horizon:target==='event'?(c.scenario==='sale'?c.saleMonth:c.useMonth):c.contemplationMonth;}
function renderChart(){
 const rows=state.result.rows,w=720,h=260,left=50,right=10,top=14,bottom=35,max=Math.max(1,...rows.flatMap(r=>[r.assets,r.totalPaid,r.debt]))*1.12;
 const x=m=>left+(m-1)/(rows.length-1)*(w-left-right),y=v=>h-bottom-v/max*(h-top-bottom);
 const line=key=>rows.map((r,i)=>`${i?'L':'M'}${x(r.month).toFixed(2)},${y(r[key]).toFixed(2)}`).join(' ');
 let guides='';for(let i=0;i<=4;i++){const value=max*i/4,yy=y(value),m=Math.round(1+(rows.length-1)*i/4);guides+=`<line x1="${left}" x2="${w-right}" y1="${yy}" y2="${yy}" stroke="#2c3850" stroke-dasharray="3 5"/><text x="${left-10}" y="${yy+3}" text-anchor="end" fill="#90a2bd" font-size="9">${compact(value)}</text><text x="${x(m)}" y="${h-12}" text-anchor="middle" fill="#90a2bd" font-size="9">${m}m</text>`;}
 const s=rows[state.selected-1];$('chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3677ff" stop-opacity=".2"/><stop offset="100%" stop-color="#3677ff" stop-opacity="0"/></linearGradient></defs>${guides}<path d="${line('assets')} L${x(rows.length)},${y(0)} L${x(1)},${y(0)} Z" fill="url(#area)"/><path d="${line('assets')}" fill="none" stroke="#568cff" stroke-width="2.5" vector-effect="non-scaling-stroke"/><path d="${line('totalPaid')}" fill="none" stroke="#a2b2ca" stroke-width="1.8" vector-effect="non-scaling-stroke"/><path d="${line('debt')}" fill="none" stroke="#e1b183" stroke-width="1.5" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/><line x1="${x(s.month)}" x2="${x(s.month)}" y1="${top}" y2="${h-bottom}" stroke="#779bce" stroke-dasharray="3 4"/><circle cx="${x(s.month)}" cy="${y(s.assets)}" r="4" fill="#d4e4ff" stroke="#3677ff" stroke-width="2"/></svg>`;
 $('chart').setAttribute('aria-label',`Em ${rows.length} meses. No mês ${s.month}: patrimônio ${money(s.assets)}, desembolso ${money(s.totalPaid)} e dívida ${money(s.debt)}. Dados completos na tabela abaixo.`);
}
function renderTable(){
 if(!state.result)return;const rows=state.result.rows.slice(state.page*12,state.page*12+12);
 $('monthly-body').innerHTML=rows.map(r=>`<tr class="${r.month===state.selected?'selected':''}"><td>${r.month}<small>${r.date}</small></td><td>${money(r.installment)}</td><td>${money(r.debt)}</td><td>${money(r.assets)}</td><td class="${r.result>=0?'positive':'negative'}">${money(r.result)}</td><td>${r.indexMonth?pct(r.indexPercent):'—'}<small class="origin ${r.indexSource.startsWith('Publicado')?'real':''}">${esc(r.indexSource)}</small></td></tr>`).join('');
 const pages=Math.ceil(state.result.rows.length/12);$('page-label').textContent=`Página ${state.page+1} de ${pages}`;$('prev-page').disabled=state.page===0;$('next-page').disabled=state.page>=pages-1;
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
 $('timing-note').hidden=true;$('manual-upload').value='';closeDetails();recalculate();renderIndex();showStep(0,false);$('save-status').textContent='Guarde neste navegador ou baixe um arquivo para abrir depois.';
}
form.addEventListener('submit',e=>{e.preventDefault();if(state.step<3)navigate(state.step+1);});
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
$('timeline').addEventListener('input',e=>{state.selected=Number(e.target.value);state.page=Math.floor((state.selected-1)/12);renderSelected();renderTable();});
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>{if(!state.result)return;state.selected=jumpMonth(b.dataset.jump);state.page=Math.floor((state.selected-1)/12);renderSelected();renderTable();}));
$('chart-details').addEventListener('toggle',()=>{if($('chart-details').open&&state.result)renderChart();});
$('prev-page').addEventListener('click',()=>{state.page=Math.max(0,state.page-1);renderTable();});$('next-page').addEventListener('click',()=>{state.page=Math.min(Math.ceil(state.result.rows.length/12)-1,state.page+1);renderTable();});$('refresh-index').addEventListener('click',()=>refreshIndex());
$('reset').addEventListener('click',()=>{if(state.dirty&&!confirm('Começar uma nova simulação? As alterações ainda não salvas serão descartadas.'))return;newSimulation();refreshIndex(true);$('step-title-0').focus();});
$('compare').addEventListener('click',()=>{
 if(!state.valid)return;const columns=['linear','reduced'].map(plan=>{try{return {plan,result:simulate({...state.result.config,plan},state.index)};}catch(e){return {plan,error:e.message};}});
 $('comparison').innerHTML=`<div class="table-scroll"><table><thead><tr><th>Tipo de parcela</th><th>Primeira parcela</th><th>Após contemplação*</th><th>Total pago</th><th>Resultado ao final</th></tr></thead><tbody>${columns.map(({plan,result:r,error})=>error?`<tr><td>${plan==='linear'?'Integral':'Reduzida'}</td><td colspan="4">${esc(error)}</td></tr>`:`<tr><td>${plan==='linear'?'Integral (linear)':'Reduzida'}</td><td>${money(r.summary.firstInstallment)}</td><td>${afterPayment(r).value===null?'Fora do período':money(afterPayment(r).value)}</td><td>${money(r.final.totalPaid)}</td><td>${money(r.final.result)}</td></tr>`).join('')}</tbody></table></div>${help('Mesmos valores, datas e taxas. Total pago e resultado no fim da simulação; sem o seguro quando não informado. *Se a contemplação ocorrer no último mês, mostramos a última parcela. Se a cota já foi vendida, as parcelas passam ao comprador.')}`;$('comparison').hidden=false;
});
function download(name,type,contents){const url=URL.createObjectURL(new Blob([contents],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-csv').addEventListener('click',()=>{
 if(!state.result)return;const heads=['Mes','Competencia','Parcela','Principal pago','Administracao','Reserva','Seguro','Lance proprio','Lance embutido','Complementacao','Total pago','Principal restante','Falta pagar','Valor estimado','Resultado nominal','Retorno no periodo %','Indice %','Reajuste aplicado %','Origem'];
 const lines=state.result.rows.map(r=>[r.month,r.date,r.installment,r.amortization,r.adminFee,r.reserveFee,r.insurance,r.bidCash,r.bidEmbedded,r.complement,r.totalPaid,r.principal,r.debt,r.assets,r.result,r.roiPercent,r.indexPercent,r.appliedPercent,r.indexSource]);
 const csv=[heads,...lines].map(row=>row.map(v=>typeof v==='number'?v.toFixed(2).replace('.',','):`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\r\n');download('demonstrativo-consorcio.csv','text/csv;charset=utf-8','\ufeff'+csv);
});
$('export-json').addEventListener('click',()=>{if(state.result)download('simulacao-consorcio.json','application/json',JSON.stringify({version:state.result.version,config:state.result.config,index:state.index,result:state.result},null,2));});
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
 clearTimeout(editTimer);recalculate();if(!state.result)return;
 download('meu-plano-consorcio.json','application/json',JSON.stringify({version:2,config:state.result.config,index:state.index},null,2));
 toast('Arquivo preparado. Guarde-o para abrir em outro momento.');
});
$('save').addEventListener('click',()=>{
 clearTimeout(editTimer);recalculate();if(!state.valid)return;
 try{
  const d=savePlan(window.localStorage,{config:state.result.config,index:state.index});state.indexRequest++;state.index=d.index;$('refresh-index').disabled=false;state.dirty=false;recalculate();
  $('save-status').textContent='Guardado neste navegador. Encontre em “Planos guardados”.';toast('Plano guardado aqui.');
 }catch(e){toast(e.message,true);}
});
function loadSaved(){
 try{const plans=listPlans(window.localStorage);$('saved-list').innerHTML=plans.length?plans.map(s=>`<div class="saved-item"><div><strong>${esc(s.name)}</strong><small>${new Date(s.savedAt).toLocaleString('pt-BR')}</small></div><div class="actions"><button class="button secondary small" data-load="${s.id}">Abrir</button><button class="text-button" data-delete="${s.id}">Excluir</button></div></div>`).join(''):'<p>Ainda não há planos guardados aqui. Faça uma simulação e clique em “Guardar aqui” no resultado.</p>';}catch(e){$('saved-list').textContent=e.message;}
}
function openSnapshot(d,{imported=false}={}){
 state.indexRequest++;clearTimeout(editTimer);state.index={...d.index,status:'snapshot'};setFields(d.config);state.committed={...state.config};state.selected=d.config.horizon;state.page=Math.floor((state.selected-1)/12);state.dirty=imported;
 $('timing-note').hidden=true;$('manual-upload').value='';closeDetails();recalculate();renderIndex();$('refresh-index').disabled=false;
 $('save-status').textContent=imported?'Arquivo aberto. Clique em “Guardar aqui” para salvá-lo neste navegador.':'Plano guardado aberto. Salvar de novo cria outra cópia.';
 if(state.valid)showStep(3);else{showStep(2);showError(state.error,engineErrorField(state.error));}
}
$('open-saved').addEventListener('click',()=>{$('saved-dialog').showModal();loadSaved();});
$('saved-list').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 try{
  if(b.dataset.load){if(state.dirty&&!confirm('Abrir outro plano e descartar as alterações ainda não guardadas?'))return;const d=getPlan(window.localStorage,b.dataset.load);$('saved-dialog').close();openSnapshot(d);toast('Plano aberto com os índices usados no salvamento.');}
  if(b.dataset.delete&&confirm('Excluir este plano deste navegador?')){removePlan(window.localStorage,b.dataset.delete);loadSaved();}
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
$('open-rules').addEventListener('click',()=>$('rules-dialog').showModal());document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
setInterval(()=>{if(document.visibilityState==='visible'&&state.index.status!=='snapshot')refreshIndex(true);},6*3600000);
newSimulation();
void refreshIndex(true);
