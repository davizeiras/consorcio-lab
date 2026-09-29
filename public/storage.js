// Os planos ficam no navegador; o servidor não tem uma lista pública de simulações.
import {validateConfig,validatePoints,simulate} from './engine.js';
export const STORAGE_KEY='consorcio-lab.planos.v1';
export const MAX_PLANS=50;
export const MAX_IMPORT_BYTES=2*1024*1024;
export function normalizeSnapshot(payload,{imported=false}={}){
 if(!payload||typeof payload!=='object'||!payload.config||typeof payload.config!=='object'||Array.isArray(payload.config))throw new Error('Esse arquivo não contém uma simulação. Use um JSON baixado pelo Consórcio Lab.');
 const config=validateConfig(payload.config),raw=payload.index||{},points=validatePoints(raw.points||[]);
 const provenance=imported?'manual':['bcb','manual','unavailable'].includes(raw.provenance)?raw.provenance:'manual';
 const fetchedAt=typeof raw.fetchedAt==='string'&&Number.isFinite(Date.parse(raw.fetchedAt))?new Date(raw.fetchedAt).toISOString():null;
 const latest=points.filter(p=>p.month<=new Date().toISOString().slice(0,7)).at(-1)||null;
 const index={variant:config.indexVariant,provenance,status:'snapshot',fetchedAt,latest,points,imported:imported||raw.imported===true};
 // Resultados de um arquivo nunca são aceitos como verdade: sempre recalculamos.
 simulate(config,index);
 return {config,index};
}
export function parseImport(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw new Error('Use um arquivo JSON de até 2 MB.');
 let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('Não foi possível ler esse JSON. Escolha um arquivo baixado pelo simulador.');}
 return normalizeSnapshot(data,{imported:true});
}
function readPlans(storage){
 let raw;try{raw=storage.getItem(STORAGE_KEY);}catch{throw new Error('O navegador bloqueou o acesso às simulações. Você ainda pode simular e baixar um arquivo.');}
 if(raw===null)return [];
 try{
  if(raw.length>8*1024*1024)throw new Error();
  const data=JSON.parse(raw);
  if(data.version!==1||!Array.isArray(data.items)||data.items.length>MAX_PLANS)throw new Error();
  const ids=new Set();
  for(const item of data.items){
   if(!item||typeof item.id!=='string'||!/^[a-f0-9-]{36}$/.test(item.id)||ids.has(item.id)||typeof item.savedAt!=='string'||!Number.isFinite(Date.parse(item.savedAt))||!item.config||typeof item.config.name!=='string')throw new Error();
   ids.add(item.id);
  }
  return data.items;
 }catch{throw new Error('Não foi possível ler os planos guardados. Eles foram preservados; use “Baixar arquivo” para guardar o plano atual.');}
}
function writePlans(storage,items){
 try{storage.setItem(STORAGE_KEY,JSON.stringify({version:1,items}));}
 catch{throw new Error('Não foi possível guardar neste navegador. Baixe o arquivo da simulação para não perder seu plano.');}
}
export function listPlans(storage){return readPlans(storage).map(x=>({id:x.id,name:x.config.name,savedAt:x.savedAt}));}
export function savePlan(storage,payload,{id=globalThis.crypto.randomUUID(),savedAt=new Date().toISOString()}={}){
 const snapshot=normalizeSnapshot(payload),items=readPlans(storage);
 if(items.length>=MAX_PLANS)throw new Error('Você já guardou 50 simulações. Exclua uma ou baixe o plano em arquivo.');
 if(!/^[a-f0-9-]{36}$/.test(id)||items.some(x=>x.id===id))throw new Error('Não foi possível criar o identificador. Tente novamente.');
 const item={id,savedAt,...snapshot};writePlans(storage,[item,...items]);return item;
}
export function getPlan(storage,id){const item=readPlans(storage).find(x=>x.id===id);if(!item)throw new Error('Simulação não encontrada neste navegador.');return {id:item.id,savedAt:item.savedAt,...normalizeSnapshot(item)};}
export function removePlan(storage,id){const items=readPlans(storage);if(!items.some(x=>x.id===id))throw new Error('Simulação não encontrada.');writePlans(storage,items.filter(x=>x.id!==id));}
