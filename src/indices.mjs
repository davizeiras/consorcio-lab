import {validatePoints,monthAdd} from '../public/engine.js';
export const SERIES=Object.freeze({'INCC-M':7456,'INCC-DI':192});
const running=new Map(),failures=new Map(),TTL=6*3600000;
export function parseBCB(raw){
  if(!Array.isArray(raw)||!raw.length)throw new Error('Nenhuma observação retornada.');
  return validatePoints(raw.map(item=>{
    const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(item.data||''),v=String(item.valor??'').trim();
    if(!m||! /^-?\d+(?:[.,]\d+)?$/.test(v))throw new Error('Observação inválida do BCB.');
    return {month:`${m[3]}-${m[2]}`,percent:Number(v.replace(',','.'))};
  }));
}
export function describeIndex(variant,points,fetchedAt,status,error=null){
  points=points.slice().sort((a,b)=>a.month.localeCompare(b.month));
  const latest=points.at(-1)||null;let trailing12=null;
  if(latest){const map=new Map(points.map(x=>[x.month,x.percent]));const last=Array.from({length:12},(_,i)=>map.get(monthAdd(latest.month,-i)));if(last.every(x=>x!==undefined))trailing12=(last.reduce((a,x)=>a*(1+x/100),1)-1)*100;}
  return {variant,series:SERIES[variant]??null,provenance:points.length?'bcb':'unavailable',status,fetchedAt,latest,trailing12,points,error,source:SERIES[variant]?`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SERIES[variant]}/dados?formato=json`:null};
}
export async function getIndex(db,variant){
  if(variant==='manual')return describeIndex(variant,[],null,'manual');
  if(!Object.hasOwn(SERIES,variant))throw new Error('Índice desconhecido.');
  const cache=db.prepare('SELECT * FROM index_cache WHERE variant=?').get(variant);
  const cached=(status,error)=>describeIndex(variant,cache?JSON.parse(cache.points):[],cache?.fetched_at??null,status,error);
  if(cache&&Date.now()-Date.parse(cache.fetched_at)<TTL)return cached('cached');
  if(running.has(variant))return running.get(variant);
  if(Date.now()-(failures.get(variant)||0)<300000)return cached(cache?'stale':'unavailable','Consulta temporariamente indisponível. Tente novamente em alguns minutos.');
  const job=(async()=>{
    try{
      const response=await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SERIES[variant]}/dados?formato=json`,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('Resposta indisponível');
      const text=await response.text();if(text.length>1500000)throw new Error('Resposta excedeu o limite.');
      const current=new Date().toISOString().slice(0,7),points=parseBCB(JSON.parse(text)).filter(p=>p.month<=current);
      if(!points.length)throw new Error('Histórico vazio.');const fetchedAt=new Date().toISOString();
      db.prepare('INSERT INTO index_cache VALUES(?,?,?) ON CONFLICT(variant) DO UPDATE SET points=excluded.points,fetched_at=excluded.fetched_at').run(variant,JSON.stringify(points),fetchedAt);
      failures.delete(variant);return describeIndex(variant,points,fetchedAt,'updated');
    }catch{failures.set(variant,Date.now());return cached(cache?'stale':'unavailable',cache?'A consulta falhou. Exibindo o histórico preservado com sua data.':'Não foi possível consultar o BCB. Os cálculos usam hipóteses explicitamente identificadas.');}
    finally{running.delete(variant);}
  })();running.set(variant,job);return job;
}
