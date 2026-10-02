// Regras de apresentação. As fórmulas financeiras continuam em engine.js.
export const GOALS=Object.freeze({hold:'Render',sale:'Vender'});
export function assertSupportedScenario(scenario){
  if(!Object.hasOwn(GOALS,scenario))throw new Error('Este plano usa uma opção de imóvel que foi removida. Crie uma nova simulação em Render ou Vender. O plano original foi preservado.');
}
export function duration(months){
  if(!Number.isInteger(months)||months<1)return 'Informe o prazo';
  const years=Math.floor(months/12),rest=months%12;
  return [years?`${years} ${years===1?'ano':'anos'}`:'',rest?`${rest} ${rest===1?'mês':'meses'}`:''].filter(Boolean).join(' e ');
}
export function contemplationOptions(term){
  if(!Number.isInteger(term)||term<2||term>480)return [];
  const months=Array.from({length:Math.floor(term/12)},(_,i)=>(i+1)*12);
  if(term%12)months.push(term);
  return months.map(month=>({month,label:`${duration(month)} · mês ${month}${month===term?' (fim do contrato)':''}`}));
}
export function chartMonthAt(fraction,count){
  return 1+Math.round(Math.max(0,Math.min(1,fraction))*(count-1));
}
export function firstPayment(c){
  if(![c.credit,c.term,c.adminPercent,c.reservePercent].every(v=>typeof v==='number'&&Number.isFinite(v))||c.credit<1000||c.term<2)return null;
  const principal=c.plan==='reduced'?c.credit/2:c.credit;
  const insurance=c.insuranceBefore||c.contemplationMonth===1?(c.insuranceMonthly??0):0;
  return (principal+c.credit*(c.adminPercent+c.reservePercent)/100)/c.term+insurance;
}
export function syncChoices(input,previous,key){
  const c={...input},changes=[];
  const put=(name,value,label)=>{if(c[name]!==value){c[name]=value;changes.push(label);}};
  if(key==='scenario'&&c.scenario==='property')put('segment','imovel','tipo de consórcio para imóvel');
  if(key==='segment'&&c.segment!=='imovel'&&c.scenario==='property')put('scenario','hold','objetivo para deixar o crédito rendendo');
  if(key==='bidType'){
    const presets={draw:[0,0],free:[20,0],fixed25:[15,10],fixed40:[20,20],loyalty:[20,25]};
    if(presets[c.bidType]){[c.ownBidPercent,c.embeddedBidPercent]=presets[c.bidType];}
    if(c.bidType==='loyalty'&&c.term>=c.loyaltyMin)put('contemplationMonth',Math.min(Math.max(c.contemplationMonth,c.loyaltyMin),c.loyaltyMax,c.term),'mês da contemplação');
  }
  if(key==='term'&&Number.isInteger(c.term)&&c.term>=2&&c.term<=480){
    if(c.contemplationMonth>c.term)put('contemplationMonth',c.term,'mês da contemplação');
    if(previous.horizon===previous.term)put('horizon',c.term,'duração da simulação');
  }
  const m=c.contemplationMonth;
  if(['term','contemplationMonth','bidType'].includes(key)&&Number.isInteger(m)&&m>=1&&m<=c.term){
    if(c.horizon<m)put('horizon',m,'duração da simulação');
    for(const [name,label] of [['saleMonth','mês da venda'],['useMonth','mês de uso']]){
      if(c[name]<m||c[name]>c.horizon||c[name]===previous.contemplationMonth)put(name,Math.min(Math.max(c[name]===previous.contemplationMonth?m:c[name],m),c.horizon),label);
    }
  }
  return {config:c,changes};
}
export function assetCopy(c,r){
  if(r.month<c.contemplationMonth)return {label:'Crédito ainda não liberado',note:'Direito ao crédito. Você ainda não pode usar esse valor.'};
  if(r.sold)return {label:'Dinheiro investido após a venda',note:'Valor recebido na venda, com os rendimentos simulados e descontos informados.'};
  if(r.used)return {label:'Valor estimado do seu patrimônio',note:'Valor do imóvel ou benefício informado, mais eventual crédito que sobrou.'};
  return {label:'Valor estimado do crédito',note:'Crédito vinculado à administradora. Não representa dinheiro livre para saque.'};
}
export function afterPayment(result){
  const c=result.config;
  if(c.contemplationMonth===c.term)return {value:result.rows[c.term-1].installment,label:'Última parcela, na contemplação',note:`Mês ${c.term}: todo o saldo restante é pago neste mês.`};
  const row=result.rows[c.contemplationMonth];
  if(!row)return {value:null,label:'Após a contemplação',note:'Aumente a duração da simulação nos ajustes para visualizar essa parcela.'};
  if(row.sold&&c.saleMonth<row.month)return {value:0,label:'Depois da venda',note:'A simulação considera que o comprador assume as parcelas restantes.'};
  return {value:row.installment,label:'Parcela após a contemplação',note:`Valor estimado no mês ${row.month}. Pode mudar com novos reajustes.`};
}
