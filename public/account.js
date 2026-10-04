const response=await fetch('/api/me',{cache:'no-store'});
if(!response.ok){location.replace('/login');throw new Error('Entre para continuar.');}
const session=await response.json();
if(session.enabled&&session.user.status!=='active'){location.replace('/login');throw new Error('Acesso não liberado.');}
const user=session.user;
// Cada conta usa seu próprio espaço local; os planos antigos são preservados.
export const planStorage={getItem:key=>localStorage.getItem(user?`${key}.${user.id}`:key),setItem:(key,value)=>localStorage.setItem(user?`${key}.${user.id}`:key,value)};
if(session.enabled){
 document.getElementById('account-email').textContent=user.email;
 document.getElementById('admin-link').hidden=!user.admin;
 const logout=document.getElementById('logout');logout.hidden=false;
 const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('iran-account'):null;
 channel?.addEventListener('message',()=>location.replace('/login'));
 logout.addEventListener('click',async()=>{logout.disabled=true;try{const r=await fetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw new Error();channel?.postMessage('logout');location.replace('/login');}catch{logout.disabled=false;alert('Não foi possível sair. Tente novamente.');}});
 let checking=false;
 async function check(){if(checking)return;checking=true;try{const r=await fetch('/api/me',{cache:'no-store'});if(!r.ok){location.replace('/login');return;}const s=await r.json();if(s.user?.id!==user.id||s.user?.status!=='active')location.replace('/login');}catch{document.getElementById('app-view').hidden=true;location.replace('/login');}finally{checking=false;}}
 setInterval(check,30000);window.addEventListener('focus',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
}
