// Autenticação opcional durante a migração. AUTH_MODE=required protege o servidor.
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createAccess,AccessError,credentials} from './src/auth.mjs';
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
const AUTH_MODE=process.env.AUTH_MODE||'public';
if(!['public','required'].includes(AUTH_MODE))throw new Error('AUTH_MODE inválido.');
const access=AUTH_MODE==='required'?createAccess({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY,secure:PROD,origin:ORIGIN}):null;
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
const files=new Map([['/',['index.html','text/html']],['/app.js',['app.js','text/javascript']],['/journey.js',['journey.js','text/javascript']],['/storage.js',['storage.js','text/javascript']],['/savings.js',['savings.js','text/javascript']],['/engine.js',['engine.js','text/javascript']],['/styles.css',['styles.css','text/css']],['/favicon.svg',['favicon.svg','image/svg+xml']],['/logo.jpg',['logo.jpg','image/jpeg']],['/login',['login.html','text/html']],['/login.js',['login.js','text/javascript']],['/admin',['admin.html','text/html']],['/admin.js',['admin.js','text/javascript']],['/account.js',['account.js','text/javascript']]]);
const publicFiles=new Set(['/logo.jpg','/favicon.svg','/styles.css','/login','/login.js']);
const redirect=res=>{res.writeHead(303,{Location:'/login','Cache-Control':'no-store'});res.end();};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 if(PROD)res.setHeader('Strict-Transport-Security','max-age=31536000');
 try{
  const url=new URL(req.url,ORIGIN),method=req.method;
  if(url.pathname==='/health'&&method==='GET')return json(res,200,{ok:true});
  if(url.pathname==='/login'&&!access){res.writeHead(303,{Location:'/'});return res.end();}
  if(access&&method!=='GET'&&method!=='HEAD'&&(!origins.has(req.headers.origin)||req.headers['sec-fetch-site']==='cross-site'))throw new HttpError(403,'Abra o sistema pelo endereço configurado.');
  if(url.pathname==='/api/me'&&method==='GET'){
   if(!access)return json(res,200,{enabled:false});
   const c=await access.identity(req,res);return json(res,200,{enabled:true,user:c.user});
  }
  if(access&&url.pathname.startsWith('/api/auth/')&&method==='POST'){
   rateLimit(`auth:${req.socket.remoteAddress}`,120,15*60000);
   if(url.pathname==='/api/auth/logout')return json(res,200,await access.logout(req,res));
   if(['/api/auth/login','/api/auth/register'].includes(url.pathname)){
    const d=await body(req),register=url.pathname.endsWith('/register');
    const valid=credentials(d,{register});
    rateLimit(`login:${createHash('sha256').update(valid.email).digest('hex')}`,12,15*60000);
    return json(res,200,register?await access.register(d):await access.login(d,res));
   }
   throw new HttpError(404,'Rota não encontrada.');
  }
  if(access&&!publicFiles.has(url.pathname)){
   let c;try{c=access.requireActive(await access.identity(req,res));}
   catch(e){if(url.pathname==='/'&&[401,403].includes(e.status))return redirect(res);throw e;}
   if(url.pathname==='/admin'||url.pathname==='/admin.js'||url.pathname.startsWith('/api/admin/'))access.requireAdmin(c);
   if(url.pathname==='/api/admin/users'&&method==='GET')return json(res,200,await access.list(c,Number(url.searchParams.get('page')||0)));
   if(url.pathname==='/api/admin/status'&&method==='POST'){const d=await body(req);return json(res,200,await access.status(c,d.id,d.status));}
  }
  if(!access&&(url.pathname==='/admin'||url.pathname==='/admin.js'))throw new HttpError(404,'Página não encontrada.');
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
  if(method==='GET'&&file){res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','Cache-Control':access?'no-store':'no-cache'});return res.end(await readFile(path.join(ROOT,'public',file[0])));}
  throw new HttpError(404,'Página não encontrada.');
 }catch(e){
  if(e instanceof ValidationError)return json(res,400,{error:e.message,errors:e.errors});
  if(e instanceof HttpError||e instanceof AccessError)return json(res,e.status,{error:e.message});
  console.error('Falha interna:',e.message);if(!res.headersSent)json(res,500,{error:'Não foi possível concluir a operação.'});else res.end();
 }
});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(PORT,HOST,()=>console.log(`Iran Solutions em ${ORIGIN}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
