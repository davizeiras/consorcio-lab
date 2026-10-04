const $=id=>document.getElementById(id);let register=false;
// A confirmação padrão do provedor pode retornar tokens no fragmento.
// Não os usamos para criar sessões: a pessoa entra com sua própria senha.
if(location.hash)history.replaceState(null,'','/login');
async function request(path,data){const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Não foi possível concluir.');return d;}
async function check(){
 try{const r=await fetch('/api/me',{cache:'no-store'});if(r.status===401)return;const d=await r.json();if(!r.ok)throw new Error(d.error||'Não foi possível verificar seu acesso.');if(!d.enabled){location.replace('/');return;}
  if(d.user.status==='active'){location.replace('/');return;}
  $('auth-form').hidden=true;$('auth-toggle').hidden=true;$('auth-logout').hidden=false;$('check-access').hidden=false;
  $('auth-title').textContent=d.user.status==='blocked'?'Acesso bloqueado':'Aguardando aprovação';
  $('auth-help').textContent=d.user.email;$('auth-message').textContent=d.user.status==='blocked'?'Fale com o administrador para solicitar a liberação.':'Seu cadastro foi recebido. Você poderá usar o simulador assim que o administrador liberar seu acesso.';
 }catch(e){$('auth-message').textContent=e.message;}
}
$('auth-toggle').addEventListener('click',()=>{register=!register;$('auth-title').textContent=register?'Solicite seu acesso':'Entre na sua conta';$('name-label').hidden=!register;$('auth-name').required=register;$('auth-password').minLength=register?12:1;$('auth-password').autocomplete=register?'new-password':'current-password';$('auth-submit').textContent=register?'Criar cadastro':'Entrar';$('auth-toggle').textContent=register?'Já tenho conta':'Solicitar acesso';$('auth-message').textContent=register?'Use uma senha com pelo menos 12 caracteres.':'';});
$('auth-form').addEventListener('submit',async e=>{e.preventDefault();$('auth-submit').disabled=true;$('auth-message').textContent='Aguarde…';try{const d=await request('/api/auth/'+(register?'register':'login'),Object.fromEntries(new FormData(e.target)));$('auth-password').value='';if(register)$('auth-message').textContent=d.message;else{ $('auth-message').textContent='';await check();}}catch(e){$('auth-message').textContent=e.message;}finally{$('auth-submit').disabled=false;}});
$('check-access').addEventListener('click',check);
$('auth-logout').addEventListener('click',async()=>{try{await request('/api/auth/logout',{});new BroadcastChannel('iran-account').postMessage('logout');location.reload();}catch(e){$('auth-message').textContent=e.message;}});
void check();
