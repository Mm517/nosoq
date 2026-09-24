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

  const STATUS_AR = {
    unassigned: 'متاح', assigned: 'تم القبول', picked_up: 'تم الاستلام من المتجر',
    out_for_delivery: 'في الطريق للعميل', delivered: 'تم التسليم', failed: 'تعذّر التسليم', cancelled: 'ملغى'
  };

  /* ---------- إرسال موقع المندوب (فقط وهو متصل) ---------- */
  const LOC_MIN_INTERVAL = 15000;   // أقصى معدّل: تحديث واحد كل 15 ثانية مهما كثرت قراءات GPS
  const tracker = { active: false, stopWatch: null, latest: null, pos: null, lastSent: 0, timer: 0, sending: false };

  function flushLocation() {
    tracker.timer = 0;
    if (!tracker.active || !tracker.latest || tracker.sending) return;
    const p = tracker.latest;
    tracker.latest = null;
    renderNearby();                  // تحديث المسافات بآخر موقع (بدون طلب شبكة)
    tracker.lastSent = Date.now();   // يُحدَّث قبل الإرسال حتى الفشل المتكرر لا يزيد المعدّل
    tracker.sending = true;
    patchJson('/rider/location', {
      latitude: Math.round(p.lat * 1e6) / 1e6,
      longitude: Math.round(p.lng * 1e6) / 1e6,
      accuracy: p.accuracy == null ? null : Math.round(p.accuracy)
    }).catch(() => { /* تحديث الموقع غير حرج — يُعاد مع القراءة التالية */ })
      .then(() => { tracker.sending = false; });
  }

  function onFix(p) {
    if (!tracker.active) return;
    const first = !tracker.pos;
    tracker.pos = p;      // آخر موقع معروف (لعرض الطلبات القريبة)
    if (first) renderNearby();
    tracker.latest = p;   // نحتفظ بأحدث قراءة فقط
    const wait = LOC_MIN_INTERVAL - (Date.now() - tracker.lastSent);
    if (wait <= 0) flushLocation();
    else if (!tracker.timer) tracker.timer = setTimeout(flushLocation, wait);
  }

  function stopTracking() {
    tracker.active = false;
    clearTimeout(tracker.timer);
    tracker.timer = 0;
    tracker.latest = null;
    tracker.pos = null;
    if (tracker.stopWatch) { tracker.stopWatch(); tracker.stopWatch = null; }
    renderNearby();
  }

  function startTracking() {
    if (tracker.active || !window.Geo || !window.Geo.watch) return;
    tracker.active = true;
    tracker.lastSent = 0;
    const stop = window.Geo.watch(onFix, (err) => {
      if (err && err.fatal) {
        stopTracking();
        window.UI && UI.toast(err.message, { type: 'error' });
      }
    });
    if (tracker.active) tracker.stopWatch = stop; else if (stop) stop();
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
        '<section class="rider-section" id="nearby-section">' +
          '<h2>الطلبات القريبة</h2>' +
          '<p class="admin-empty" id="nearby-info" style="padding:0 0 8px"></p>' +
          '<div class="rider-list" id="nearby-list"></div>' +
        '</section>' +
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
        '<button type="button" class="admin-button admin-button--primary" data-action="out_for_delivery" data-id="' + d.id + '">خرجت للتوصيل</button>',
      out_for_delivery: '<button type="button" class="admin-button" data-action="fail" data-id="' + d.id + '">تعذّر التسليم</button>' +
        '<button type="button" class="admin-button admin-button--primary" data-action="deliver" data-id="' + d.id + '">تم التسليم</button>'
    };
    return '<div class="rider-card">' +
      '<div class="rider-card__info"><strong>' + esc(store.name || 'متجر') + '</strong>' +
        '<small>' + esc((d.pickup && d.pickup.phone) || store.phone || '') + ' · طلب منذ ' + fmtDate(d.requested_at) + '</small>' +
        (mode !== 'available' ? '<small>الحالة: ' + esc(STATUS_AR[d.status] || d.status || '') + '</small>' : '') +
        (addr ? '<small>' + ic('pin') + ' ' + esc(addr) + '</small>' : '') + '</div>' +
      '<div class="rider-fee">' + money(d.fee) + (d.cod_amount > 0 ? ' · تحصيل ' + money(d.cod_amount) : '') + '</div>' +
      '<div class="rider-card__actions">' + (actions[mode] || '') + '</div>' +
    '</div>';
  }

  /* ---------- الطلبات القريبة (داخل Radius) ---------- */
  let nearbyData = null;   // { radius_m, deliveries } من قاعدة البيانات

  const finite = (v) => { const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return typeof n === 'number' && isFinite(n) ? n : null; };
  function storePoint(store) {
    const a = (store && store.address && typeof store.address === 'object') ? store.address : {};
    const lat = finite(store && store.latitude) != null ? finite(store.latitude) : finite(a.lat);
    const lng = finite(store && store.longitude) != null ? finite(store.longitude) : finite(a.lng);
    return lat != null && lng != null ? { lat: lat, lng: lng } : null;
  }
  function storeAddress(store) {
    const a = (store && store.address && typeof store.address === 'object') ? store.address : {};
    return a.formatted || [a.city, a.area, a.street].filter(Boolean).join('، ') || a.raw || '';
  }

  function nearbyCard(item) {
    return '<div class="rider-card">' +
      '<div class="rider-card__info"><strong>' + esc(item.store.name || 'متجر') + '</strong>' +
        '<small>' + ic('pin') + ' ' + esc(window.Distance.format(item.meters)) + (storeAddress(item.store) ? ' · ' + esc(storeAddress(item.store)) : '') + '</small>' +
        '<small>قيمة الطلب: ' + money(item.order_value) + ' · الحالة: ' + esc(STATUS_AR[item.status] || item.status) + '</small></div>' +
      '<div class="rider-fee">' + money(item.fee) + ' <small>أجرة التوصيل</small></div>' +
      '<div class="rider-card__actions"><button type="button" class="admin-button admin-button--primary" data-action="accept" data-id="' + item.id + '">قبول الطلب</button></div>' +
    '</div>';
  }

  function renderNearby() {
    const list = $('#nearby-list'), info = $('#nearby-info');
    if (!list || !info) return;
    const D = window.Distance;
    if (!nearbyData || !D) { list.innerHTML = ''; info.textContent = ''; return; }
    const radius = Number(nearbyData.radius_m) || 0;
    if (!tracker.pos) {
      list.innerHTML = '';
      info.textContent = tracker.active ? 'جارٍ تحديد موقعك…' : 'اضغط «متصل» ليتم تحديد موقعك وعرض الطلبات القريبة منك.';
      return;
    }
    let noLocation = 0;
    const near = [];
    (nearbyData.deliveries || []).forEach((d) => {
      const store = d.store || {};
      const pt = storePoint(store);
      if (!pt) { noLocation++; return; }
      const meters = D.meters(tracker.pos.lat, tracker.pos.lng, pt.lat, pt.lng);
      if (meters != null && meters <= radius) near.push(Object.assign({}, d, { store: store, meters: meters }));
    });
    near.sort((a, b) => a.meters - b.meters);
    list.innerHTML = near.map(nearbyCard).join('');
    info.textContent = (near.length ? '' : 'لا توجد طلبات داخل نطاق ' + D.format(radius) + ' منك حالياً. ') +
      (near.length ? 'النطاق: ' + D.format(radius) + '. ' : '') +
      (noLocation ? noLocation + ' طلب متاح لمتجر لم يحدد موقعه بعد (لا يظهر هنا).' : '');
  }

  async function loadNearby() {
    try { nearbyData = await api('/rider/deliveries/nearby'); } catch (_) { nearbyData = null; }
    renderNearby();
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
    await loadNearby();
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
    if (rider && rider.is_online) startTracking();

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
          if (action === 'accept') loadLists().catch(() => {});   // الطلب ربما أُخذ من سائق آخر: نحدّث القوائم
        }
        return;
      }
      const toggle = e.target.closest('#online-toggle');
      if (toggle) {
        const next = toggle.dataset.online !== '1';
        toggle.disabled = true;
        if (!next) stopTracking();   // Offline: نوقف إرسال الموقع قبل أي شيء
        try {
          await patchJson('/rider/online', { online: next });
          toggle.dataset.online = next ? '1' : '0';
          $('#online-label').textContent = next ? 'متصل — تستقبل طلبات' : 'غير متصل';
          if (next) startTracking();   // Online: نبدأ المتابعة بعد تأكيد الحالة في قاعدة البيانات
        } catch (error) {
          if (!next) startTracking();  // فشل الخروج من الاتصال => ما زال متصلاً
          window.UI && UI.toast(error.message, { type: 'error' });
        } finally {
          toggle.disabled = false;
        }
      }
    });
  }

  if (document.readyState === 'complete') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
