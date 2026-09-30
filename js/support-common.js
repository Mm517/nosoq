/* Nosoq shared: supabase client + styles + helpers + support inbox (used by support.html & admin) */
(function(){
const sb=window.sb||supabase.createClient(window.NASAQ_SUPABASE_URL,window.NASAQ_SUPABASE_ANON_KEY);
const I=(n,s)=>window.NIcon?window.NIcon(n,{size:s||18}):'';
const N=n=>Number(n||0).toLocaleString('en-US');
const D=d=>d?new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'';
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
/* الكود = نوع صاحب المحادثة. كل موظف دعم يشوف الأنواع المحددة له بس (الفلترة على السيرفر كمان). */
const ORG={SL:['البائعين','#2563c9','seller'],RD:['السائقين','#0f8f83','rider'],US:['المستخدمين','#7c3aed','customer'],GS:['الزوّار','#64748b','guest']};
const pfx=t=>(t||'').slice(0,2).toUpperCase();
const ST={open:'مفتوحة',in_progress:'جارية',resolved:'تم الحل',closed:'مغلقة'};
const css=`
:root{--bg:#f3f7fc;--card:#fff;--tx:#10233f;--mu:#5c6e88;--bd:#e1e9f4;--ac:#2563c9;--ac-d:#1c4fa8;--ok:#16a34a;--wr:#d9931a;--er:#d92d20;--soft:#eaf2fd;--side:#12294a;--sh:0 1px 2px rgba(16,35,63,.04),0 12px 32px rgba(22,63,138,.08)}
@media(prefers-color-scheme:dark){:root{--bg:#0a1424;--card:#12203a;--tx:#eaf1fb;--mu:#93a6c4;--bd:#243657;--soft:#1a2f57;--sh:0 1px 2px rgba(0,0,0,.3),0 12px 32px rgba(0,0,0,.25)}}
*{box-sizing:border-box}html,body{margin:0;min-height:100%}body{font-family:Cairo,system-ui,sans-serif;background:var(--bg);color:var(--tx);direction:rtl;font-variant-numeric:lining-nums tabular-nums;-webkit-font-smoothing:antialiased}
button,input,textarea,select{font:inherit;color:inherit}[hidden]{display:none!important}
.ic{flex:none}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid transparent;border-radius:12px;padding:0 16px;min-height:42px;background:var(--ac);color:#fff;cursor:pointer;font-weight:700;font-size:14px;transition:background .15s,border-color .15s,color .15s}
.btn:hover{background:var(--ac-d)}.btn:disabled{opacity:.55;cursor:not-allowed}
.btn.g{background:var(--card);color:var(--tx);border-color:var(--bd)}.btn.g:hover{background:var(--soft);border-color:var(--ac);color:var(--ac)}
.btn.r{background:var(--card);color:var(--er);border-color:rgba(217,45,32,.35)}.btn.r:hover{background:var(--er);color:#fff;border-color:var(--er)}
.btn.w{background:#fff6e9;color:#8f5b00;border-color:#f0cf95}.btn.w:hover{background:#ffedcf}
.btn.s{min-height:36px;padding:0 12px;font-size:13px;border-radius:10px}
input,textarea,select{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:10px 14px;width:100%;font-size:16px}
input:focus,textarea:focus,select:focus{outline:0;border-color:var(--ac);box-shadow:0 0 0 3px var(--soft)}
.card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:18px;box-shadow:var(--sh)}
.pill{display:inline-flex;align-items:center;gap:5px;padding:3px 11px;border-radius:99px;font-size:12px;font-weight:700;background:var(--soft);color:var(--ac);white-space:nowrap}
.pill.open{background:#fff4d9;color:#b45309}.pill.in_progress{background:var(--soft);color:var(--ac)}.pill.resolved{background:#e4f6ea;color:#11803a}.pill.closed{background:#e6eef9;color:#3f5372}
table{width:100%;border-collapse:collapse}th,td{padding:12px;text-align:right;border-bottom:1px solid var(--bd);font-size:14px}th{color:var(--mu);font-weight:700;font-size:12px}
.scope{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px;color:var(--mu);font-size:13px;font-weight:600}
.scope b{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;color:#fff;font-size:12px}
.sup{display:grid;grid-template-columns:360px minmax(0,1fr);gap:16px;height:calc(100vh - 170px);min-height:520px}
.lst{display:flex;flex-direction:column;padding:0!important;overflow:hidden}
.lst .tools{padding:12px;border-bottom:1px solid var(--bd);display:grid;gap:10px}
.tabs{display:flex;gap:6px;flex-wrap:wrap}.tabs button{border:1px solid var(--bd);background:var(--card);padding:6px 12px;border-radius:99px;cursor:pointer;color:var(--mu);font-weight:700;font-size:12px;display:inline-flex;gap:6px;align-items:center;transition:all .15s}
.tabs button b{background:var(--bg);color:var(--tx);border-radius:99px;padding:0 7px;font-size:11px}.tabs button:hover{border-color:var(--ac);color:var(--ac)}
.tabs .on{background:var(--ac);border-color:var(--ac);color:#fff}.tabs .on b{background:#fff;color:var(--ac)}
.tks{overflow:auto;flex:1}
.tk{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:13px 14px;border-bottom:1px solid var(--bd);cursor:pointer;transition:background .12s}
.tk:hover,.tk.on{background:var(--soft)}.tk.un .tk-n{font-weight:800}
.tk-av{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:13px;direction:ltr}
.tk-n{display:flex;gap:6px;align-items:center;font-size:14px}.tk-n span{direction:ltr;color:var(--mu);font-size:11px;font-weight:700}
.tk-s{color:var(--mu);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.tk-side{display:grid;justify-items:end;gap:5px;font-size:11px;color:var(--mu)}
.dot{background:var(--ac);color:#fff;border-radius:99px;min-width:20px;height:20px;display:grid;place-items:center;font-size:11px;font-weight:800;padding:0 6px}
.flag{color:var(--wr);display:inline-flex}
.empty{padding:36px 16px;text-align:center;color:var(--mu);font-weight:600}
.chat{display:flex;flex-direction:column;padding:0!important;overflow:hidden;min-height:0}
.chat .ph{margin:auto;color:var(--mu);display:grid;justify-items:center;gap:10px;text-align:center;padding:20px}.chat .ph svg{width:52px;height:52px;color:#b4c7e4}
.chat .hd{padding:14px 18px;border-bottom:1px solid var(--bd);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.chat .hd h3{margin:0;font-size:16px}.chat .hd small{color:var(--mu);display:block;font-size:12px}
.chat .hd .acts{margin-inline-start:auto;display:flex;gap:8px;flex-wrap:wrap}
.esc-note{display:flex;gap:8px;align-items:center;padding:9px 18px;background:#fff6e9;color:#7a4e06;font-size:13px;font-weight:600;border-bottom:1px solid #f3dfb6}
.msgs{flex:1;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:10px;background:var(--bg)}
.m{max-width:min(78%,520px);padding:10px 14px;border-radius:16px 16px 16px 4px;background:var(--card);border:1px solid var(--bd);align-self:flex-start;white-space:pre-wrap;word-break:break-word;line-height:1.75;font-size:14px}
.m.st{align-self:flex-end;background:var(--ac);border-color:transparent;color:#fff;border-radius:16px 16px 4px 16px}
.m.ad{align-self:flex-end;background:var(--side);border-color:transparent;color:#fff;border-radius:16px 16px 4px 16px}
.m small{display:block;opacity:.75;font-size:11px;margin-top:5px}.m img{max-width:220px;border-radius:10px;display:block;margin-top:8px}
.cmp{padding:12px 14px;border-top:1px solid var(--bd);display:flex;gap:8px;align-items:flex-end;background:var(--card)}
.cmp textarea{resize:none;height:46px;border-radius:14px}
.cmp .att{width:46px;height:46px;flex:none;padding:0}
.fn{padding:0 16px 10px;color:var(--mu);font-size:12px}
.toast{position:fixed;top:calc(16px + env(safe-area-inset-top,0px));inset-inline:16px;margin-inline:auto;width:fit-content;max-width:min(380px,calc(100% - 32px));background:var(--side);color:#fff;padding:12px 18px;border-radius:14px;z-index:99;box-shadow:0 14px 34px rgba(16,35,63,.3);display:flex;gap:10px;align-items:center;font-weight:600;font-size:14px}
.login{max-width:400px;margin:12vh auto 0;display:grid;gap:14px;padding:30px}
.login h2{margin:0;font-size:22px}.login .lg{width:48px;height:48px;border-radius:14px;background:var(--soft);color:var(--ac);display:grid;place-items:center}
.login .er{color:var(--er);min-height:20px;font-size:14px}
@media(max-width:860px){.sup{grid-template-columns:1fr;height:auto}.lst .tks{max-height:340px}.chat{height:75vh}.m{max-width:90%}.card{padding:14px;border-radius:18px}th,td{padding:9px 6px}}`;
document.head.insertAdjacentHTML('beforeend','<style>'+css+'</style>');
document.head.insertAdjacentHTML('beforeend','<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">');
function toast(t,icon){const e=document.createElement('div');e.className='toast';e.innerHTML=(icon?I(icon,18):'')+'<span>'+esc(t)+'</span>';document.body.appendChild(e);setTimeout(()=>e.remove(),4500)}
async function rpc(fn,a){const {data,error}=await sb.rpc(fn,a||{});if(error)throw error;return data}
function login(root,need,ok){
  root.innerHTML=`<div class="card login"><span class="lg">${I('lock',24)}</span><h2>تسجيل الدخول</h2><input id="e" type="email" placeholder="البريد" dir="ltr" autocomplete="username"><input id="p" type="password" placeholder="كلمة المرور" dir="ltr" autocomplete="current-password"><button class="btn" id="go">دخول</button><div class="er" id="er" role="alert"></div></div>`;
  const submit=async()=>{const er=root.querySelector('#er');er.textContent='';
    const {error}=await sb.auth.signInWithPassword({email:root.querySelector('#e').value.trim(),password:root.querySelector('#p').value});
    if(error){er.textContent='بيانات غير صحيحة';return}check()};
  root.querySelector('#go').onclick=submit;
  root.querySelector('#p').onkeydown=e=>{if(e.key==='Enter')submit()};
  async function check(){const w=await rpc('support_whoami').catch(()=>({role:'none'}));
    if(need(w.role)){ok(w.role,w)}else{await sb.auth.signOut();const er=root.querySelector('#er');if(er)er.textContent='ليس لديك صلاحية لهذه الصفحة'}}
  sb.auth.getSession().then(({data})=>data.session&&check());
}
/* ---------- support inbox ---------- */
function mountSupport(el,role,who){
  const isAdmin=role==='admin';
  const hs=(who&&who.handles)||[];
  const allowed=isAdmin?Object.keys(ORG):Object.keys(ORG).filter(k=>hs.includes(ORG[k][2]));
  let list=[],cur=null,org=allowed.length===1?allowed[0]:'ALL',stf='active',q='',busy=false,files=[];
  const scope=isAdmin?'':`<div class="scope">تتعامل مع محادثات: ${allowed.map(k=>`<b style="background:${ORG[k][1]}">${ORG[k][0]} · <span dir="ltr">${k}</span></b>`).join('')||'<span>لا يوجد نوع محدد لك — اطلب من الإدارة تحديد نطاقك.</span>'}</div>`;
  el.innerHTML=`${scope}<div class="sup"><div class="card lst"><div class="tools"><div class="tabs" id="ot"></div><input id="q" type="search" placeholder="بحث بالكود أو الاسم"></div><div class="tks" id="ls"></div></div><div class="card chat" id="ch"><div class="ph">${I('chat',52)}<span>اختر محادثة لبدء الرد</span></div></div></div>${isAdmin?'<div class="card" id="stf" style="margin-top:16px"></div>':''}`;
  const $=s=>el.querySelector(s);
  async function load(){try{list=await rpc('admin_support_list');draw()}catch(e){toast(e.message,'alert')}}
  const isOpen=t=>t.status==='open'||t.status==='in_progress';
  function draw(){
    const inOrg=k=>list.filter(t=>k==='ALL'||pfx(t.ticket_number)===k);
    const tabs=(allowed.length>1?[['ALL','الكل']]:[]).concat(allowed.map(k=>[k,ORG[k][0]]));
    $('#ot').innerHTML=tabs.map(([k,l])=>`<button data-k="${k}" class="${org===k?'on':''}">${l}<b>${N(inOrg(k).filter(t=>t.admin_unread).length)}/${N(inOrg(k).length)}</b></button>`).join('')+
      [['active','المفتوحة'],['all','الكل'],['resolved','تم الحل'],['closed','المغلقة']].map(([s,l])=>`<button data-s="${s}" class="${stf===s?'on':''}">${l}</button>`).join('');
    $('#ot').querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{org=b.dataset.k;draw()});
    $('#ot').querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{stf=b.dataset.s;draw()});
    const rows=list.filter(t=>(org==='ALL'||pfx(t.ticket_number)===org)&&(stf==='all'||(stf==='active'?isOpen(t):t.status===stf))&&(!q||(t.ticket_number+' '+(t.name||'')+' '+(t.subject||'')).toLowerCase().includes(q)));
    $('#ls').innerHTML=rows.map(t=>{const p=pfx(t.ticket_number),o=ORG[p]||['','#64748b'];return `<a class="tk ${t.admin_unread?'un':''} ${cur===t.ticket_number?'on':''}" data-t="${esc(t.ticket_number)}"><span class="tk-av" style="background:${o[1]}">${esc(p)}</span><div><div class="tk-n">${t.escalated?`<span class="flag" title="طُلبت مساعدة الإدارة">${I('lifebuoy',15)}</span>`:''}${esc(t.name||'زائر')}<span>${esc(t.ticket_number)}</span></div><div class="tk-s">${esc(t.subject||'')} · ${N(t.messages_count)} رسالة</div></div><div class="tk-side"><span>${D(t.last_message_at)}</span>${t.admin_unread&&isOpen(t)?'<i class="dot">جديد</i>':`<span class="pill ${t.status}">${ST[t.status]||t.status}</span>`}</div></a>`}).join('')||'<p class="empty">لا توجد محادثات</p>';
    $('#ls').querySelectorAll('.tk').forEach(a=>a.onclick=()=>open(a.dataset.t));
  }
  $('#q').oninput=e=>{q=e.target.value.toLowerCase();draw()};
  async function url(p){const {data}=await sb.storage.from('support-files').createSignedUrl(p,3600);return data?.signedUrl}
  async function open(tn){cur=tn;files=[];draw();
    try{const r=await rpc('admin_support_thread',{p_ticket_number:tn});const t=r.ticket;
      const ms=await Promise.all(r.messages.map(async m=>{const im=await Promise.all((m.attachments||[]).map(async a=>{const p=typeof a==='string'?a:a.path;const u=p?await url(p):'';return u?`<img src="${esc(u)}" alt="مرفق">`:''}));
        return `<div class="m ${m.role==='admin'?'ad':m.role==='support'?'st':''}">${esc(m.body)}${im.join('')}<small>${m.role==='user'?esc(t.name||'العميل'):m.role==='admin'?'الإدارة':esc(m.author_name||'الدعم')} · ${D(m.created_at)}</small></div>`}));
      const closed=t.status==='closed',p=pfx(t.ticket_number);
      $('#ch').innerHTML=`<div class="hd"><div><h3><span dir="ltr">${esc(t.ticket_number)}</span> · ${esc(t.name||'زائر')}</h3><small>${esc(t.subject||'')}${t.email?' · '+esc(t.email):''}</small></div><span class="pill ${t.status}">${ST[t.status]||t.status}</span><span class="acts">${!isAdmin&&!t.escalated?`<button class="btn w s" id="esc">${I('lifebuoy',16)}طلب مساعدة الإدارة</button>`:''}${closed?'<button class="btn g s" id="op">إعادة فتح</button>':'<button class="btn r s" id="cl">إغلاق المحادثة</button>'}</span></div>
      ${t.escalated?`<div class="esc-note">${I('lifebuoy',16)}<span>تم طلب مساعدة من الإدارة${isAdmin?' — رد هنا لمساعدة الدعم':''}</span></div>`:''}
      <div class="msgs" id="ms">${ms.join('')}</div>
      ${closed?'':`<div class="cmp"><label class="btn g att" title="إرفاق صورة" aria-label="إرفاق صورة">${I('clip',20)}<input type="file" id="fl" accept="image/*" multiple hidden></label><textarea id="tx" placeholder="اكتب ردك..."></textarea><button class="btn" id="sd">${I('send',16)}إرسال</button></div><div class="fn" id="fn"></div>`}`;
      const m=$('#ms');m.scrollTop=m.scrollHeight;
      $('#cl')&&($('#cl').onclick=async()=>{try{await rpc('staff_support_set_status',{p_ticket_number:tn,p_status:'closed'});await load();open(tn)}catch(e){toast(e.message,'alert')}});
      $('#op')&&($('#op').onclick=async()=>{try{await rpc('staff_support_set_status',{p_ticket_number:tn,p_status:'open'});await load();open(tn)}catch(e){toast(e.message,'alert')}});
      $('#esc')&&($('#esc').onclick=async()=>{const n=prompt('ملاحظة للإدارة (اختياري)');if(n===null)return;try{await rpc('support_escalate',{p_ticket_number:tn,p_note:n||null});await load();open(tn)}catch(e){toast(e.message,'alert')}});
      if($('#fl'))$('#fl').onchange=e=>{files=[...e.target.files];$('#fn').textContent=files.map(f=>f.name).join('، ')};
      if($('#tx'))$('#tx').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#sd').click()}};
      if($('#sd'))$('#sd').onclick=async()=>{if(busy)return;if(!$('#tx').value.trim()&&!files.length)return;busy=true;try{
        const at=[];for(const f of files){const p=`${tn}/${Date.now()}-${f.name.replace(/[^\w.\-]/g,'_')}`;const {error}=await sb.storage.from('support-files').upload(p,f);if(error)throw error;at.push(p)}
        await rpc('admin_support_reply',{p_ticket_number:tn,p_body:$('#tx').value,p_status:'in_progress',p_attachments:at});files=[];await load();open(tn)}catch(e){toast(e.message,'alert')}busy=false};
    }catch(e){toast(e.message,'alert')}}
  async function staff(){if(!isAdmin)return;const {data}=await sb.from('support_staff').select('*').order('created_at');
    $('#stf').innerHTML=`<h3 style="margin:0 0 12px">فريق الدعم (${N(data?.length)})</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><input id="se" placeholder="بريد موظف الدعم (لازم يكون له حساب)" dir="ltr" style="max-width:280px"><input id="sn" placeholder="الاسم" style="max-width:160px"><button class="btn" id="sa">إضافة</button></div>
    <table>${(data||[]).map(s=>`<tr><td>${esc(s.name||'')}<br><small dir="ltr">${esc(s.email||'')}</small></td><td>${Object.entries(ORG).map(([k,v])=>`<label style="margin-inline-end:12px;white-space:nowrap"><input type="checkbox" style="width:auto;vertical-align:middle" data-u="${s.user_id}" data-k="${v[2]}" ${(s.handles||[]).includes(v[2])?'checked':''}> ${v[0]}</label>`).join('')}</td><td><button class="btn r s" data-rm="${s.user_id}">${I('trash',15)}حذف</button></td></tr>`).join('')}</table>`;
    $('#sa').onclick=async()=>{try{await rpc('admin_support_staff_add',{p_email:$('#se').value.trim(),p_name:$('#sn').value.trim()||null});staff()}catch(e){toast(e.message,'alert')}};
    $('#stf').querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{if(confirm('حذف موظف الدعم؟')){await rpc('admin_support_staff_remove',{p_user_id:b.dataset.rm});staff()}});
    $('#stf').querySelectorAll('[data-u]').forEach(c=>c.onchange=async()=>{const h=[...$('#stf').querySelectorAll(`[data-u="${c.dataset.u}"]:checked`)].map(x=>x.dataset.k);if(!h.length){c.checked=true;toast('لازم نوع واحد على الأقل','alert');return}try{await rpc('admin_support_staff_set_scope',{p_user_id:c.dataset.u,p_handles:h});toast('تم الحفظ','check')}catch(e){toast(e.message,'alert')}})}
  let prev=null;load().then(()=>{prev=list.filter(t=>t.admin_unread).length});staff();
  setInterval(async()=>{if(document.hidden)return;await load();const u=list.filter(t=>t.admin_unread).length;if(prev!==null&&u>prev)toast('رسالة دعم جديدة','mail');prev=u},8000);
}
window.Nosoq={sb,N,D,esc,rpc,toast,login,mountSupport};
})();
