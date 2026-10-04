import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {DEFAULTS} from '../public/engine.js';
test('entrada direta, índice e cálculo sem login; dados antigos não são expostos',{timeout:20000},async t=>{
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const origin=`http://127.0.0.1:${port}`,dir=await mkdtemp(path.join(tmpdir(),'consorcio-open-'));
 const oldFile=path.join(dir,'consorcio.sqlite'),oldContents=Buffer.from('BANCO ANTIGO: NAO LER NEM MODIFICAR');await writeFile(oldFile,oldContents);
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'test',PORT:String(port),PUBLIC_ORIGIN:origin,HOST:'127.0.0.1',DATA_DIR:dir,AUTH_MODE:'public'}});
 let stderr='';child.stderr.on('data',b=>{stderr+=b});
 t.after(async()=>{child.kill();await new Promise(r=>{if(child.exitCode!==null)r();else child.once('exit',r)});await rm(dir,{recursive:true,force:true});});
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error(`Servidor saiu: ${code} ${stderr}`)));});
 const home=await fetch(origin),html=await home.text();assert.equal(home.status,200);assert.equal(home.headers.get('set-cookie'),null);assert.match(html,/<div id="app-view">/);assert.doesNotMatch(html,/auth-form|type="password"|type="email"/);
 for(const route of ['/app.js','/journey.js','/storage.js','/savings.js','/engine.js']){const r=await fetch(origin+route);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);}
 const index=await fetch(origin+'/api/indices?variant=manual');assert.equal(index.status,200);assert.deepEqual((await index.json()).points,[]);assert.equal(index.headers.get('set-cookie'),null);
 assert.equal((await fetch(origin+'/api/indices?variant=OUTRO')).status,400);
 const body=JSON.stringify({config:{...DEFAULTS,indexVariant:'manual',forecastAnnual:0,insuranceMonthly:0},index:{points:[]}});
 const sim=await fetch(origin+'/api/simulate',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body});assert.equal(sim.status,200);assert.equal((await sim.json()).result.rows.length,220);assert.equal(sim.headers.get('set-cookie'),null);
 assert.equal((await fetch(origin+'/api/simulate',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://outro-site.test'},body})).status,403);
 assert.equal((await fetch(origin+'/api/simulate',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:'{"config":{"term":0}}'})).status,400);
 for(const route of ['/api/simulations','/api/simulations/11111111-1111-4111-8111-111111111111','/data/consorcio.sqlite','/data/indices.sqlite','/.env']){
  const r=await fetch(origin+route,{headers:{Cookie:'consorcio_session='+('a'.repeat(64))}});assert.equal(r.status,404,route);assert.equal(r.headers.get('set-cookie'),null);
 }
 for(const route of ['/api/auth/register','/api/auth/login','/api/auth/logout','/api/simulations'])assert.equal((await fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,404,route);
 assert.deepEqual(await readFile(oldFile),oldContents);
 const db=new DatabaseSync(path.join(dir,'indices.sqlite'),{readOnly:true});try{assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name),['index_cache']);}finally{db.close();}
});
