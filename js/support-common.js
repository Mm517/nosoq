/* Nosoq shared: supabase client + styles + helpers + support inbox (used by admin.html & support.html) */
(function(){
const sb=window.sb||supabase.createClient(window.NASAQ_SUPABASE_URL,window.NASAQ_SUPABASE_ANON_KEY);
const N=n=>Number(n||0).toLocaleString('en-US');
const D=d=>d?new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ORG={SL:['البائعين','#163f8a'],RD:['السائقين','#2f8f83'],US:['المستخدمين','#2563c9']};
const pfx=t=>(t||'').slice(0,2);
const ST={open:'مفتوحة',in_progress:'جارية',resolved:'تم الحل',closed:'مغلقة'};
const css=`
:root{--bg:#f3f7fc;--card:#fff;--tx:#10233f;--mu:#5c6e88;--bd:#e1e9f4;--ac:#2563c9;--ac2:#2563c9;--ok:#1f7a4c;--wr:#d9931a;--er:#c62d3d;--soft:#eaf2fd}
@media(prefers-color-scheme:dark){:root{--bg:#0a1424;--card:#12203a;--tx:#eaf1fb;--mu:#93a6c4;--bd:#243657;--soft:#1a2f57}}
*{box-sizing:border-box}html,body{margin:0;height:100%}body{font-family:Cairo,system-ui,sans-serif;background:var(--bg);color:var(--tx);direction:rtl;font-variant-numeric:lining-nums}
button,input,textarea,select{font:inherit;color:inherit}
.btn{border:0;border-radius:12px;padding:9px 16px;background:var(--ac);color:#fff;cursor:pointer;font-weight:600;transition:background .15s}.btn:hover{background:#1c4fa8}.btn.g:hover{background:var(--soft)}
.btn.g{background:var(--card);color:var(--tx);border:1px solid var(--bd)}.btn.r{background:var(--er)}.btn.s{padding:5px 10px;font-size:13px}
input,textarea,select{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:10px 12px;width:100%;font-size:16px}input:focus,textarea:focus,select:focus{outline:0;border-color:var(--ac);box-shadow:0 0 0 3px var(--soft)}
.card{background:var(--card);border:1px solid var(--bd);border-radius:18px;padding:16px;box-shadow:0 1px 2px rgba(16,35,63,.04),0 10px 28px rgba(22,63,138,.06)}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.stat b{display:block;font-size:28px;margin-top:4px}.stat span{color:var(--mu);font-size:13px}
.pill{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;background:var(--soft);color:var(--ac)}
table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:right;border-bottom:1px solid var(--bd);font-size:14px}th{color:var(--mu);font-weight:600}
.sup{display:grid;grid-template-columns:340px 1fr;gap:14px;height:calc(100vh - 130px);min-height:480px}
.sup .lst{overflow:auto;padding:0}.sup .tk{padding:12px 14px;border-bottom:1px solid var(--bd);cursor:pointer;display:block}
.sup .tk:hover,.sup .tk.on{background:var(--soft)}.sup .tk.un{border-right:4px solid var(--ac)}
.sup .tk small{color:var(--mu)}.chat{display:flex;flex-direction:column;padding:0}.chat .hd{padding:12px 16px;border-bottom:1px solid var(--bd);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.msgs{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.m{max-width:75%;padding:9px 13px;border-radius:14px;background:var(--bg);align-self:flex-start;white-space:pre-wrap;word-break:break-word}
.m.st{align-self:flex-end;background:var(--ac);color:#fff}.m.ad{background:#163f8a;color:#fff;align-self:flex-end}
.m small{display:block;opacity:.7;font-size:11px;margin-top:4px}.m img{max-width:220px;border-radius:10px;display:block;margin-top:6px}
.cmp{padding:12px;border-top:1px solid var(--bd);display:flex;gap:8px;align-items:flex-end}.cmp textarea{resize:none;height:44px}
.tabs{display:flex;gap:6px;padding:10px;flex-wrap:wrap;border-bottom:1px solid var(--bd)}.tabs button{border:0;background:none;padding:5px 12px;border-radius:99px;cursor:pointer;color:var(--mu)}.tabs .on{background:var(--ac);color:#fff}
.toast{position:fixed;top:calc(16px + env(safe-area-inset-top,0px));left:16px;right:16px;max-width:360px;background:#12294a;color:#fff;padding:12px 18px;border-radius:14px;z-index:99;box-shadow:0 12px 30px rgba(16,35,63,.28)}
.login{max-width:360px;margin:12vh auto;display:grid;gap:12px}
@media(max-width:800px){.sup{grid-template-columns:1fr;height:auto}.sup .lst{max-height:260px}.chat{height:70vh}.m{max-width:88%}.card{padding:12px;border-radius:16px}th,td{padding:8px 6px}}`;
document.head.insertAdjacentHTML('beforeend','<style>'+css+'</style>');
document.head.insertAdjacentHTML('beforeend','<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">');
function toast(t){const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),4500)}
async function rpc(fn,a){const {data,error}=await sb.rpc(fn,a||{});if(error)throw error;return data}
function login(root,need,ok){
  root.innerHTML=`<div class="card login"><h2 style="margin:0">تسجيل الدخول</h2><input id="e" type="email" placeholder="البريد" dir="ltr"><input id="p" type="password" placeholder="كلمة المرور" dir="ltr"><button class="btn" id="go">دخول</button><div id="er" style="color:var(--er)"></div></div>`;
  root.querySelector('#go').onclick=async()=>{const er=root.querySelector('#er');er.textContent='';
    const {error}=await sb.auth.signInWithPassword({email:root.querySelector('#e').value.trim(),password:root.querySelector('#p').value});
    if(error){er.textContent='بيانات غير صحيحة';return}check()};
  async function check(){const w=await rpc('support_whoami').catch(()=>({role:'none'}));
    if(need(w.role)){ok(w.role)}else{await sb.auth.signOut();root.querySelector('#er')&&(root.querySelector('#er').textContent='ليس لديك صلاحية لهذه الصفحة')}}
  sb.auth.getSession().then(({data})=>data.session&&check());
}
/* ---------- support inbox ---------- */
function mountSupport(el,role){
  const isAdmin=role==='admin';let list=[],cur=null,org='ALL',stf='all',q='',busy=false,files=[];
  el.innerHTML=`<div class="sup"><div class="card lst"><div class="tabs" id="ot"></div><div style="padding:8px 10px"><input id="q" placeholder="بحث بالكود أو الاسم"></div><div id="ls"></div></div><div class="card chat" id="ch"><div style="margin:auto;color:var(--mu)">اختر محادثة</div></div></div>${isAdmin?'<div class="card" id="stf" style="margin-top:14px"></div>':''}`;
  const $=s=>el.querySelector(s);
  async function load(){try{list=await rpc('admin_support_list');draw()}catch(e){toast(e.message)}}
  function draw(){
    const cnt=k=>list.filter(t=>k==='ALL'||pfx(t.ticket_number)===k);
    $('#ot').innerHTML=[['ALL','الكل']].concat(Object.entries(ORG).map(([k,v])=>[k,v[0]])).map(([k,l])=>`<button data-k="${k}" class="${org===k?'on':''}">${l} (${N(cnt(k).filter(t=>t.admin_unread).length)}/${N(cnt(k).length)})</button>`).join('')+
      ['all','open','in_progress','closed'].map(s=>`<button data-s="${s}" class="${stf===s?'on':''}">${s==='all'?'كل الحالات':ST[s]}</button>`).join('');
    $('#ot').querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{org=b.dataset.k;draw()});
    $('#ot').querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{stf=b.dataset.s;draw()});
    const rows=list.filter(t=>(org==='ALL'||pfx(t.ticket_number)===org)&&(stf==='all'||t.status===stf)&&(!q||(t.ticket_number+' '+(t.name||'')+' '+t.subject).toLowerCase().includes(q)));
    $('#ls').innerHTML=rows.map(t=>{const o=ORG[pfx(t.ticket_number)]||['',''];return `<a class="tk ${t.admin_unread?'un':''} ${cur===t.ticket_number?'on':''}" data-t="${t.ticket_number}"><b dir="ltr" style="color:${o[1]}">${t.ticket_number}</b> ${t.escalated?'🆘':''}<span class="pill" style="float:left">${ST[t.status]}</span><div>${esc(t.subject)}</div><small>${esc(t.name||'')} · ${D(t.last_message_at)} · ${N(t.messages_count)} رسالة</small></a>`}).join('')||'<p style="padding:16px;color:var(--mu)">لا توجد محادثات</p>';
    $('#ls').querySelectorAll('.tk').forEach(a=>a.onclick=()=>open(a.dataset.t));
  }
  $('#q').oninput=e=>{q=e.target.value.toLowerCase();draw()};
  async function url(p){const {data}=await sb.storage.from('support-files').createSignedUrl(p,3600);return data?.signedUrl}
  async function open(tn){cur=tn;files=[];draw();
    try{const r=await rpc('admin_support_thread',{p_ticket_number:tn});const t=r.ticket;
      const ms=await Promise.all(r.messages.map(async m=>{const im=await Promise.all((m.attachments||[]).map(async a=>{const p=typeof a==='string'?a:a.path;return p?`<img src="${await url(p)}">`:''}));
        return `<div class="m ${m.role==='admin'?'ad':m.role==='support'?'st':''}">${esc(m.body)}${im.join('')}<small>${m.role==='user'?esc(t.name||'العميل'):m.role==='admin'?'الإدارة':esc(m.author_name||'الدعم')} · ${D(m.created_at)}</small></div>`}));
      const closed=t.status==='closed';
      $('#ch').innerHTML=`<div class="hd"><b dir="ltr">${t.ticket_number}</b><span class="pill">${ST[t.status]}</span><span>${esc(t.name||'')} ${esc(t.email||'')}</span><span style="margin-right:auto;display:flex;gap:6px">${!isAdmin&&!t.escalated?'<button class="btn g s" id="esc">🆘 طلب مساعدة الإدارة</button>':''}${closed?'<button class="btn g s" id="op">إعادة فتح</button>':'<button class="btn r s" id="cl">إغلاق المحادثة</button>'}</span></div>
      ${t.escalated?'<div style="padding:8px 16px;background:#fff6e9;color:#7a4e06">🆘 تم طلب مساعدة من الإدارة'+(isAdmin?' — رد هنا لمساعدة الدعم':'')+'</div>':''}
      <div class="msgs" id="ms">${ms.join('')}</div>
      ${closed?'':`<div class="cmp"><label class="btn g s" style="cursor:pointer">📎<input type="file" id="fl" accept="image/*" multiple hidden></label><textarea id="tx" placeholder="اكتب ردك..."></textarea><button class="btn" id="sd">إرسال</button></div><div id="fn" style="padding:0 12px 8px;color:var(--mu);font-size:12px"></div>`}`;
      const m=$('#ms');m.scrollTop=m.scrollHeight;
      $('#cl')&&($('#cl').onclick=async()=>{await rpc('staff_support_set_status',{p_ticket_number:tn,p_status:'closed'});await load();open(tn)});
      $('#op')&&($('#op').onclick=async()=>{await rpc('staff_support_set_status',{p_ticket_number:tn,p_status:'open'});await load();open(tn)});
      $('#esc')&&($('#esc').onclick=async()=>{const n=prompt('ملاحظة للإدارة (اختياري)');await rpc('support_escalate',{p_ticket_number:tn,p_note:n||null});await load();open(tn)});
      if($('#fl'))$('#fl').onchange=e=>{files=[...e.target.files];$('#fn').textContent=files.map(f=>f.name).join('، ')};
      if($('#sd'))$('#sd').onclick=async()=>{if(busy)return;busy=true;try{
        const at=[];for(const f of files){const p=`${tn}/${Date.now()}-${f.name.replace(/[^\w.\-]/g,'_')}`;const {error}=await sb.storage.from('support-files').upload(p,f);if(error)throw error;at.push(p)}
        await rpc('admin_support_reply',{p_ticket_number:tn,p_body:$('#tx').value,p_status:'in_progress',p_attachments:at});files=[];await load();open(tn)}catch(e){toast(e.message)}busy=false};
    }catch(e){toast(e.message)}}
  async function staff(){if(!isAdmin)return;const {data}=await sb.from('support_staff').select('*').order('created_at');
    $('#stf').innerHTML=`<h3 style="margin:0 0 10px">فريق الدعم (${N(data?.length)})</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><input id="se" placeholder="بريد موظف الدعم (لازم يكون له حساب)" dir="ltr" style="max-width:280px"><input id="sn" placeholder="الاسم" style="max-width:160px"><button class="btn" id="sa">إضافة</button></div>
    <table>${(data||[]).map(s=>`<tr><td>${esc(s.name||'')}<br><small dir="ltr">${esc(s.email||'')}</small></td><td>${Object.entries(ORG).map(([k,v])=>{const key={SL:'seller',RD:'rider',US:'customer'}[k];return `<label style="margin-inline-end:10px"><input type="checkbox" style="width:auto" data-u="${s.user_id}" data-k="${key}" ${s.handles.includes(key)?'checked':''}> ${v[0]}</label>`}).join('')}</td><td><button class="btn r s" data-rm="${s.user_id}">حذف</button></td></tr>`).join('')}</table>`;
    $('#sa').onclick=async()=>{try{await rpc('admin_support_staff_add',{p_email:$('#se').value.trim(),p_name:$('#sn').value.trim()||null});staff()}catch(e){toast(e.message)}};
    $('#stf').querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{if(confirm('حذف؟')){await rpc('admin_support_staff_remove',{p_user_id:b.dataset.rm});staff()}});
    $('#stf').querySelectorAll('[data-u]').forEach(c=>c.onchange=async()=>{const h=[...$('#stf').querySelectorAll(`[data-u="${c.dataset.u}"]:checked`)].map(x=>x.dataset.k);await rpc('admin_support_staff_set_scope',{p_user_id:c.dataset.u,p_handles:h});toast('تم الحفظ')})}
  let prev=null;load().then(()=>{prev=list.filter(t=>t.admin_unread).length});staff();
  setInterval(async()=>{await load();const u=list.filter(t=>t.admin_unread).length;if(prev!==null&&u>prev)toast('📩 رسالة دعم جديدة');prev=u},8000);
}
window.Nosoq={sb,N,D,esc,rpc,toast,login,mountSupport};
})();
