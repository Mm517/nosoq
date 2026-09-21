/* ==========================================================================
   js/seller.js — لوحة البائع: الهيكل، الراوتر، إنشاء المتجر، لوحة التحكم، الإحصائيات
   (المنتجات والطلبات في seller-products.js، والمحفظة والإعلانات والدعم والإعدادات في seller-money.js)
   الراوتر بالـ hash: #/dashboard #/products #/orders #/stats #/wallet #/ads #/support #/settings
   ========================================================================== */
(function () {
  'use strict';
  if (document.body.dataset.page !== 'seller-dash') return;

  const M = window.Market, U = window.UI, CFG = window.Store.config, C = window.Charts;
  const esc = window.Store.esc, money = window.Store.money;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ic = U.icon;

  /* ---------- أدوات مشتركة بين ملفات اللوحة ---------- */
  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const F_DATE = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
  const F_SHORT = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' });
  const F_DOW = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'short' });
  const F_TIME = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
  const dateAr = (iso) => F_DATE.format(new Date(iso));
  const dateTimeAr = (iso) => F_DATE.format(new Date(iso)) + '، ' + F_TIME.format(new Date(iso));
  const shortKey = (k) => F_SHORT.format(M.util.parseKey(k));
  const dowKey = (k) => F_DOW.format(M.util.parseKey(k));

  const STATUS_CLS = { new: 'new', processing: 'processing', shipped: 'shipped', completed: 'completed', cancelled: 'cancelled' };
  const pill = (status, label) => '<span class="pill pill--' + status + '">' + esc(label || M.STATUS[status] || status) + '</span>';
  function growth(g) {
    const cls = g > 0 ? 'up' : g < 0 ? 'down' : 'flat';
    return '<span class="growth growth--' + cls + '" title="مقارنة بالفترة السابقة"><span aria-hidden="true">' + (g > 0 ? '▲' : g < 0 ? '▼' : '–') + '</span>' + Math.abs(g) + '%<span class="sr-only">' + (g > 0 ? ' زيادة' : g < 0 ? ' انخفاض' : ' بلا تغيير') + '</span></span>';
  }
  /* صورة منتج (بائع أو كتالوج) مع بديل لو المنتج غير منشور */
  function pimg(p, cls) {
    const c = cls || 'pthumb', live = window.Products.byId(p.id);
    if (p.photos && /^data:image\//.test(p.photos[0] || '')) return '<img class="' + c + '" src="' + esc(p.photos[0]) + '" alt="" width="48" height="60">';
    if (live) return '<img class="' + c + '"' + window.Products.imgAttrs(live, 0, 0, 'xs') + ' alt="" width="48" height="60" loading="lazy">';
    return '<span class="' + c + ' pthumb--ph">' + ic('box') + '</span>';
  }
  const empty = (o) => '<div class="dempty">' + ic(o.icon || 'box') + '<h3>' + esc(o.title) + '</h3>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
    (o.action ? '<a class="btn btn--primary btn--sm" href="' + o.action.href + '">' + esc(o.action.label) + '</a>' : '') + '</div>';
  const card = (title, body, o) => '<section class="dcard' + (o && o.cls ? ' ' + o.cls : '') + '"' + (o && o.id ? ' id="' + o.id + '"' : '') + '>' +
    (title ? '<div class="dcard__head"><h2>' + title + '</h2>' + ((o && o.tools) || '') + '</div>' : '') + body + '</section>';
  const pageHead = (title, sub, tools) => '<div class="dhead"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (tools ? '<div class="dhead__tools">' + tools + '</div>' : '') + '</div>';

  /* زر يحتاج تأكيداً (بدل confirm()): أول نقرة تُسلّحه، الثانية تنفّذ */
  function armed(btn, label) {
    if (btn.dataset.armed) { delete btn.dataset.armed; return true; }
    btn.dataset.armed = '1'; btn.dataset.label = btn.textContent; btn.textContent = label || 'اضغط للتأكيد';
    setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.label; } }, 3500);
    return false;
  }
  const csv = (rows, name) => {
    const body = rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const range = () => { const r = Number(sessionStorage.getItem('nq_range')); return [7, 30, 90].includes(r) ? r : 30; };
  const rangeSelect = () => '<label class="sr-only" for="range-sel">الفترة</label><select class="select select--sm" id="range-sel" data-range>' +
    [7, 30, 90].map((d) => '<option value="' + d + '"' + (range() === d ? ' selected' : '') + '>آخر ' + d + ' يوماً</option>').join('') + '</select>';

  const Seller = window.Seller = { views: {}, actions: {}, M, U, esc, money, fmt, ic, $, $$, dateAr, dateTimeAr, shortKey, dowKey, pill, growth, pimg, empty, card, pageHead, armed, csv, range, rangeSelect, STATUS_CLS };
  Seller.go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
  Seller.rerender = () => render();
  Seller.toast = (t, type) => U.toast(t, type ? { type } : undefined);

  /* ---------- الهيكل ---------- */
  const NAV = [
    ['عام', [['dashboard', 'grid', 'لوحة التحكم'], ['products', 'box', 'المنتجات'], ['orders', 'list', 'الطلبات'], ['stats', 'chart', 'الإحصائيات'], ['wallet', 'cash', 'الأرباح والمحفظة'], ['ads', 'megaphone', 'الإعلانات']]],
    ['الحساب', [['support', 'chat', 'الدعم'], ['settings', 'gear', 'إعدادات المتجر']]]
  ];
  const root = $('#dash-root');

  function shell() {
    const s = M.seller.get();
    root.innerHTML =
      '<div class="dash" id="dash">' +
        '<div class="dash__scrim" data-act="nav-close"></div>' +
        '<aside class="dash__side" id="dash-side" aria-label="قائمة لوحة البائع">' +
          '<a class="dash__logo notranslate" translate="no" href="index.html">نَسَق<small>مركز البائعين</small></a>' +
          '<nav class="dash__nav" aria-label="أقسام لوحة البائع">' + NAV.map((g) =>
            '<p class="dash__group">' + g[0] + '</p>' + g[1].map((n) =>
              '<a href="#/' + n[0] + '" data-nav="' + n[0] + '">' + ic(n[1]) + '<span>' + n[2] + '</span>' + (n[0] === 'orders' ? '<span class="dash__count" data-orders-count hidden></span>' : '') + '</a>').join('')).join('') + '</nav>' +
          '<div class="dash__foot">' +
            '<a href="index.html">' + ic('store') + 'العودة للمتجر</a>' +
            '<a href="store.html?s=' + encodeURIComponent(s.slug) + '" target="_blank" rel="noopener">' + ic('external') + 'صفحة متجري</a>' +
            '<div class="theme"><span>' + ic('sun') + 'المظهر</span>' +
              '<button type="button" class="switch" role="switch" aria-checked="false" data-act="theme" aria-label="الوضع الداكن"><span class="switch__i">' + ic('sun') + '</span><span class="switch__i">' + ic('moon') + '</span></button></div>' +
          '</div>' +
        '</aside>' +
        '<div class="dash__main">' +
          '<header class="dash__top">' +
            '<button type="button" class="icon-btn dash__burger" data-act="nav-open" aria-label="فتح القائمة" aria-controls="dash-side">' + ic('menu') + '</button>' +
            '<p class="dash__hi">أهلاً، <strong>' + esc(s.name) + '</strong></p>' +
            '<form class="dash__search" role="search" data-search><label class="sr-only" for="dash-q">بحث</label>' + ic('search') +
              '<input id="dash-q" class="input" type="search" placeholder="ابحث في المنتجات أو الطلبات…" autocomplete="off"></form>' +
            '<div class="dash__tools">' +
              '<button type="button" class="lang-btn" data-lang-open aria-label="تغيير اللغة">' + ic('globe') + '<span class="lang-btn__code notranslate" translate="no">' + window.I18n.shortCode() + '</span></button>' +
              '<div class="bell"><button type="button" class="icon-btn bell__btn" data-act="bell" aria-haspopup="true" aria-expanded="false" aria-label="الإشعارات">' + ic('bell') + '<span class="count-badge" data-bell-count hidden>0</span></button>' +
                '<div class="bell__panel" data-bell-panel hidden></div></div>' +
              '<a class="dash__me" href="#/settings">' + (s.logo ? '<img src="' + esc(s.logo) + '" alt="">' : '<span class="dash__av">' + esc(s.name.trim().charAt(0)) + '</span>') +
                '<span class="dash__me-t"><strong>' + esc(s.name) + '</strong><small>حساب بائع</small></span></a>' +
            '</div>' +
          '</header>' +
          '<main class="dash__view" id="main" tabindex="-1"></main>' +
        '</div>' +
      '</div>';
    applyTheme();
  }

  function applyTheme() {
    let t = 'light';
    try { t = localStorage.getItem(M.K.theme) === 'dark' ? 'dark' : 'light'; } catch (_) { /* تجاهل */ }
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
    const sw = $('[data-act="theme"]'); if (sw) sw.setAttribute('aria-checked', String(t === 'dark'));
  }
  Seller.applyTheme = applyTheme;

  function refreshChrome() {
    const n = M.orders.counts().new;
    const oc = $('[data-orders-count]'); if (oc) { oc.hidden = !n; oc.textContent = n; }
    const bc = $('[data-bell-count]'); const u = M.notifs.unread(); if (bc) { bc.hidden = !u; bc.textContent = u; }
    const cur = (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]) || 'dashboard';
    $$('[data-nav]').forEach((a) => { if (a.dataset.nav === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  function bellHTML() {
    const list = M.notifs.list().slice(0, 8);
    return '<div class="bell__head"><strong>الإشعارات</strong>' + (list.length ? '<button type="button" class="link-btn" data-act="bell-read">تمييز الكل كمقروء</button>' : '') + '</div>' +
      (list.length ? '<ul>' + list.map((n) => '<li class="' + (n.read ? '' : 'is-unread') + '"><a href="' + esc(n.href || '#/dashboard') + '" data-act="bell-go"><strong>' + esc(n.title) + '</strong><span>' + esc(n.text || '') + '</span><small>' + dateTimeAr(n.date) + '</small></a></li>').join('') + '</ul>'
        : '<p class="bell__empty">لا توجد إشعارات بعد.</p>');
  }

  /* ---------- إنشاء المتجر (أول دخول) ---------- */
  let setupGeo = null, setupLogo = '';
  function setupView() {
    root.innerHTML =
      '<main class="setup" id="main" tabindex="-1"><div class="setup__card">' +
        '<a class="dash__logo dash__logo--dark notranslate" translate="no" href="index.html">نَسَق<small>مركز البائعين</small></a>' +
        '<h1>أنشئ متجرك وابدأ البيع</h1>' +
        '<p class="setup__lead">دقيقتان وتصبح جاهزاً: أضف بيانات متجرك، حدّد موقعك على الخريطة، ثم أضف منتجاتك. العمولة ' + Math.round(CFG.commission * 100) + '% فقط من كل عملية بيع.</p>' +
        '<form class="dform" id="setup-form" novalidate>' +
          '<div class="dform__row">' +
            fld('s-name', 'اسم المتجر *', '<input class="input" id="s-name" maxlength="40" autocomplete="off" required>') +
            fld('s-slug', 'رابط المتجر (إنجليزي) *', '<input class="input" id="s-slug" dir="ltr" maxlength="30" placeholder="my-store" autocomplete="off" required>', 'حروف إنجليزية صغيرة وأرقام وشرطة فقط') +
          '</div>' +
          '<div class="dform__row">' +
            fld('s-cat', 'نوع المنتجات *', '<select class="select" id="s-cat">' + window.Products.categories.map((c) => '<option value="' + c.id + '">' + c.name + '</option>').join('') + '</select>') +
            fld('s-phone', 'رقم الجوال *', '<input class="input" id="s-phone" type="tel" dir="ltr" inputmode="tel" autocomplete="tel" placeholder="01012345678" required>') +
          '</div>' +
          fld('s-email', 'البريد الإلكتروني *', '<input class="input" id="s-email" type="email" dir="ltr" autocomplete="email" required>') +
          fld('s-desc', 'نبذة عن المتجر', '<textarea class="textarea" id="s-desc" rows="3" maxlength="300" placeholder="ماذا تبيع؟ وما الذي يميّز متجرك؟"></textarea>') +
          '<div class="field"><span class="label">شعار المتجر (اختياري)</span><div class="logo-up"><span class="logo-up__pv" data-logo-pv>' + ic('store') + '</span>' +
            '<label class="btn btn--ghost btn--sm">' + ic('upload') + 'اختر صورة<input type="file" accept="image/*" data-logo hidden></label></div></div>' +
          '<div class="field"><span class="label">موقع المتجر (مصدر الشحن) *</span><div data-geo-root></div></div>' +
          '<label class="check"><input type="checkbox" id="s-demo" checked> املأ لوحتي ببيانات تجريبية (طلبات وزيارات وأرباح) لأتعرّف على الأقسام، ويمكن حذفها لاحقاً من الإعدادات</label>' +
          '<label class="check"><input type="checkbox" id="s-terms" required> أوافق على شروط البائعين وعمولة المنصة (' + Math.round(CFG.commission * 100) + '%)</label>' +
          '<p class="field__error" id="setup-error" role="alert"></p>' +
          '<button class="btn btn--primary btn--lg" type="submit">افتح متجري</button>' +
        '</form></div></main>';
    setupGeo = window.Geo.mount($('[data-geo-root]'), {});
    setupLogo = '';
    const name = $('#s-name'), slug = $('#s-slug');
    let touched = false;
    slug.addEventListener('input', () => { touched = true; });
    name.addEventListener('input', () => {
      if (touched) return;
      const base = name.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      slug.value = base;
    });
    $('[data-logo]').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { setupLogo = await M.image(f, { max: 256, q: 0.85 }); $('[data-logo-pv]').innerHTML = '<img src="' + setupLogo + '" alt="">'; } catch (err) { U.toast(err.message, { type: 'error' }); }
    });
    $('#setup-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const err = $('#setup-error'), g = setupGeo.getValue();
      const v = { name: name.value.trim(), slug: slug.value.trim(), phone: $('#s-phone').value.trim(), email: $('#s-email').value.trim() };
      const problem =
        v.name.length < 3 ? 'اسم المتجر 3 أحرف على الأقل' :
        !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.slug) ? 'رابط المتجر: حروف إنجليزية صغيرة وأرقام وشرطة فقط (مثل my-store)' :
        !/^\+?[\d\s()-]{8,16}$/.test(v.phone) ? 'أدخل رقم جوال صحيحاً' :
        !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email) ? 'أدخل بريداً إلكترونياً صحيحاً' :
        !(g.city || g.area) ? 'حدّد موقع المتجر (استخدم موقعي الحالي أو ابحث عن العنوان)' :
        !$('#s-terms').checked ? 'وافق على الشروط للمتابعة' : '';
      if (problem) { err.textContent = problem; return; }
      err.textContent = '';
      const s = M.seller.create({ name: v.name, slug: v.slug, category: $('#s-cat').value, phone: v.phone, email: v.email, description: $('#s-desc').value.trim(), logo: setupLogo, address: g, demo: $('#s-demo').checked });
      if (!s) { err.textContent = 'تعذّر الحفظ، مساحة التخزين ممتلئة'; return; }
      location.hash = '#/dashboard';
      root.innerHTML = '';
      render();
    });
  }
  function fld(id, label, control, hint) {
    return '<div class="field"><label class="label" for="' + id + '">' + label + '</label>' + control + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
  }
  Seller.fld = fld;

  /* ---------- لوحة التحكم ---------- */
  function alertsHTML() {
    const out = [];
    const prods = M.products.list();
    const low = prods.filter((p) => p.status === 'active' && p.stock <= 3);
    const c = M.orders.counts();
    if (!prods.length) out.push(['box', 'لم تضف منتجات بعد. أضف أول منتج ليظهر في المتجر.', '#/products/new', 'أضف منتجاً']);
    if (c.new) out.push(['list', c.new + ' طلب جديد بانتظار قبولك.', '#/orders?tab=new', 'راجع الطلبات']);
    if (low.length) out.push(['alert', low.length + ' منتج مخزونه 3 قطع أو أقل.', '#/products?f=low', 'حدّث المخزون']);
    const open = M.tickets.list().filter((t) => t.status === 'open').length;
    if (open) out.push(['chat', open + ' تذكرة دعم مفتوحة.', '#/support', 'افتح الدعم']);
    if (!out.length) return '';
    return '<ul class="alerts">' + out.map((a) => '<li>' + ic(a[0]) + '<span>' + a[1] + '</span><a href="' + a[2] + '">' + a[3] + '</a></li>').join('') + '</ul>';
  }

  function topProductCard(n) {
    const rows = M.stats.byProduct(n).filter((r) => r.sold || r.views);
    const t = rows[0];
    if (!t) return card('أفضل منتج أداءً', empty({ icon: 'box', title: 'لا توجد بيانات بعد', text: 'ستظهر هنا أفضل منتجاتك بمجرد وصول أول زيارات وطلبات.' }));
    const p = M.products.get(t.id) || window.Products.byId(t.id) || { id: t.id, name: t.name, price: 0, stock: 0, category: '' };
    const convRate = t.views ? (t.sold / t.views) * 100 : 0;
    return card('أفضل منتج أداءً',
      '<div class="topp">' + pimg(p, 'topp__img') +
        '<div class="topp__b"><h3>' + esc(p.name) + '</h3>' +
          '<dl><div><dt>التصنيف</dt><dd>' + esc(window.Products.categoryName(p.category) || '—') + '</dd></div><div><dt>السعر</dt><dd>' + money(p.price) + '</dd></div><div><dt>المخزون</dt><dd>' + fmt(p.stock) + '</dd></div></dl></div></div>' +
      '<div class="meter"><div><span>المشاهدات</span><strong>' + fmt(t.views) + '</strong></div><div><span>المبيعات</span><strong>' + fmt(t.sold) + '</strong></div><div><span>التحويل</span><strong>' + convRate.toFixed(1) + '%</strong></div><div><span>الإيراد</span><strong>' + money(t.revenue) + '</strong></div></div>');
  }

  function qualityTable() {
    let list = M.products.list().map((p) => ({ p, demo: false }));
    if (!list.length && M.demo.on()) {
      list = window.Products.all().filter((p) => !p.sellerId).slice(0, 3).map((p) => ({ p: Object.assign({}, p, { photos: window.Products.gallery(p, 0) }), demo: true }));
    }
    if (!list.length) return card('فحص جودة القوائم', empty({ icon: 'check', title: 'لا توجد منتجات لفحصها', text: 'أضف منتجاً وسنقيّم صوره ووصفه ومواصفاته ومخزونه.', action: { href: '#/products/new', label: 'أضف منتجاً' } }));
    return card('فحص جودة القوائم',
      '<div class="dtable-wrap"><table class="dtable"><thead><tr><th>المنتج</th><th>التصنيف</th><th>أخطاء</th><th>تحذيرات</th><th>ناجح</th><th>درجة الجودة</th></tr></thead><tbody>' +
      list.map((x) => {
        const q = M.products.quality(x.p);
        return '<tr><td><div class="pcell">' + pimg(x.p) + '<span>' + esc(x.p.name) + (x.demo ? ' <em class="tag-demo">تجريبي</em>' : '') + '</span></div></td><td>' + esc(window.Products.categoryName(x.p.category)) + '</td>' +
          '<td>' + (q.errors.length ? '<strong class="txt-bad">' + q.errors.length + '</strong>' : '0') + '</td><td>' + q.warns.length + '</td><td>' + q.passed + '/' + q.total + '</td>' +
          '<td><div class="score"><div class="score__bar"><span style="width:' + q.score + '%"></span></div><strong>' + q.score + '</strong></div></td></tr>';
      }).join('') + '</tbody></table></div>');
  }

  Seller.views.dashboard = () => {
    const n = range(), sm = M.stats.summary(n), ser = M.stats.series(n), c = sm.cur;
    const kpi = (icon, label, value, g, extra) => '<div class="dcard kpi"><div class="kpi__l">' + ic(icon) + label + '</div><div class="kpi__v">' + value + '</div><div class="kpi__f">' + (g == null ? '' : growth(g)) + (extra ? '<span>' + extra + '</span>' : '') + '</div></div>';
    const labels = ser.map((d) => shortKey(d.date));
    const w = M.stats.series(7);
    const status = M.orders.counts();
    const cities = M.stats.cities(n).slice(0, 5);
    const maxCity = cities.length ? cities[0].n : 1;
    const net = M.orders.list().filter((o) => o.status !== 'cancelled' && new Date(o.createdAt) >= M.util.addDays(new Date(), -(n - 1))).reduce((a, o) => a + o.net, 0);

    const html =
      pageHead('لوحة التحكم', 'نظرة سريعة على أداء متجرك', rangeSelect()) +
      alertsHTML() +
      '<div class="kpis">' +
        kpi('eye', 'مشاهدات المتجر', fmt(c.v), sm.growth.v) +
        kpi('list', 'الطلبات', fmt(c.o), sm.growth.o) +
        kpi('cash', 'إجمالي المبيعات', money(c.r), sm.growth.r, 'صافي ' + money(net)) +
        kpi('chart', 'معدل التحويل', sm.conv + '%', null, 'متوسط الطلب ' + money(sm.aov)) +
      '</div>' +
      '<div class="dgrid dgrid--main">' +
        '<div class="dcol">' +
          card('المشاهدات والطلبات', '<figure class="dfig">' + C.line({ labels, series: [{ name: 'المشاهدات', values: ser.map((d) => d.v) }, { name: 'الطلبات ×10', values: ser.map((d) => d.o * 10), area: false }], label: 'المشاهدات والطلبات خلال آخر ' + n + ' يوماً' }) +
            C.legend([{ label: 'المشاهدات', s: 0 }, { label: 'الطلبات (مضروبة ×10 للمقارنة)', s: 1 }]) + '</figure>') +
          topProductCard(n) +
        '</div>' +
        '<div class="dcol">' +
          card('أداء الأسبوع', '<figure class="dfig">' + C.bars({ labels: w.map((d) => dowKey(d.date)), series: [{ name: 'إضافات للسلة', values: w.map((d) => d.c) }, { name: 'الطلبات', values: w.map((d) => d.o) }], label: 'أداء آخر 7 أيام' }) +
            C.legend([{ label: 'إضافات للسلة', s: 0 }, { label: 'الطلبات', s: 1 }]) + '</figure>') +
          card('حالة الطلبات', '<div class="donut">' + C.donut({ items: [{ label: 'جديد', value: status.new, s: 0 }, { label: 'قيد التجهيز', value: status.processing, s: 1 }, { label: 'تم الشحن', value: status.shipped, s: 4 }, { label: 'مكتمل', value: status.completed, s: 2 }, { label: 'ملغي', value: status.cancelled, s: 3 }], center: { value: status.all, label: 'طلب' }, label: 'توزيع الطلبات حسب الحالة' }) +
            C.legend([{ label: 'جديد', value: status.new, s: 0 }, { label: 'قيد التجهيز', value: status.processing, s: 1 }, { label: 'تم الشحن', value: status.shipped, s: 4 }, { label: 'مكتمل', value: status.completed, s: 2 }, { label: 'ملغي', value: status.cancelled, s: 3 }]) + '</div>') +
          card('أكثر المدن طلباً', cities.length ? '<ul class="hbars">' + cities.map((x) => '<li><span>' + esc(x.city) + '</span><div><i style="width:' + Math.round((x.n / maxCity) * 100) + '%"></i></div><strong>' + x.n + '</strong></li>').join('') + '</ul>' : empty({ icon: 'pin', title: 'لا توجد طلبات بعد' })) +
        '</div>' +
      '</div>' +
      qualityTable();
    return { html };
  };

  /* ---------- الإحصائيات ---------- */
  Seller.views.stats = () => {
    const n = range(), sm = M.stats.summary(n), ser = M.stats.series(n), c = sm.cur;
    const labels = ser.map((d) => shortKey(d.date));
    const kpi = (label, value, g) => '<div class="dcard kpi kpi--sm"><div class="kpi__l">' + label + '</div><div class="kpi__v">' + value + '</div><div class="kpi__f">' + (g == null ? '' : growth(g)) + '</div></div>';
    const dow = [0, 0, 0, 0, 0, 0, 0], names = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    ser.forEach((d) => { dow[d.dow] += d.v; });
    const funnel = [['المشاهدات', c.v], ['إضافات للسلة', c.c], ['الطلبات', c.o]];
    const rows = M.stats.byProduct(n).filter((r) => r.views || r.sold);
    const cities = M.stats.cities(n).slice(0, 8), maxCity = cities.length ? cities[0].n : 1;
    const html =
      pageHead('الإحصائيات', 'زيارات المتجر وسلوك العملاء والمبيعات', rangeSelect()) +
      '<div class="kpis kpis--7">' +
        kpi('المشاهدات', fmt(c.v), sm.growth.v) + kpi('زوار فريدون', fmt(c.u), sm.growth.u) + kpi('إضافات للسلة', fmt(c.c), sm.growth.c) +
        kpi('الطلبات', fmt(c.o), sm.growth.o) + kpi('التحويل', sm.conv + '%') + kpi('متوسط الطلب', money(sm.aov)) + kpi('إجمالي المبيعات', money(c.r), sm.growth.r) +
      '</div>' +
      card('الزيارات والزوار والطلبات', '<figure class="dfig">' + C.line({ labels, series: [{ name: 'المشاهدات', values: ser.map((d) => d.v) }, { name: 'زوار فريدون', values: ser.map((d) => d.u), area: false }], label: 'المشاهدات والزوار الفريدون' }) +
        C.legend([{ label: 'المشاهدات', s: 0 }, { label: 'زوار فريدون', s: 1 }]) + '</figure>') +
      '<div class="dgrid dgrid--half">' +
        card('قمع التحويل', '<ul class="funnel">' + funnel.map((f, i) => '<li><span>' + f[0] + '</span><div><i style="width:' + (funnel[0][1] ? Math.max(3, Math.round((f[1] / funnel[0][1]) * 100)) : 0) + '%"></i></div><strong>' + fmt(f[1]) + '</strong>' + (i ? '<small>' + (funnel[i - 1][1] ? Math.round((f[1] / funnel[i - 1][1]) * 100) : 0) + '% من السابق</small>' : '') + '</li>').join('') + '</ul>') +
        card('الزيارات حسب أيام الأسبوع', '<figure class="dfig">' + C.bars({ labels: names, series: [{ name: 'المشاهدات', values: dow }], label: 'المشاهدات حسب يوم الأسبوع' }) + '</figure>') +
      '</div>' +
      '<div class="dgrid dgrid--main">' +
        card('أداء المنتجات', rows.length ? '<div class="dtable-wrap"><table class="dtable"><thead><tr><th>المنتج</th><th>مشاهدات</th><th>سلة</th><th>مبيعات</th><th>تحويل</th><th>الإيراد</th></tr></thead><tbody>' +
          rows.slice(0, 12).map((r) => '<tr><td>' + esc(r.name) + '</td><td>' + fmt(r.views) + '</td><td>' + fmt(r.carts) + '</td><td>' + fmt(r.sold) + '</td><td>' + (r.views ? ((r.sold / r.views) * 100).toFixed(1) : '0.0') + '%</td><td>' + money(r.revenue) + '</td></tr>').join('') + '</tbody></table></div>'
          : empty({ icon: 'chart', title: 'لا توجد بيانات', text: 'ستظهر إحصائيات كل منتج بعد أول زيارة.' })) +
        card('المدن', cities.length ? '<ul class="hbars">' + cities.map((x) => '<li><span>' + esc(x.city) + '</span><div><i style="width:' + Math.round((x.n / maxCity) * 100) + '%"></i></div><strong>' + x.n + '</strong></li>').join('') + '</ul>' : empty({ icon: 'pin', title: 'لا توجد طلبات بعد' })) +
      '</div>' +
      (M.demo.on() ? '<p class="dnote">' + ic('alert') + 'الأرقام أعلاه تتضمن بيانات تجريبية. يمكنك إيقافها من «إعدادات المتجر».</p>' : '');
    return { html };
  };

  /* ---------- الراوتر ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const parts = raw.split('?');
    return { seg: parts[0].split('/').filter(Boolean), q: new URLSearchParams(parts[1] || '') };
  }
  let mounted = null;
  function render() {
    if (!M.seller.exists()) { setupView(); return; }
    if (!$('#dash')) shell();
    M.ads.sweep();
    const r = parseHash(), name = r.seg[0] || 'dashboard';
    const view = Seller.views[name] || Seller.views.dashboard;
    const out = view(r.seg.slice(1), r.q);
    const main = $('#main');
    main.innerHTML = out.html;
    document.title = (out.title || $('h1', main) && $('h1', main).textContent || 'لوحة البائع') + ' | لوحة البائع';
    if (out.mount) out.mount(main);
    refreshChrome();
    $('#dash').classList.remove('is-nav');
    if (mounted !== location.hash) { window.scrollTo(0, 0); mounted = location.hash; }
  }

  /* ---------- أحداث عامة ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    const a = t.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      if (act === 'nav-open') { $('#dash').classList.add('is-nav'); return; }
      if (act === 'nav-close') { $('#dash').classList.remove('is-nav'); return; }
      if (act === 'theme') {
        const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
        try { localStorage.setItem(M.K.theme, dark ? 'dark' : 'light'); } catch (_) { /* تجاهل */ }
        applyTheme(); return;
      }
      if (act === 'bell') {
        const p = $('[data-bell-panel]'), open = p.hidden;
        p.hidden = !open; a.setAttribute('aria-expanded', String(open));
        if (open) p.innerHTML = bellHTML();
        return;
      }
      if (act === 'bell-read') { M.notifs.readAll(); $('[data-bell-panel]').innerHTML = bellHTML(); refreshChrome(); return; }
      if (act === 'bell-go') { $('[data-bell-panel]').hidden = true; M.notifs.readAll(); refreshChrome(); return; }
      if (Seller.actions[act]) { e.preventDefault(); Seller.actions[act](a, e); return; }
    }
    if (!t.closest('.bell')) { const p = $('[data-bell-panel]'); if (p && !p.hidden) { p.hidden = true; $('.bell__btn').setAttribute('aria-expanded', 'false'); } }
    if (t.closest('.dash__nav a')) $('#dash').classList.remove('is-nav');
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-range]')) { sessionStorage.setItem('nq_range', e.target.value); render(); }
  });
  document.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-search]')) return;
    e.preventDefault();
    const q = $('#dash-q').value.trim();
    const cur = parseHash().seg[0];
    location.hash = '#/' + (cur === 'orders' ? 'orders' : 'products') + (q ? '?q=' + encodeURIComponent(q) : '');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const p = $('[data-bell-panel]'); if (p && !p.hidden) { p.hidden = true; $('.bell__btn').focus(); } $('#dash') && $('#dash').classList.remove('is-nav'); } });
  window.addEventListener('hashchange', render);

  function boot() { root.innerHTML = ''; render(); }
  /* ملفات الأقسام (المنتجات/الطلبات/المحفظة…) تُحمَّل بعد هذا الملف، فننتظر DOMContentLoaded
     حتى تكون كل الأقسام مسجّلة قبل أول رسم (وإلا فتح رابط مباشر مثل #/orders يعرض الرئيسية). */
  if (document.readyState === 'complete') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
