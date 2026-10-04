import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createAccess,credentials} from '../src/auth.mjs';
const userId='11111111-1111-4111-8111-111111111111',adminId='22222222-2222-4222-8222-222222222222';
test('cadastro valida e-mail, nome e senha sem aceitar privilégios do cliente',()=>{
 assert.deepEqual(credentials({email:' A@EXAMPLE.COM ',password:'senha-longa-123',name:'Pessoa',admin:true},{register:true}),{email:'a@example.com',password:'senha-longa-123',name:'Pessoa'});
 for(const d of [{email:'x',name:'Pessoa',password:'senha-longa-123'},{email:'a@example.com',name:'P',password:'senha-longa-123'},{email:'a@example.com',name:'Pessoa',password:'curta'}])assert.throws(()=>credentials(d,{register:true}));
 assert.throws(()=>createAccess({origin:'https://example.com'}),/Configure/);
 assert.throws(()=>createAccess({url:'http://example.com',key:'x',origin:'https://example.com'}),/HTTPS/);
});
test('cookies de sessão são HttpOnly, Secure e SameSite; encerramento remove ambos',()=>{
 const a=createAccess({url:'https://example.com',key:'public',origin:'https://app.example.com'});let cookies;
 const res={setHeader:(n,v)=>{cookies=v;}};
 a.setSession(res,{access_token:'access',refresh_token:'refresh',expires_in:3600});
 assert.equal(cookies.length,2);for(const c of cookies){assert.match(c,/^__Host-iran-/);assert.match(c,/HttpOnly; SameSite=Strict/);assert.match(c,/; Secure$/);assert.doesNotMatch(c,/Domain=/);}
 a.setSession(res,null);for(const c of cookies)assert.match(c,/Max-Age=0/);
});
test('servidor protege páginas, APIs e administração; bloqueio vale para sessão já aberta',{timeout:30000},async t=>{
 let status='pending',updates=0,revoked=false;
 const fake=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://fake'),admin=req.headers.authorization==='Bearer admin',id=admin?adminId:userId;
  const json=(code,data,headers={})=>{res.writeHead(code,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(data));};
  const member={id,email:admin?'admin@example.com':'user@example.com',name:'Pessoa',status:admin?'pending':status,created_at:'2026-10-04T12:00:00Z'};
  if(u.pathname==='/auth/v1/user')return revoked?json(401,{msg:'invalid'}):json(200,{id,email:member.email,email_confirmed_at:'2026-10-04T12:00:00Z',user_metadata:{admin:true}});
  if(u.pathname==='/rest/v1/rpc/iran_is_admin')return json(200,admin);
  if(u.pathname==='/rest/v1/iran_members'){
   if(req.method==='PATCH'){let text='';for await(const chunk of req)text+=chunk;status=JSON.parse(text).status;updates++;return json(200,{id:userId,status});}
   return json(200,u.searchParams.has('id')?member:[member],{'Content-Range':'0-0/1'});
  }
  if(u.pathname==='/auth/v1/logout'){revoked=true;res.writeHead(204);return res.end();}
  if(u.pathname==='/auth/v1/token')return json(400,{error:'invalid_grant',error_description:'invalid'});
  return json(404,{});
 });
 await new Promise(r=>fake.listen(0,'127.0.0.1',r));
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const origin=`http://127.0.0.1:${port}`,dir=await mkdtemp(path.join(os.tmpdir(),'iran-auth-'));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'test',AUTH_MODE:'required',SUPABASE_URL:`http://127.0.0.1:${fake.address().port}`,SUPABASE_PUBLISHABLE_KEY:'test-key',PORT:String(port),PUBLIC_ORIGIN:origin,HOST:'127.0.0.1',DATA_DIR:dir}});
 let errors='';child.stderr.on('data',b=>errors+=b);
 t.after(async()=>{child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));await new Promise(r=>fake.close(r));await rm(dir,{recursive:true,force:true});});
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(new Error(`${c} ${errors}`)));});
 const request=(route,token,extra={})=>fetch(origin+route,{redirect:'manual',...extra,headers:{...(token?{Cookie:'iran-access='+token}:{}),...extra.headers}});
 assert.equal((await request('/')).status,303);
 for(const route of ['/app.js','/engine.js','/api/indices','/admin','/api/admin/users'])assert.equal((await request(route)).status,401,route);
 const login=await request('/login');assert.equal(login.status,200);assert.match(await login.text(),/type="password"/);
 assert.equal((await request('/logo.jpg')).headers.get('content-type'),'image/jpeg; charset=utf-8');
 assert.equal((await request('/api/me','user')).status,200);
 for(const route of ['/','/app.js','/api/indices'])assert.equal((await request(route,'user')).status,route==='/'?303:403);
 status='active';assert.equal((await request('/','user')).status,200);
 assert.equal((await request('/api/indices?variant=manual','user')).status,200);
 assert.equal((await request('/admin','user')).status,403);
 assert.equal((await request('/api/admin/users','user')).status,403);
 const change={method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:userId,status:'blocked'})};
 assert.equal((await request('/api/admin/status','user',change)).status,403);assert.equal(updates,0);
 assert.equal((await request('/api/admin/status','admin',{...change,headers:{...change.headers,Origin:'https://evil.test'}})).status,403);assert.equal(updates,0);
 assert.equal((await request('/api/admin/status','admin',{...change,body:JSON.stringify({id:adminId,status:'blocked'})})).status,400);
 assert.equal((await request('/api/admin/status','admin',change)).status,200);assert.equal(updates,1);
 assert.equal((await request('/app.js','user')).status,403);assert.equal((await request('/api/indices','user')).status,403);
 assert.equal((await request('/admin','admin')).status,200);
 assert.equal((await request('/api/admin/users','admin')).status,200);
 assert.equal((await request('/api/admin/users?page=-1','admin')).status,400);
 const logout=await request('/api/auth/logout','admin',{method:'POST',headers:{Origin:origin}});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await request('/admin','admin')).status,401);
});
