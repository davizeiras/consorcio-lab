import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {DEFAULTS} from '../public/engine.js';

test('produção inicia com endereço do Render e restringe a origem do cálculo',{timeout:20000},async t=>{
 const probe=net.createServer();
 await new Promise(r=>probe.listen(0,'127.0.0.1',r));
 const port=probe.address().port;
 await new Promise(r=>probe.close(r));
 const dir=await mkdtemp(path.join(tmpdir(),'consorcio-render-'));
 const publicOrigin='https://consorcio-hosting-test.onrender.com';
 const child=spawn(process.execPath,['server.mjs'],{
  cwd:new URL('..',import.meta.url),
  env:{...process.env,AUTH_MODE:'public',NODE_ENV:'production',PORT:String(port),PUBLIC_ORIGIN:'',HOST:'',RENDER_EXTERNAL_URL:publicOrigin,DATA_DIR:dir}
 });
 let stderr='';child.stderr.on('data',b=>{stderr+=b});
 t.after(async()=>{
  child.kill();
  await new Promise(r=>{if(child.exitCode!==null||child.signalCode!==null)r();else child.once('exit',r)});
  await rm(dir,{recursive:true,force:true});
 });
 await new Promise((resolve,reject)=>{
  child.stdout.once('data',resolve);child.once('error',reject);
  child.once('exit',code=>reject(new Error(`Servidor saiu: ${code} ${stderr}`)));
 });
 // Simula a comunicação HTTP interna do proxy: o endereço público é HTTPS.
 const internal=`http://127.0.0.1:${port}`;
 const home=await fetch(internal);
 assert.equal(home.status,200);
 assert.match(home.headers.get('strict-transport-security'),/max-age=/);
 assert.equal(home.headers.get('set-cookie'),null);
 const body=JSON.stringify({config:{...DEFAULTS,indexVariant:'manual',forecastAnnual:0,insuranceMonthly:0},index:{points:[]}});
 const simulate=origin=>fetch(internal+'/api/simulate',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body});
 assert.equal((await simulate(publicOrigin)).status,200);
 assert.equal((await simulate('https://outro-site.test')).status,403);
 assert.equal((await simulate(`http://localhost:${port}`)).status,403);
});
