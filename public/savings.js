// Comparação com os mesmos desembolsos do consórcio, sem antecipar depósitos.
export const DEFAULT_SAVINGS_RATE=0.5;
export function validateSavingsRate(rate){
 if(typeof rate!=='number'||!Number.isFinite(rate)||rate<0||rate>10)throw new Error('Informe uma taxa mensal entre 0% e 10% para a poupança.');
 return rate;
}
export function normalizeComparison(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Configuração da comparação inválida.');
 return {monthlyRate:validateSavingsRate(Object.hasOwn(input,'monthlyRate')?input.monthlyRate:DEFAULT_SAVINGS_RATE)};
}
export function simulateSavings(payments,monthlyRate=DEFAULT_SAVINGS_RATE){
 validateSavingsRate(monthlyRate);
 if(!Array.isArray(payments)||!payments.length||payments.length>600)throw new Error('Use entre 1 e 600 meses para comparar.');
 let balance=0,totalDeposited=0;
 const rows=payments.map((payment,index)=>{
  const deposit=payment.outflow;
  if(payment.month!==index+1||typeof deposit!=='number'||!Number.isFinite(deposit)||deposit<0)throw new Error('Os depósitos da comparação precisam seguir os pagamentos mensais da simulação.');
  // Depósito no fim do mês: passa a render no mês seguinte, como o crédito.
  const interest=balance*monthlyRate/100;
  balance+=interest+deposit;totalDeposited+=deposit;
  const profit=balance-totalDeposited;
  return {month:payment.month,date:payment.date,deposit,interest,totalDeposited,balance,profit,roiPercent:totalDeposited>0?profit/totalDeposited*100:null};
 });
 return {monthlyRate,rows,final:rows.at(-1)};
}
