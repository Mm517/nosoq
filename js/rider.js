/* ==========================================================================
   js/rider.js — لوحة مندوب التوصيل (rider.html)
   ⚠️ وحدة قيد التطوير: تغطي المسار الأساسي (قبول/استلام/تسليم طلب) وتُقرأ
   وتُكتب من قاعدة البيانات فعلياً، لكنها لا تزال بتصميم مبسّط سيُطوَّر لاحقاً
   (بدون خرائط أو تتبّع مباشر بعد).
   ========================================================================== */
(function () {
  'use strict';
  if (document.body.dataset.page !== 'rider-dash') return;

  const root = document.getElementById('rider-root');
  if (!root) return;
  const esc = window.Store.esc, money = window.Store.money;
  const ic = (name, cls) => (window.UI ? window.UI.icon(name, cls) : '');
  const TOKEN_KEY = 'nasaq_access_token_v1';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  async function api(path, options) {
    const response = await fetch('/api' + path, Object.assign({
      headers: Object.assign(
        { Accept: 'application/json' },
        (options && options.json) ? { 'Content-Type': 'application/json' } : {},
        { Authorization: 'Bearer ' + (localStorage.getItem(TOKEN_KEY) || '') },
      ),
    }, options || {}));
    const text = await response.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { /* تجاهل */ }
    if (!response.ok) throw new Error((data && data.error) || 'تعذّر تحميل البيانات');
    return data;
  }
  const postJson = (path, body) => api(path, { method: 'POST', json: true, body: JSON.stringify(body || {}) });
  const patchJson = (path, body) => api(path, { method: 'PATCH', json: true, body: JSON.stringify(body || {}) });

  function fmtDate(v) {
    return v ? new Date(v).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  }

  /* ---------- شاشات البوابة (قبل التفعيل) ---------- */
  function gateScreen(gate) {
    const byStatus = {
      'signed-out': { icon: 'user', title: 'سجّل دخولك أولاً', text: 'تحتاج لتسجيل الدخول بحساب مندوب التوصيل لعرض لوحتك.', action: { href: 'auth.html', label: 'تسجيل الدخول' } },
      'no-rider': { icon: 'motorbike', title: 'لم تنضم كمندوب توصيل بعد', text: 'قدّم طلب انضمام كمندوب توصيل لتبدأ استقبال الطلبات.', action: { href: 'become-rider.html', label: 'الانضمام كمندوب' } },
      pending: { icon: 'clock', title: 'حسابك قيد المراجعة', text: 'فريق عمليات نَسَق يراجع بياناتك الآن، وسيصلك إشعار فور التفعيل (عادة خلال 12 ساعة).' },
      rejected: { icon: 'close', title: 'تعذّر اعتماد حسابك', text: (gate.rider && gate.rider.review_note) || 'لم تتم الموافقة على طلب الانضمام. تواصل مع الدعم لمزيد من التفاصيل.', action: { href: 'mailto:partners@nasaq.example', label: 'تواصل مع الدعم' } },
      suspended: { icon: 'close', title: 'حسابك موقوف حالياً', text: (gate.rider && gate.rider.review_note) || 'تم إيقاف حسابك مؤقتاً من قِبل الإدارة.', action: { href: 'mailto:partners@nasaq.example', label: 'تواصل مع الدعم' } },
      offline: { icon: 'alert', title: 'تعذّر الاتصال بالخادم', text: 'تحقق من اتصالك بالإنترنت وأعد المحاولة.' },
      error: { icon: 'alert', title: 'حدث خطأ غير متوقع', text: 'حاول تحديث الصفحة.' }
    };
    const info = byStatus[gate.status] || byStatus.error;
    root.innerHTML = '<div class="rider-wrap"><div class="dempty">' + ic(info.icon) +
      '<h3>' + esc(info.title) + '</h3><p>' + esc(info.text) + '</p>' +
      (info.action ? '<a class="btn btn--primary btn--sm" href="' + info.action.href + '">' + esc(info.action.label) + '</a>' : '') +
      '</div></div>';
  }

  /* ---------- اللوحة الفعلية ---------- */
  let rider = null;

  function shell() {
    root.innerHTML =
      '<div class="rider-wrap">' +
        '<div class="rider-head">' +
          '<div><h1>أهلاً ' + esc(rider.name || '') + '<span class="dev-badge">' + ic('gear') + ' قيد التطوير</span></h1>' +
            '<p>لوحة مندوب التوصيل — تابع طلباتك واستلم طلبات جديدة.</p></div>' +
          '<button type="button" class="rider-online" id="online-toggle" data-online="' + (rider.is_online ? '1' : '0') + '">' +
            '<span class="dot"></span><span id="online-label">' + (rider.is_online ? 'متصل — تستقبل طلبات' : 'غير متصل') + '</span></button>' +
        '</div>' +
        '<section class="admin-stats" id="rider-stats" aria-label="ملخص المندوب"></section>' +
        '<section class="rider-section">' +
          '<h2>طلبات متاحة الآن</h2>' +
          '<div class="rider-list" id="available-list"></div>' +
          '<p class="admin-empty" id="available-empty" hidden>لا توجد طلبات متاحة حالياً، تحقق لاحقاً.</p>' +
        '</section>' +
        '<section class="rider-section">' +
          '<h2>طلباتي الحالية</h2>' +
          '<div class="rider-list" id="mine-list"></div>' +
          '<p class="admin-empty" id="mine-empty" hidden>لا توجد طلبات نشطة لديك الآن.</p>' +
        '</section>' +
      '</div>';
  }

  function renderStats(d) {
    const stats = [
      ['طلبات نشطة', d.active],
      ['تم التسليم اليوم', d.delivered_today],
      ['أرباح اليوم', money(d.earnings_today)],
      ['إجمالي الأرباح', money(d.earnings_total)],
      ['متاح للاستلام', d.available]
    ];
    $('#rider-stats').innerHTML = stats.map((s) => '<div class="admin-stat"><span class="admin-stat__label">' + s[0] + '</span><strong class="admin-stat__value">' + s[1] + '</strong></div>').join('');
  }

  function deliveryCard(d, mode) {
    const store = d.stores || {};
    const addr = (d.dropoff && d.dropoff.address) || (d.dropoff && d.dropoff.city) || '';
    const actions = {
      available: '<button type="button" class="admin-button admin-button--primary" data-action="accept" data-id="' + d.id + '">قبول الطلب</button>',
      assigned: '<button type="button" class="admin-button" data-action="release" data-id="' + d.id + '">تخلٍّ</button>' +
        '<button type="button" class="admin-button admin-button--primary" data-action="pickup" data-id="' + d.id + '">تم الاستلام من المتجر</button>',
      picked_up: '<button type="button" class="admin-button" data-action="fail" data-id="' + d.id + '">تعذّر التسليم</button>' +
        '<button type="button" class="admin-button admin-button--primary" data-action="deliver" data-id="' + d.id + '">تم التسليم</button>'
    };
    return '<div class="rider-card">' +
      '<div class="rider-card__info"><strong>' + esc(store.name || 'متجر') + '</strong>' +
        '<small>' + esc((d.pickup && d.pickup.phone) || store.phone || '') + ' · طلب منذ ' + fmtDate(d.requested_at) + '</small>' +
        (addr ? '<small>' + ic('pin') + ' ' + esc(addr) + '</small>' : '') + '</div>' +
      '<div class="rider-fee">' + money(d.fee) + (d.cod_amount > 0 ? ' · تحصيل ' + money(d.cod_amount) : '') + '</div>' +
      '<div class="rider-card__actions">' + (actions[mode] || '') + '</div>' +
    '</div>';
  }

  async function loadLists() {
    const [available, mine] = await Promise.all([
      api('/rider/deliveries/available'),
      api('/rider/deliveries/mine'),
    ]);
    $('#available-list').innerHTML = available.map((d) => deliveryCard(d, 'available')).join('');
    $('#available-empty').hidden = available.length > 0;
    $('#mine-list').innerHTML = mine.map((d) => deliveryCard(d, d.status)).join('');
    $('#mine-empty').hidden = mine.length > 0;
  }

  async function loadAll() {
    const dash = await api('/rider/dashboard');
    rider = dash.rider;
    shell();
    renderStats(dash.dashboard);
    await loadLists().catch((err) => window.UI && UI.toast(err.message, { type: 'error' }));
  }

  async function boot() {
    const gate = await (window.NasaqRiderGateReady || Promise.resolve({ status: 'error' }));
    if (gate.status !== 'active') { gateScreen(gate); return; }
    try {
      await loadAll();
    } catch (error) {
      gateScreen({ status: 'error' });
      return;
    }

    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action][data-id]');
      if (btn) {
        const action = btn.dataset.action, id = btn.dataset.id;
        btn.disabled = true;
        try {
          await postJson('/rider/deliveries/' + id + '/' + action, {});
          window.UI && UI.toast('تم التحديث.');
          await loadLists();
          const dash = await api('/rider/dashboard');
          renderStats(dash.dashboard);
        } catch (error) {
          window.UI && UI.toast(error.message, { type: 'error' });
          btn.disabled = false;
        }
        return;
      }
      const toggle = e.target.closest('#online-toggle');
      if (toggle) {
        const next = toggle.dataset.online !== '1';
        toggle.disabled = true;
        try {
          await patchJson('/rider/online', { online: next });
          toggle.dataset.online = next ? '1' : '0';
          $('#online-label').textContent = next ? 'متصل — تستقبل طلبات' : 'غير متصل';
        } catch (error) {
          window.UI && UI.toast(error.message, { type: 'error' });
        } finally {
          toggle.disabled = false;
        }
      }
    });
  }

  if (document.readyState === 'complete') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
