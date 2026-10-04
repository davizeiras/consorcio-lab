// Servidor aberto: não recebe contas, senhas ou simulações para armazenamento.
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {simulate,validateConfig,validatePoints,ValidationError} from './public/engine.js';
import {getIndex} from './src/indices.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url)),PORT=Number(process.env.PORT||3000);
const RENDER_URL=process.env.RENDER_EXTERNAL_URL;
const HOST=process.env.HOST||(RENDER_URL?'0.0.0.0':'127.0.0.1');
const PROD=process.env.NODE_ENV==='production',ORIGIN=process.env.PUBLIC_ORIGIN||RENDER_URL||`http://localhost:${PORT}`;
const origins=new Set([ORIGIN]);if(!PROD)origins.add(`http://127.0.0.1:${PORT}`);
if(PROD&&!ORIGIN.startsWith('https://'))throw new Error('Em produção, configure PUBLIC_ORIGIN com HTTPS.');
const DATA=path.resolve(process.env.DATA_DIR||path.join(ROOT,'data'));await mkdir(DATA,{recursive:true});
// Arquivo exclusivo para os índices. O banco de contas da versão antiga não é aberto.
const db=new DatabaseSync(path.join(DATA,'indices.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS index_cache(variant TEXT PRIMARY KEY,points TEXT NOT NULL,fetched_at TEXT NOT NULL);');
const limiter=new Map();
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
function rateLimit(key,max,window){
 const now=Date.now();for(const [k,v] of limiter)if(v.reset<=now)limiter.delete(k);
 if(!limiter.has(key)&&limiter.size>=2000)throw new HttpError(429,'Muitas solicitações. Aguarde.');
 const entry=limiter.get(key)||{count:0,reset:now+window};entry.count++;limiter.set(key,entry);
 if(entry.count>max)throw new HttpError(429,'Muitas solicitações. Aguarde um minuto.');
}
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req){
 if(!(req.headers['content-type']||'').startsWith('application/json'))throw new HttpError(415,'Envie JSON.');
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>250000)throw new HttpError(413,'Requisição muito grande.');chunks.push(chunk);}
 try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return data;}
 catch{throw new HttpError(400,'JSON inválido.');}
}
const files=new Map([['/',['index.html','text/html']],['/app.js',['app.js','text/javascript']],['/journey.js',['journey.js','text/javascript']],['/storage.js',['storage.js','text/javascript']],['/savings.js',['savings.js','text/javascript']],['/engine.js',['engine.js','text/javascript']],['/styles.css',['styles.css','text/css']],['/favicon.svg',['favicon.svg','image/svg+xml']]]);
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 if(PROD)res.setHeader('Strict-Transport-Security','max-age=31536000');
 try{
  const url=new URL(req.url,ORIGIN),method=req.method;
  if(url.pathname.startsWith('/api/')){
   rateLimit(`api:${req.socket.remoteAddress}`,240,60000);
   if(url.pathname==='/api/indices'&&method==='GET'){
    const variant=url.searchParams.get('variant')||'INCC-M';if(!['INCC-M','INCC-DI','manual'].includes(variant))throw new HttpError(400,'Índice inválido.');
    return json(res,200,await getIndex(db,variant));
   }
   if(url.pathname==='/api/simulate'&&method==='POST'){
    if(!origins.has(req.headers.origin)||req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'Abra o simulador pelo endereço configurado.');
    const d=await body(req),config=validateConfig(d.config);
    const index=config.indexVariant==='manual'?{variant:'manual',provenance:'manual',status:'manual',fetchedAt:null,points:validatePoints(d.index?.points||[])}:await getIndex(db,config.indexVariant);
    return json(res,200,{result:simulate(config,index),index});
   }
   throw new HttpError(404,'Rota não encontrada.');
  }
  const file=files.get(url.pathname);
  if(method==='GET'&&file){res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','Cache-Control':'no-cache'});return res.end(await readFile(path.join(ROOT,'public',file[0])));}
  throw new HttpError(404,'Página não encontrada.');
 }catch(e){
  if(e instanceof ValidationError)return json(res,400,{error:e.message,errors:e.errors});
  if(e instanceof HttpError)return json(res,e.status,{error:e.message});
  console.error('Falha interna:',e.message);if(!res.headersSent)json(res,500,{error:'Não foi possível concluir a operação.'});else res.end();
 }
});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(PORT,HOST,()=>console.log(`Iran Solutions em ${ORIGIN}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
