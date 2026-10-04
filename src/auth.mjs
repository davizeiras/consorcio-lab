import {createClient} from '@supabase/supabase-js';
export class AccessError extends Error {constructor(status,message){super(message);this.status=status;}}
export function credentials(d,{register=false}={}){
 const email=typeof d.email==='string'?d.email.trim().toLowerCase():'';
 if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))throw new AccessError(400,'Informe um e-mail válido.');
 if(typeof d.password!=='string'||d.password.length>(register?128:1024)||d.password.length<(register?12:1))throw new AccessError(400,register?'Use uma senha com 12 a 128 caracteres.':'Informe sua senha.');
 const name=typeof d.name==='string'?d.name.trim():'';
 if(register&&(name.length<2||name.length>80))throw new AccessError(400,'Informe seu nome, com 2 a 80 caracteres.');
 return {email,password:d.password,name};
}
export function createAccess({url,key,secure=true,origin,clientFactory=createClient}){
 if(!url||!key||!origin)throw new Error('Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e PUBLIC_ORIGIN antes de ativar o login.');
 if(secure&&!url.startsWith('https://'))throw new Error('Supabase deve usar HTTPS.');
 const prefix=secure?'__Host-iran-':'iran-';
 const client=token=>clientFactory(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:token?{headers:{Authorization:`Bearer ${token}`}}:{}});
 function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(s=>{const i=s.indexOf('=');return i<0?['','']:[s.slice(0,i).trim(),s.slice(i+1)];}));}
 function setSession(res,s){res.setHeader('Set-Cookie',[['access',s?.access_token,Math.min(s?.expires_in||3600,3600)],['refresh',s?.refresh_token,7*86400]].map(([n,v,a])=>`${prefix}${n}=${v||''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${v?a:0}${secure?'; Secure':''}`));}
 function failure(e,message='Não foi possível concluir. Tente novamente.'){
  if(e?.status===429)throw new AccessError(429,'Muitas tentativas. Aguarde alguns minutos.');
  throw new AccessError(503,message);
 }
 async function identity(req,res){
  const jar=cookies(req);let token=jar[prefix+'access'],user;
  if(token){const r=await client().auth.getUser(token);if(r.error&&r.error.status>=500)failure(r.error);user=r.data?.user;}
  if(!user&&jar[prefix+'refresh']){
   const r=await client().auth.refreshSession({refresh_token:jar[prefix+'refresh']});
   if(r.error&&r.error.status>=500)failure(r.error);
   if(r.data?.session){setSession(res,r.data.session);token=r.data.session.access_token;user=r.data.user;}
  }
  if(!user?.id||!user.email_confirmed_at){setSession(res,null);throw new AccessError(401,'Entre com seu e-mail e senha.');}
  const api=client(token);
  const [m,a]=await Promise.all([api.from('iran_members').select('id,email,name,status,created_at').eq('id',user.id).single(),api.rpc('iran_is_admin')]);
  if(m.error||a.error)failure(m.error||a.error,'Não foi possível verificar seu acesso. Tente novamente.');
  if(!m.data||m.data.id!==user.id)throw new AccessError(403,'Seu acesso ainda não foi liberado.');
  return {api,token,user:{...m.data,admin:a.data===true,status:a.data===true?'active':m.data.status}};
 }
 function requireActive(c){if(c.user.status!=='active')throw new AccessError(403,c.user.status==='blocked'?'Seu acesso foi bloqueado. Fale com o administrador.':'Seu cadastro está aguardando aprovação.');return c;}
 function requireAdmin(c){requireActive(c);if(!c.user.admin)throw new AccessError(403,'Acesso exclusivo do administrador.');return c;}
 return {identity,requireActive,requireAdmin,setSession,
  async login(d,res){const {email,password}=credentials(d),r=await client().auth.signInWithPassword({email,password});
   if(r.error){if(r.error.status===429||r.error.status>=500)failure(r.error);throw new AccessError(401,'E-mail ou senha incorretos, ou e-mail ainda não confirmado.');}
   if(!r.data?.session||!r.data.user?.email_confirmed_at)throw new AccessError(401,'Confirme seu e-mail antes de entrar.');
   setSession(res,r.data.session);return {ok:true};
  },
  async register(d){const {email,password,name}=credentials(d,{register:true});const r=await client().auth.signUp({email,password,options:{data:{name},emailRedirectTo:origin+'/login'}});
   if(r.error&&![400,422].includes(r.error.status))failure(r.error);
   return {message:'Se o cadastro puder ser realizado, você receberá um e-mail de confirmação. Depois de confirmar, entre e aguarde a aprovação do administrador.'};
  },
  async logout(req,res){const token=cookies(req)[prefix+'access'];setSession(res,null);if(token)await client(token).auth.admin.signOut(token,'local');return {ok:true};},
  async list(c,page=0){requireAdmin(c);if(!Number.isInteger(page)||page<0||page>10000)throw new AccessError(400,'Página inválida.');
   const r=await c.api.from('iran_members').select('id,email,name,status,created_at',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(page*50,page*50+49);
   if(r.error)failure(r.error);return {users:r.data,total:r.count,page};
  },
  async status(c,id,status){requireAdmin(c);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!['active','blocked'].includes(status))throw new AccessError(400,'Alteração inválida.');
   if(id===c.user.id)throw new AccessError(400,'Você não pode bloquear ou alterar sua própria conta.');
   const r=await c.api.from('iran_members').update({status}).eq('id',id).select('id,status').single();if(r.error)failure(r.error);return {user:r.data};
  }
 };
}
