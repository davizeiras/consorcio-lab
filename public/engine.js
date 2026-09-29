// Motor puro compartilhado entre navegador e servidor. Consulte docs/REGRAS.md.
export const VERSION = '1.0.0';
export const DEFAULTS = Object.freeze({
  name:'Meu primeiro cenário', segment:'imovel', credit:150000, term:220, plan:'reduced',
  adminPercent:24, reservePercent:0.2, insuranceMonthly:null, insuranceBefore:false,
  startMonth:new Date().toISOString().slice(0,7), indexVariant:'INCC-M',
  adjustmentFrequency:'annual', forecastAnnual:6, indexLag:1,
  contemplationMonth:60, bidType:'draw', ownBidPercent:0, embeddedBidPercent:0,
  loyaltyMin:13, loyaltyMax:36, loyaltyMinBid:40, loyaltyMaxBid:50,
  scenario:'hold', horizon:220, creditAnnualReturn:14, cashAnnualReturn:14,
  incomeTaxPercent:0, saleMonth:60, salePercent:45, saleExtra:0, saleFee:0, saleGainTaxPercent:0,
  useMonth:60, usePurpose:'buy', propertyPrice:180000, propertyCosts:0,
  propertyAnnualReturn:0, propertyBenefit:null
});
export const annualToMonthly = p => Math.expm1(Math.log1p(p/100)/12);
export function monthAdd(month,offset) {
  const [y,m]=month.split('-').map(Number);
  return new Date(Date.UTC(y,m-1+offset,1)).toISOString().slice(0,7);
}
export class ValidationError extends Error {
  constructor(errors) {super(errors.join(' '));this.errors=errors;this.name='ValidationError';}
}
const names={credit:'Crédito',term:'Prazo',horizon:'Horizonte',adminPercent:'Administração',reservePercent:'Reserva',insuranceMonthly:'Seguro mensal',forecastAnnual:'Reajuste estimado',indexLag:'Defasagem',contemplationMonth:'Mês da contemplação',ownBidPercent:'Lance próprio',embeddedBidPercent:'Lance embutido',loyaltyMin:'Primeiro mês de fidelidade',loyaltyMax:'Último mês de fidelidade',loyaltyMinBid:'Lance mínimo',loyaltyMaxBid:'Lance máximo',creditAnnualReturn:'Rendimento do crédito',cashAnnualReturn:'Rendimento após venda',propertyAnnualReturn:'Valorização do imóvel',incomeTaxPercent:'Desconto sobre rendimentos',saleGainTaxPercent:'Tributo na cessão',saleMonth:'Mês da venda',useMonth:'Mês de uso',salePercent:'Preço percentual da cessão',saleExtra:'Reembolso adicional',saleFee:'Custos da cessão',propertyCosts:'Custos do imóvel',propertyPrice:'Valor da operação',propertyBenefit:'Benefício patrimonial'};
export function validateConfig(input={}) {
  const c={...DEFAULTS},errors=[];
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ValidationError(['Configuração inválida.']);
  for(const k of Object.keys(c))if(Object.hasOwn(input,k))c[k]=input[k];
  const num=(k,min,max,int=false,nullable=false)=>{
    if(nullable&&(c[k]===null||c[k]==='')){c[k]=null;return;}
    if(c[k]===''||c[k]===null||typeof c[k]==='boolean'){errors.push(`Informe ${names[k]}.`);return;}
    c[k]=Number(c[k]);
    if(!Number.isFinite(c[k])||c[k]<min||c[k]>max||(int&&!Number.isInteger(c[k])))errors.push(`${names[k]}: use ${int?'um inteiro':'um valor'} entre ${min} e ${max}.`);
  };
  const choice=(k,values)=>{if(!values.includes(c[k]))errors.push(`Opção inválida para ${k}.`);};
  num('credit',1000,100000000);num('term',2,480,true);num('horizon',2,600,true);
  num('adminPercent',0,100);num('reservePercent',0,20);num('insuranceMonthly',0,100000,false,true);
  num('forecastAnnual',-50,100);num('indexLag',1,6,true);num('contemplationMonth',1,c.term,true);
  for(const k of ['ownBidPercent','embeddedBidPercent','loyaltyMinBid','loyaltyMaxBid'])num(k,0,100);
  num('loyaltyMin',1,480,true);num('loyaltyMax',c.loyaltyMin,480,true);
  for(const k of ['creditAnnualReturn','cashAnnualReturn','propertyAnnualReturn'])num(k,-50,100);
  for(const k of ['incomeTaxPercent','saleGainTaxPercent'])num(k,0,100);
  num('saleMonth',1,600,true);num('useMonth',1,600,true);num('salePercent',0,45);
  for(const k of ['saleExtra','saleFee','propertyCosts'])num(k,0,100000000);
  num('propertyPrice',1,100000000);num('propertyBenefit',0,100000000,false,true);
  choice('segment',['imovel','veiculo','bens','servicos']);choice('plan',['linear','reduced']);
  choice('indexVariant',['INCC-M','INCC-DI','manual']);choice('adjustmentFrequency',['annual','monthly']);
  choice('bidType',['draw','free','fixed25','fixed40','loyalty']);choice('scenario',['hold','sale','property']);
  choice('usePurpose',['buy','build','renovate','payoff']);
  if(typeof c.insuranceBefore!=='boolean')errors.push('Escolha se o seguro incide antes da contemplação.');
  if(typeof c.startMonth!=='string'||!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(c.startMonth))errors.push('Data inicial inválida.');
  if(typeof c.name!=='string'||!c.name.trim()||c.name.length>100)errors.push('Use um nome de cenário com até 100 caracteres.');else c.name=c.name.trim();
  if(c.horizon<c.contemplationMonth)errors.push('O horizonte deve incluir a contemplação.');
  const bid=c.ownBidPercent+c.embeddedBidPercent;
  if(c.bidType==='draw'&&bid!==0)errors.push('Sorteio não tem lance: zere os percentuais.');
  if(c.bidType!=='draw'&&(bid<=0||bid>100))errors.push('O lance total precisa ser maior que zero e até 100%.');
  if(c.bidType==='fixed25'&&Math.abs(bid-25)>0.00001)errors.push('Próprio + embutido precisam somar 25%.');
  if(c.bidType==='fixed40'&&Math.abs(bid-40)>0.00001)errors.push('Próprio + embutido precisam somar 40%.');
  if(c.bidType==='loyalty'){
    if(c.contemplationMonth<c.loyaltyMin||c.contemplationMonth>c.loyaltyMax)errors.push(`Fidelidade: contemplação entre os meses ${c.loyaltyMin} e ${c.loyaltyMax}.`);
    if(c.loyaltyMaxBid<c.loyaltyMinBid||bid<c.loyaltyMinBid||bid>c.loyaltyMaxBid)errors.push(`Fidelidade: lance entre ${c.loyaltyMinBid}% e ${c.loyaltyMaxBid}%.`);
  }
  const event=c.scenario==='sale'?c.saleMonth:c.useMonth;
  if(c.scenario!=='hold'&&(event<c.contemplationMonth||event>c.horizon))errors.push('A venda ou o uso precisam ocorrer entre a contemplação e o fim do horizonte.');
  if(c.scenario==='property'&&c.segment!=='imovel')errors.push('A utilização imobiliária exige o segmento imóvel.');
  if(c.scenario==='property'&&['renovate','payoff'].includes(c.usePurpose)&&c.propertyBenefit===null)errors.push('Reforma e quitação exigem informar o benefício patrimonial, separadamente do gasto.');
  if(errors.length)throw new ValidationError(errors);return c;
}
export function validatePoints(points=[]) {
  if(!Array.isArray(points)||points.length>2500)throw new ValidationError(['Histórico de índices inválido.']);
  const seen=new Set();
  return points.map(p=>{
    if(!p||typeof p.month!=='string'||!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(p.month)||typeof p.percent!=='number'||!Number.isFinite(p.percent)||p.percent<=-100||p.percent>100||seen.has(p.month))throw new ValidationError(['Índices: competência única AAAA-MM e percentual numérico maior que -100 e até 100.']);
    seen.add(p.month);return {month:p.month,percent:p.percent};
  }).sort((a,b)=>a.month.localeCompare(b.month));
}
export function simulate(input,indexData={points:[],provenance:'unavailable'}) {
  const c=validateConfig(input),points=validatePoints(indexData.points||[]),index=new Map(points.map(p=>[p.month,p.percent]));
  const today=new Date().toISOString().slice(0,7),forecast=annualToMonthly(c.forecastAnnual);
  const rCredit=annualToMonthly(c.creditAnnualReturn),rCash=annualToMonthly(c.cashAnnualReturn),rProperty=annualToMonthly(c.propertyAnnualReturn);
  const messages=['O mês da contemplação é uma hipótese; não prevê sorteio nem lance vencedor.'];
  if(c.insuranceMonthly===null)messages.push('Seguro prestamista não informado: resultados parciais, sem esse custo.');
  if(c.incomeTaxPercent===0)messages.push('Rendimentos sem desconto de tributos. Informe a alíquota efetiva para simular esse custo.');
  if(c.segment!=='imovel')messages.push('Confirme o indexador: veículos, bens e serviços não devem receber INCC automaticamente.');
  if(c.scenario==='hold')messages.push('O crédito aplicado permanece vinculado à administradora. A taxa informada é hipotética; não representa saque livre.');
  if(c.scenario==='sale')messages.push('Cessão hipotética aprovada: comprador assume obrigações futuras. Preço e rendimento não são garantidos.');
  if(c.scenario==='property')messages.push('Utilização depende de aprovação e garantias exigidas pela administradora. Custos da operação são pagos com recursos próprios neste modelo.');
  let principal=c.credit,admin=c.credit*c.adminPercent/100,reserve=c.credit*c.reservePercent/100;
  const adminBase=admin/c.term,reserveBase=reserve/c.term;
  let referenceCredit=c.credit,correctionFactor=1,pendingFactor=1;
  let creditAccount=0,creditBasis=0,cash=0,cashBasis=0,property=0;
  let totalPaid=0,totalPrincipalPaid=0,totalCorrection=0,totalInsurance=0,totalAdmin=0,totalReserve=0;
  let ownBid=0,embeddedBid=0,sold=false,used=false,contemplatedCredit=0,saleDetails=null,propertyDetails=null;
  let estimatedMonths=0,historicalGaps=0,publishedMonths=0;
  const rows=[];
  for(let m=1;m<=c.horizon;m++){
    const date=monthAdd(c.startMonth,m-1);
    // Um rendimento completo começa no mês seguinte ao recebimento.
    if(m>c.contemplationMonth)creditAccount*=1+rCredit;
    if(sold)cash*=1+rCash;if(used)property*=1+rProperty;
    let indexPercent=0,correction=0,appliedPercent=0,indexSource='Sem reajuste',indexMonth=null;
    let amortization=0,adminFee=0,reserveFee=0,insurance=0,bidCash=0,bidEmbedded=0,complement=0;
    if(m<=c.term&&!sold){
      if(m>1){
        indexMonth=monthAdd(date,-c.indexLag);
        const known=index.has(indexMonth)&&indexMonth<=today;
        indexPercent=known?index.get(indexMonth):forecast*100;
        if(known){publishedMonths++;indexSource=indexData.provenance==='bcb'?'Publicado · BCB/FGV':'Histórico informado';}
        else {estimatedMonths++;indexSource='Hipótese futura';if(indexMonth<today){historicalGaps++;indexSource='Estimado · histórico ausente';}}
        pendingFactor*=1+indexPercent/100;
        if(c.adjustmentFrequency==='monthly'||(m-1)%12===0){
          appliedPercent=(pendingFactor-1)*100;correction=principal*(pendingFactor-1);
          principal+=correction;totalCorrection+=correction;correctionFactor*=pendingFactor;
          if(m<=c.contemplationMonth)referenceCredit*=pendingFactor;pendingFactor=1;
        }
      }
      const left=c.term-m+1;
      const reduced=c.plan==='reduced'&&m<=c.contemplationMonth&&m<c.term;
      amortization=Math.min(principal,reduced?c.credit*0.5/c.term*correctionFactor:principal/left);
      adminFee=m===c.term?admin:Math.min(admin,adminBase);reserveFee=m===c.term?reserve:Math.min(reserve,reserveBase);
      insurance=(c.insuranceBefore||m>=c.contemplationMonth)?(c.insuranceMonthly??0):0;
      principal=Math.max(0,principal-amortization);admin=Math.max(0,admin-adminFee);reserve=Math.max(0,reserve-reserveFee);
      totalPrincipalPaid+=amortization;totalAdmin+=adminFee;totalReserve+=reserveFee;totalInsurance+=insurance;
    }
    const installment=amortization+adminFee+reserveFee+insurance;totalPaid+=installment;
    if(m===c.contemplationMonth){
      contemplatedCredit=referenceCredit;bidCash=referenceCredit*c.ownBidPercent/100;bidEmbedded=referenceCredit*c.embeddedBidPercent/100;
      if(bidCash+bidEmbedded>principal+0.001)throw new ValidationError(['O lance supera o principal restante após a parcela do mês. Reduza o lance ou antecipe a contemplação.']);
      principal=Math.max(0,principal-bidCash-bidEmbedded);ownBid=bidCash;embeddedBid=bidEmbedded;totalPaid+=bidCash;
      creditAccount=referenceCredit-bidEmbedded;creditBasis=creditAccount;
    }
    if(c.scenario==='sale'&&m===c.saleMonth){
      const gross=creditAccount*c.salePercent/100+c.saleExtra,gain=Math.max(0,gross-c.saleFee-totalPaid),tax=gain*c.saleGainTaxPercent/100,net=gross-c.saleFee-tax;
      if(net<0)throw new ValidationError(['O custo da cessão supera o recebimento. Revise o preço e os custos.']);
      saleDetails={month:m,availableCredit:creditAccount,gross,fee:c.saleFee,tax,net,paidUntilSale:totalPaid,resultAtSale:net-totalPaid,transferredDebt:principal+admin+reserve};
      cash=net;cashBasis=net;creditAccount=0;creditBasis=0;principal=0;admin=0;reserve=0;sold=true;
    }
    if(c.scenario==='property'&&m===c.useMonth){
      const realizedTax=Math.max(0,creditAccount-creditBasis)*c.incomeTaxPercent/100;
      creditAccount-=realizedTax;creditBasis=creditAccount;
      const creditUsed=Math.min(creditAccount,c.propertyPrice);
      complement=Math.max(0,c.propertyPrice-creditUsed)+c.propertyCosts;
      const ratio=creditAccount?(creditAccount-creditUsed)/creditAccount:0;
      creditAccount-=creditUsed;creditBasis*=ratio;property=c.propertyBenefit??c.propertyPrice;totalPaid+=complement;used=true;
      propertyDetails={month:m,price:c.propertyPrice,creditUsed,complement,costs:c.propertyCosts,realizedTax,residualCredit:creditAccount,benefit:property};
    }
    const hypotheticalTax=(Math.max(0,creditAccount-creditBasis)+Math.max(0,cash-cashBasis))*c.incomeTaxPercent/100;
    const creditRight=m<c.contemplationMonth?referenceCredit:0,grossAssets=creditRight+creditAccount+cash+property;
    const assets=grossAssets-hypotheticalTax,debt=principal+admin+reserve,netEquity=assets-debt,result=netEquity-totalPaid;
    const row={month:m,date,phase:m<c.contemplationMonth?'Contratação':m===c.contemplationMonth?'Contemplação':'Utilização',indexMonth,indexPercent,appliedPercent,indexSource,correction,correctionPercent:(correctionFactor-1)*100,amortization,adminFee,reserveFee,insurance,installment,bidCash,bidEmbedded,complement,outflow:installment+bidCash+complement,totalPaid,principal,adminRemaining:admin,reserveRemaining:reserve,debt,creditRight,creditAccount,cash,property,grossAssets,hypotheticalTax,assets,netEquity,result,roiPercent:totalPaid>0?result/totalPaid*100:null,sold,used};
    for(const v of Object.values(row))if(typeof v==='number'&&!Number.isFinite(v))throw new ValidationError(['Cenário excede os limites numéricos.']);
    rows.push(row);
  }
  if(historicalGaps)messages.push(`${historicalGaps} competências passadas ausentes: foi utilizada a hipótese de reajuste, identificada na tabela.`);
  if(estimatedMonths)messages.push(`${estimatedMonths} competências usam o reajuste estimado de ${c.forecastAnnual}% a.a.; o INCC futuro não é conhecido.`);
  if(c.plan==='reduced'&&c.contemplationMonth===c.term)messages.push('Contemplação no último mês: todo o principal remanescente vence na última parcela neste modelo.');
  return {version:VERSION,config:c,messages,rows,final:rows.at(-1),summary:{firstInstallment:rows[0].installment,nextInstallment:rows[c.contemplationMonth]?.installment??0,contemplatedCredit,availableAtContemplation:contemplatedCredit-embeddedBid,ownBid,embeddedBid,totalPrincipalPaid,totalAdmin,totalReserve,totalInsurance,totalCorrection,publishedMonths,estimatedMonths,historicalGaps,sale:saleDetails,property:propertyDetails}};
}
