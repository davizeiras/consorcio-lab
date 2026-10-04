const $=id=>document.getElementById(id);let page=0,currentUser,busy=false;
const labels={pending:'Aguardando aprovação',active:'Liberado',blocked:'Bloqueado'};
async function request(path,data){const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});if(r.status===401){location.replace('/login');throw new Error('Entre novamente.');}const d=await r.json();if(!r.ok)throw new Error(d.error||'Não foi possível concluir.');return d;}
function cell(row,text){const td=document.createElement('td');td.textContent=text;row.append(td);return td;}
async function load(){if(busy)return;busy=true;$('reload-users').disabled=true;try{
 const d=await request('/api/admin/users?page='+page);$('users-body').replaceChildren();
 for(const user of d.users){const tr=document.createElement('tr');cell(tr,user.name+' · '+user.email);cell(tr,new Date(user.created_at).toLocaleDateString('pt-BR'));const state=cell(tr,'');const badge=document.createElement('span');badge.className='status-pill status-'+user.status;badge.textContent=labels[user.status]||'Pendente';state.append(badge);const actions=cell(tr,'');
  if(user.id===currentUser){state.textContent='Administrador';actions.textContent='Sua conta';}
  else for(const [status,label] of [['active','Liberar'],['blocked','Bloquear']]){const b=document.createElement('button');b.type='button';b.className='button secondary small';b.textContent=label;b.disabled=user.status===status;b.addEventListener('click',async()=>{
   if(!confirm(`${label} o acesso de ${user.email}?`))return;b.disabled=true;
   try{await request('/api/admin/status',{id:user.id,status});$('admin-message').textContent='Acesso atualizado.';await load();}catch(e){$('admin-message').textContent=e.message;b.disabled=false;}
  });actions.append(b);}
  $('users-body').append(tr);
 }
 if(!d.users.length){const tr=document.createElement('tr'),td=cell(tr,'Nenhum cadastro nesta página.');td.colSpan=4;$('users-body').append(tr);}
 $('users-count').textContent=d.total+' cadastros';$('users-page').textContent=`Página ${page+1} de ${Math.max(1,Math.ceil(d.total/50))}`;$('users-prev').disabled=page===0;$('users-next').disabled=(page+1)*50>=d.total;
 }catch(e){$('users-body').replaceChildren();$('admin-message').textContent=e.message;}finally{busy=false;$('reload-users').disabled=false;}}
$('reload-users').addEventListener('click',load);$('users-prev').addEventListener('click',()=>{if(!busy&&page>0){page--;void load();}});$('users-next').addEventListener('click',()=>{if(!busy){page++;void load();}});
$('admin-logout').addEventListener('click',async()=>{try{await request('/api/auth/logout',{});location.replace('/login');}catch(e){$('admin-message').textContent=e.message;}});
try{const me=await request('/api/me');if(!me.user?.admin)location.replace('/');else{currentUser=me.user.id;await load();}}catch(e){$('admin-message').textContent=e.message;}
