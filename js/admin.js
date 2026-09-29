(function () {
  'use strict';
  const TOKEN_KEY = 'nasaq_admin_access_token_v1';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {
    new: 'جديد', processing: 'قيد التجهيز', shipped: 'تم الشحن',
    completed: 'مكتمل', cancelled: 'ملغى', open: 'مفتوحة',
    in_progress: 'قيد المتابعة', resolved: 'تم الحل', closed: 'مغلقة',
    pending: 'قيد المراجعة', active: 'مفعّل', rejected: 'مرفوض',
    approved: 'مقبول', suspended: 'موقوف', unassigned: 'غير معيّن', assigned: 'مُسنَد',
    picked_up: 'تم الاستلام', out_for_delivery: 'في الطريق للعميل', delivered: 'تم التسليم', failed: 'فشل',
    disabled: 'معطّل', deleted: 'محذوف', hidden: 'مخفي', archived: 'مؤرشف',
    paid: 'مدفوع', refunded: 'مسترد'
  };

  /* ---------- fetch helper (يمر عبر js/api-shim.js) ---------- */
  const api = async (path, options) => {
    const response = await fetch('/api' + path, Object.assign({
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + (localStorage.getItem(TOKEN_KEY) || '') }
    }, options || {}));
    if (response.status === 204) return null;
    const text = await response.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) {}
    if (!response.ok) throw new Error((data && data.error) || 'تعذر تحميل البيانات');
    return data;
  };
  const sendJson = (path, body, method) => api(path, {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + (localStorage.getItem(TOKEN_KEY) || '') },
    body: JSON.stringify(body)
  });

  const formatMoney = (value) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ج.م';
  const formatDate = (value) => value ? new Date(value).toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const setNotice = (message, isError) => { const node = $('#admin-notice'); node.textContent = message || ''; node.hidden = !message; node.style.background = isError ? '#fde8e6' : ''; node.style.color = isError ? '#7a1f17' : ''; };
  const badge = (status) => '<span class="admin-badge admin-badge--' + esc(status) + '">' + esc(labels[status] || status || '—') + '</span>';

  /* ---------- Modal ---------- */
  const modalBackdrop = () => $('#admin-modal-backdrop');
  function openModal(title, bodyHtml) {
    $('#admin-modal-title').textContent = title;
    $('#admin-modal-body').innerHTML = bodyHtml;
    modalBackdrop().hidden = false;
  }
  function closeModal() { modalBackdrop().hidden = true; $('#admin-modal-body').innerHTML = ''; }
  $('#admin-modal-close').addEventListener('click', closeModal);
  modalBackdrop().addEventListener('click', (e) => { if (e.target === modalBackdrop()) closeModal(); });

  /* ---------- Lightbox ---------- */
  function openLightbox(url) { $('#admin-lightbox-img').src = url; $('#admin-lightbox').hidden = false; }
  $('#admin-lightbox').addEventListener('click', () => { $('#admin-lightbox').hidden = true; $('#admin-lightbox-img').src = ''; });

  function photoThumbs(photos) {
    const list = Array.isArray(photos) ? photos.filter(Boolean) : [];
    if (!list.length) return '<span class="admin-empty" style="padding:0">لا توجد صور</span>';
    return '<div class="admin-thumbs">' + list.map((url) => '<img class="admin-thumb" src="' + esc(url) + '" alt="صورة" data-lightbox="' + esc(url) + '">').join('') + '</div>';
  }
  document.addEventListener('click', (e) => {
    const thumb = e.target.closest('[data-lightbox]');
    if (thumb) openLightbox(thumb.dataset.lightbox);
  });

  /* ---------- Tabs ---------- */
  let ROLE = 'admin';
  const TABS = ['orders', 'deliveries', 'support', 'applications', 'users', 'sellers', 'riders', 'products', 'financial', 'transactions'];
  const loaders = {};
  const loaded = {};
  function activateTab(name) {
    if (!TABS.includes(name)) name = TABS[0];
    if (ROLE === 'support') name = 'support';
    const activeBtn = $('.admin-tab[data-tab="' + name + '"] span'); if (activeBtn) $('#admin-page-title').textContent = activeBtn.textContent;
    $$('.admin-tab').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === name));
    $$('.admin-panel').forEach((panel) => panel.classList.toggle('is-active', panel.id === 'panel-' + name));
    if (!loaded[name] && loaders[name]) {
      loaded[name] = true;
      loaders[name]().catch((err) => setNotice(err.message, true));
    }
  }
  $('#admin-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.admin-tab');
    if (btn) activateTab(btn.dataset.tab);
  });

  function statusSelect(value, values, dataId, type) {
    return '<select class="admin-status" data-status-type="' + type + '" data-id="' + esc(dataId) + '">' +
      values.map((item) => '<option value="' + item + '"' + (item === value ? ' selected' : '') + '>' + (labels[item] || item) + '</option>').join('') + '</select>';
  }

  /* ===================== سكيلتون عام: صفوف جدول أو بطاقات إحصائية ===================== */
  /* يُستدعى قبل انتظار api() في كل loader، فيعرض صفوفاً/بطاقات بنفس عدد الأعمدة
     الحقيقي مع Shimmer، ثم renderX() الحقيقية تستبدلها بمجرد وصول البيانات. */
  function skeletonRows(bodySelector, cols, rows) {
    const body = $(bodySelector);
    if (!body) return;
    const n = rows || 5;
    let html = '';
    for (let i = 0; i < n; i++) {
      html += '<tr class="admin-skel-row" aria-hidden="true">' +
        Array.from({ length: cols }).map(() => '<td><span class="skeleton skeleton--text" style="width:' + (50 + ((i * 37 + cols * 13) % 40)) + '%"></span></td>').join('') +
        '</tr>';
    }
    body.innerHTML = html;
  }
  function skeletonStats(containerSelector, count) {
    const el = $(containerSelector);
    if (!el) return;
    el.innerHTML = Array.from({ length: count || 5 }).map(() =>
      '<div class="admin-stat" aria-hidden="true"><span class="skeleton skeleton--text admin-skel-stat__label"></span><span class="skeleton skeleton--title admin-skel-stat__value"></span></div>'
    ).join('');
  }

  /* ===================== نظرة عامة (stats) ===================== */
  function renderStats(data) {
    const stats = [
      ['الطلبات', data.orders],
      ['طلبات مفتوحة', data.openOrders],
      ['تذاكر مفتوحة', data.openTickets],
      ['المنتجات النشطة', data.products],
      ['إجمالي المبيعات', formatMoney(data.revenue)]
    ];
    $('#admin-stats').innerHTML = stats.map((item) => '<div class="admin-stat"><span class="admin-stat__label">' + item[0] + '</span><strong class="admin-stat__value">' + item[1] + '</strong></div>').join('');
  }

  /* ===================== 2) طلبات التقديم (Applications) ===================== */
  function applicationDetailHtml(app) {
    const store = app.stores || {};
    const rider = app.riders || {};
    const payload = app.payload || {};
    const address = store.address && typeof store.address === 'object' ? (store.address.raw || JSON.stringify(store.address)) : (store.address || '');
    const rows = [
      ['رقم الطلب', app.request_id || app.id],
      ['النوع', app.account_type === 'seller' ? 'بائع' : 'سائق'],
      ['الاسم', app.name],
      ['الهاتف', app.phone],
      ['البريد', app.email],
      ['الرقم القومي', payload.nationalId],
      ['الرخصة/الترخيص', payload.license],
      ['الحالة', labels[app.status] || app.status],
      ['تاريخ التقديم', formatDate(app.submitted_at || app.created_at)]
    ];
    if (app.account_type === 'seller') {
      rows.push(['اسم المتجر', store.name], ['التصنيف', store.category], ['العنوان/الموقع', address]);
    } else {
      rows.push(['المركبة', rider.vehicle], ['المدينة', rider.city], ['المنطقة', rider.area], ['التغطية', rider.coverage]);
    }
    if (app.status === 'rejected' && app.review_note) rows.push(['سبب الرفض', app.review_note]);
    let html = '<dl>' + rows.filter((r) => r[1] != null && r[1] !== '').map((r) => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>';
    /* صور الطلب: المسارات المحفوظة في bucket خاص تُحوَّل لروابط موقَّعة بعد فتح النافذة (hydrateApplicationDocs)،
       وأي رابط مباشر قديم (http) يُعرض كما هو. */
    const docKeys = ['idPhoto', 'personalPhoto', 'storefrontPhoto', 'licensePhoto'];
    const docValues = docKeys.map((k) => payload[k]).filter(Boolean);
    const privatePaths = docValues.filter((v) => !/^https?:/i.test(v));
    const directUrls = docValues.filter((v) => /^https?:/i.test(v)).concat(store.logo_url ? [store.logo_url] : []);
    html += '<p><strong>المرفقات:</strong></p>';
    if (privatePaths.length) html += '<div id="app-docs" data-paths="' + esc(JSON.stringify(privatePaths)) + '"><span class="admin-empty" style="padding:0">جارٍ تحميل الصور…</span></div>';
    if (directUrls.length || !privatePaths.length) html += photoThumbs(directUrls);
    if (app.status === 'pending') {
      html += '<div class="admin-modal__actions">' +
        '<button class="admin-button admin-button--primary" data-app-approve="' + esc(app.id) + '">قبول الطلب</button>' +
        '<button class="admin-button" style="color:var(--admin-danger);border-color:var(--admin-danger)" data-app-reject="' + esc(app.id) + '">رفض الطلب</button>' +
        '</div>';
    }
    return html;
  }

  async function hydrateApplicationDocs() {
    const box = $('#app-docs');
    if (!box) return;
    try {
      const out = await sendJson('/admin/application-documents', { paths: JSON.parse(box.dataset.paths || '[]') });
      box.innerHTML = photoThumbs((out && out.urls) || []);
    } catch (_) {
      box.innerHTML = '<span class="admin-empty" style="padding:0">تعذّر تحميل الصور</span>';
    }
  }

  async function reviewApplication(id, status) {
    let reason = null;
    if (status === 'rejected') {
      reason = window.prompt('اكتب سبب الرفض (سيُرسل إشعار للمستخدم):', '');
      if (reason == null) return;
      if (!reason.trim()) { setNotice('لازم تكتب سبب الرفض.', true); return; }
    }
    await sendJson('/admin/applications/' + id + '/review', { status, reason });
    setNotice(status === 'approved' ? 'تم قبول الطلب وإرسال إشعار للمستخدم.' : 'تم رفض الطلب وإرسال إشعار للمستخدم.');
    closeModal();
    loaded.applications = false; await loaders.applications();
    loaded.sellers = false; loaded.riders = false;
  }

  function renderApplications(apps) {
    const body = $('#applications-body');
    $('#applications-empty').hidden = apps.length > 0;
    body.innerHTML = apps.map((app) => '<tr>' +
      '<td><strong dir="ltr">' + esc(app.request_id || '') + '</strong><small>' + formatDate(app.submitted_at || app.created_at) + '</small></td>' +
      '<td>' + esc(app.name || '—') + '</td>' +
      '<td>' + (app.account_type === 'seller' ? 'بائع' : 'سائق') + '</td>' +
      '<td dir="ltr">' + esc(app.phone || app.email || '—') + '</td>' +
      '<td>' + badge(app.status) + '</td>' +
      '<td><button class="admin-link-btn" data-app-view="' + esc(app.id) + '">التفاصيل</button></td>' +
      '</tr>').join('');
    body.dataset.cache = JSON.stringify(apps);
  }

  loaders.applications = async function () {
    skeletonRows('#applications-body', 6);
    const type = $('#app-type-filter').value; const status = $('#app-status-filter').value;
    const qs = [];
    if (type) qs.push('type=' + encodeURIComponent(type));
    if (status) qs.push('status=' + encodeURIComponent(status));
    const apps = await api('/admin/applications' + (qs.length ? '?' + qs.join('&') : ''));
    renderApplications(apps || []);
  };
  $('#app-type-filter').addEventListener('change', () => { loaded.applications = false; loaders.applications().catch((e) => setNotice(e.message, true)); });
  $('#app-status-filter').addEventListener('change', () => { loaded.applications = false; loaders.applications().catch((e) => setNotice(e.message, true)); });

  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-app-view]');
    if (viewBtn) {
      const apps = JSON.parse($('#applications-body').dataset.cache || '[]');
      const app = apps.find((a) => String(a.id) === viewBtn.dataset.appView);
      if (app) { openModal('طلب تقديم — ' + (app.name || ''), applicationDetailHtml(app)); hydrateApplicationDocs(); }
      return;
    }
    const approveBtn = e.target.closest('[data-app-approve]');
    if (approveBtn) { reviewApplication(approveBtn.dataset.appApprove, 'approved').catch((err) => setNotice(err.message, true)); return; }
    const rejectBtn = e.target.closest('[data-app-reject]');
    if (rejectBtn) { reviewApplication(rejectBtn.dataset.appReject, 'rejected').catch((err) => setNotice(err.message, true)); return; }
  });

  /* ===================== 3) المستخدمون (Users) ===================== */
  function renderUsers(users) {
    const body = $('#users-body');
    $('#users-empty').hidden = users.length > 0;
    body.innerHTML = users.map((u) => '<tr>' +
      '<td><strong>' + esc(u.name || '—') + '</strong></td>' +
      '<td dir="ltr">' + esc(u.phone || u.email || '—') + '</td>' +
      '<td>' + esc(labels[u.role] || u.role) + '</td>' +
      '<td>' + formatDate(u.created_at) + '</td>' +
      '<td>' + esc(u.orders_count || 0) + '</td>' +
      '<td>' + formatMoney(u.total_spent) + '</td>' +
      '<td>' + badge(u.account_status || 'active') + '</td>' +
      '<td class="admin-row-actions">' +
      '<button class="admin-link-btn" data-user-view="' + esc(u.external_id) + '">تفاصيل</button>' +
      '<button class="admin-button" data-user-toggle="' + esc(u.external_id) + '" data-current="' + esc(u.account_status || 'active') + '">' + (u.account_status === 'disabled' ? 'تفعيل' : 'تعطيل') + '</button>' +
      '<button class="admin-button" style="color:var(--admin-danger)" data-user-delete="' + esc(u.external_id) + '">حذف</button>' +
      '</td></tr>').join('');
  }

  loaders.users = async function () {
    skeletonRows('#users-body', 8);
    const users = await api('/admin/users');
    renderUsers(users || []);
  };

  async function showUserDetail(externalId) {
    const detail = await api('/admin/users/' + encodeURIComponent(externalId));
    const p = detail.profile;
    let html = '<dl>' +
      '<dt>الاسم</dt><dd>' + esc(p.name || '—') + '</dd>' +
      '<dt>الهاتف</dt><dd dir="ltr">' + esc(p.phone || '—') + '</dd>' +
      '<dt>البريد</dt><dd dir="ltr">' + esc(p.email || '—') + '</dd>' +
      '<dt>الدور</dt><dd>' + esc(labels[p.role] || p.role) + '</dd>' +
      '<dt>الحالة</dt><dd>' + badge(p.account_status || 'active') + '</dd>' +
      '<dt>تاريخ التسجيل</dt><dd>' + formatDate(p.created_at) + '</dd>' +
      '</dl>';
    html += '<p><strong>الطلبات (' + detail.orders.length + ')</strong></p>';
    html += detail.orders.length ? '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>الطلب</th><th>الإجمالي</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>' +
      detail.orders.map((o) => '<tr><td dir="ltr">' + esc(o.order_number) + '</td><td>' + formatMoney(o.total) + '</td><td>' + formatDate(o.created_at) + '</td><td>' + badge(o.status) + '</td></tr>').join('') +
      '</tbody></table></div>' : '<p class="admin-empty">لا توجد طلبات.</p>';
    openModal('تفاصيل المستخدم — ' + (p.name || ''), html);
  }

  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-user-view]');
    if (viewBtn) { showUserDetail(viewBtn.dataset.userView).catch((err) => setNotice(err.message, true)); return; }
    const toggleBtn = e.target.closest('[data-user-toggle]');
    if (toggleBtn) {
      const next = toggleBtn.dataset.current === 'disabled' ? 'active' : 'disabled';
      sendJson('/admin/users/' + toggleBtn.dataset.userToggle + '/status', { status: next })
        .then(() => { setNotice(next === 'disabled' ? 'تم تعطيل الحساب.' : 'تم تفعيل الحساب.'); loaded.users = false; return loaders.users(); })
        .catch((err) => setNotice(err.message, true));
      return;
    }
    const deleteBtn = e.target.closest('[data-user-delete]');
    if (deleteBtn) {
      if (!window.confirm('حذف هذا المستخدم؟ سيتم تعطيل حسابه وإخفاء بياناته الشخصية (حذف ناعم).')) return;
      sendJson('/admin/users/' + deleteBtn.dataset.userDelete + '/delete', {})
        .then(() => { setNotice('تم حذف المستخدم.'); loaded.users = false; return loaders.users(); })
        .catch((err) => setNotice(err.message, true));
    }
  });

  /* ===================== 4) البائعون (Sellers) ===================== */
  function renderSellers(sellers) {
    const body = $('#sellers-body');
    $('#sellers-empty').hidden = sellers.length > 0;
    body.innerHTML = sellers.map((s) => '<tr>' +
      '<td><strong>' + esc(s.name || 'متجر بلا اسم') + '</strong><small dir="ltr">' + esc(s.slug || '') + '</small></td>' +
      '<td>' + esc(s.products_count || 0) + '</td>' +
      '<td>' + esc(s.orders_count || 0) + '</td>' +
      '<td>' + formatMoney(s.total_sales) + '</td>' +
      '<td>' + formatMoney(s.commission_total) + ' (' + esc(s.commission_rate) + '%)</td>' +
      '<td>' + formatMoney(s.net_earnings) + '</td>' +
      '<td>' + statusSelect(s.status, ['active', 'rejected', 'suspended'], s.store_id, 'store') + '</td>' +
      '<td><button class="admin-link-btn" data-seller-earnings="' + esc(s.store_id) + '" data-seller-name="' + esc(s.name || '') + '">الأرباح</button></td>' +
      '</tr>').join('');
  }

  loaders.sellers = async function () {
    skeletonRows('#sellers-body', 8);
    const sellers = await api('/admin/sellers');
    renderSellers(sellers || []);
  };

  document.addEventListener('click', (e) => {
    const earnBtn = e.target.closest('[data-seller-earnings]');
    if (!earnBtn) return;
    api('/admin/sellers/' + earnBtn.dataset.sellerEarnings + '/earnings').then((earn) => {
      openModal('أرباح المتجر — ' + earnBtn.dataset.sellerName, earningsHtml(earn, 'orders_count'));
    }).catch((err) => setNotice(err.message, true));
  });

  function earningsHtml(earn, countKey) {
    return '<div class="admin-earn-grid">' +
      '<div class="admin-earn-card">اليوم<strong>' + formatMoney(earn.today) + '</strong></div>' +
      '<div class="admin-earn-card">الأسبوع<strong>' + formatMoney(earn.week) + '</strong></div>' +
      '<div class="admin-earn-card">الشهر<strong>' + formatMoney(earn.month) + '</strong></div>' +
      '<div class="admin-earn-card">كل الوقت<strong>' + formatMoney(earn.all_time) + '</strong></div>' +
      '</div><p>عدد ' + (countKey === 'orders_count' ? 'الطلبات' : 'التوصيلات') + ': <strong>' + esc(earn[countKey] || 0) + '</strong>' +
      (earn.avg_fee != null ? ' — متوسط الأجرة: <strong>' + formatMoney(earn.avg_fee) + '</strong>' : '') +
      (earn.commission_rate != null ? ' — نسبة العمولة: <strong>' + esc(earn.commission_rate) + '%</strong>' : '') + '</p>';
  }

  /* ===================== 5) السائقون (Riders) ===================== */
  function renderRidersFull(riders) {
    const body = $('#riders-full-body');
    $('#riders-full-empty').hidden = riders.length > 0;
    body.innerHTML = riders.map((r) => '<tr>' +
      '<td><strong>' + esc(r.name || 'مندوب') + '</strong></td>' +
      '<td dir="ltr">' + esc(r.phone || '—') + '</td>' +
      '<td>' + esc(r.vehicle || '—') + '</td>' +
      '<td>' + esc(r.city || '—') + '</td>' +
      '<td>' + (r.is_online ? '<span class="admin-badge admin-badge--active">متصل</span>' : '<span class="admin-badge">غير متصل</span>') + '</td>' +
      '<td>' + statusSelect(r.status, ['active', 'rejected', 'suspended'], r.id, 'rider') + '</td>' +
      '<td><button class="admin-link-btn" data-rider-earnings="' + esc(r.id) + '" data-rider-name="' + esc(r.name || '') + '">الأرباح</button></td>' +
      '</tr>').join('');
  }

  loaders.riders = async function () {
    skeletonRows('#riders-full-body', 7);
    const riders = await api('/admin/riders');
    renderRidersFull(riders || []);
  };

  document.addEventListener('click', (e) => {
    const earnBtn = e.target.closest('[data-rider-earnings]');
    if (!earnBtn) return;
    api('/admin/riders/' + earnBtn.dataset.riderEarnings + '/earnings').then((earn) => {
      openModal('أرباح المندوب — ' + earnBtn.dataset.riderName, earningsHtml(earn, 'deliveries_count'));
    }).catch((err) => setNotice(err.message, true));
  });

  /* ===================== 6) المنتجات (Products) ===================== */
  function renderProducts(products) {
    const body = $('#products-body');
    $('#products-empty').hidden = products.length > 0;
    body.innerHTML = products.map((p) => {
      const photo = Array.isArray(p.photos) && p.photos[0] ? p.photos[0] : '';
      const store = p.stores || {};
      return '<tr>' +
        '<td>' + (photo ? '<img class="admin-thumb" src="' + esc(photo) + '" data-lightbox="' + esc(photo) + '">' : '—') + '</td>' +
        '<td><strong>' + esc(p.name || '—') + '</strong><small>' + esc(p.sku || '') + '</small></td>' +
        '<td>' + formatMoney(p.price) + '</td>' +
        '<td>' + esc(p.stock != null ? p.stock : '—') + '</td>' +
        '<td>' + esc(store.name || '—') + '</td>' +
        '<td>' + statusSelect(p.status, ['pending', 'active', 'rejected', 'hidden', 'archived'], p.id, 'product') + '</td>' +
        '<td class="admin-row-actions"><button class="admin-link-btn" data-product-view="' + esc(p.id) + '">التفاصيل</button>' +
        '<button class="admin-button" style="color:var(--admin-danger)" data-product-delete="' + esc(p.id) + '">حذف</button></td>' +
        '</tr>';
    }).join('');
    body.dataset.cache = JSON.stringify(products);
  }

  loaders.products = async function () {
    skeletonRows('#products-body', 7);
    const status = $('#product-status-filter').value;
    const products = await api('/admin/products' + (status ? '?status=' + encodeURIComponent(status) : ''));
    renderProducts(products || []);
  };
  $('#product-status-filter').addEventListener('change', () => { loaded.products = false; loaders.products().catch((e) => setNotice(e.message, true)); });

  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-product-view]');
    if (viewBtn) {
      const products = JSON.parse($('#products-body').dataset.cache || '[]');
      const p = products.find((x) => String(x.id) === viewBtn.dataset.productView);
      if (!p) return;
      let html = '<dl>' +
        '<dt>الاسم</dt><dd>' + esc(p.name) + '</dd>' +
        '<dt>الوصف</dt><dd>' + esc(p.description || '—') + '</dd>' +
        '<dt>السعر</dt><dd>' + formatMoney(p.price) + '</dd>' +
        '<dt>المخزون</dt><dd>' + esc(p.stock) + '</dd>' +
        '<dt>الحالة</dt><dd>' + badge(p.status) + '</dd>' +
        (p.rejection_reason ? '<dt>سبب الرفض</dt><dd>' + esc(p.rejection_reason) + '</dd>' : '') +
        '</dl><p><strong>الصور:</strong></p>' + photoThumbs(p.photos);
      openModal('تفاصيل المنتج', html);
      return;
    }
    const delBtn = e.target.closest('[data-product-delete]');
    if (delBtn) {
      if (!window.confirm('حذف هذا المنتج نهائياً؟')) return;
      api('/admin/products/' + delBtn.dataset.productDelete, { method: 'DELETE' })
        .then(() => { setNotice('تم حذف المنتج.'); loaded.products = false; return loaders.products(); })
        .catch((err) => setNotice(err.message, true));
    }
  });

  /* ===================== 7) الطلبات (لوحة بطاقات لحظية) ===================== */
  const ORD_FLOW = { new: ['processing', 'قبول الطلب'], processing: ['shipped', 'تم الشحن'], shipped: ['completed', 'تم التسليم'] };
  const ORD_CHIPS = [['', 'الكل'], ['new', 'جديد'], ['processing', 'قيد التجهيز'], ['shipped', 'تم الشحن'], ['completed', 'مكتمل'], ['cancelled', 'ملغى']];
  let allOrders = [], ordFilter = '', ordSearch = '', ordKnown = null, ordSound = false;

  function timeAgo(value) {
    if (!value) return '—';
    const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
    if (mins < 1) return 'الآن';
    if (mins < 60) return 'منذ ' + mins + ' د';
    const h = Math.round(mins / 60);
    if (h < 24) return 'منذ ' + h + ' س';
    return formatDate(value);
  }
  function beep() {
    if (!ordSound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1175].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.type = 'sine'; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.16 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.15);
        o.start(ctx.currentTime + i * 0.16); o.stop(ctx.currentTime + i * 0.16 + 0.16);
      });
    } catch (_) { /* المتصفح منع الصوت */ }
  }
  function setOrdersBadge() {
    const n = allOrders.filter((o) => o.status === 'new').length;
    const b = $('#orders-badge'); if (b) { b.hidden = !n; b.textContent = n; }
  }
  function renderOrders(fresh) {
    setOrdersBadge();
    const counts = {};
    allOrders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    $('#ord-chips').innerHTML = ORD_CHIPS.map((c) => '<button type="button" class="ord-chip' + (ordFilter === c[0] ? ' is-active' : '') + '" data-ord-filter="' + c[0] + '">' + c[1] +
      '<b>' + (c[0] ? (counts[c[0]] || 0) : allOrders.length) + '</b></button>').join('');
    const q = ordSearch.trim().toLowerCase();
    const list = allOrders.filter((o) => (!ordFilter || o.status === ordFilter) && (!q ||
      String(o.order_number || '').toLowerCase().includes(q) || String((o.customer && o.customer.name) || '').toLowerCase().includes(q) || String((o.customer && o.customer.phone) || '').includes(q)));
    $('#orders-empty').hidden = list.length > 0;
    $('#orders-grid').innerHTML = list.map((o) => {
      const c = o.customer || {};
      const items = Array.isArray(o.order_items) ? o.order_items : [];
      const nm = c.name || 'عميل';
      const step = ORD_FLOW[o.status];
      return '<article class="ord-card ord-card--' + esc(o.status) + (fresh && fresh.has(o.id) ? ' is-fresh' : '') + '">' +
        '<div class="ord-card__top"><div><div class="ord-num">#' + esc(o.order_number) + '</div><div class="ord-time">' + timeAgo(o.created_at) + '</div></div>' + badge(o.status) + '</div>' +
        '<div class="ord-card__body">' +
        '<div class="ord-cust"><span class="ord-avatar">' + esc(nm.trim().charAt(0) || 'ع') + '</span><div><strong>' + esc(nm) + '</strong><small>' + esc(c.phone || c.email || '') + '</small></div></div>' +
        (items.length ? '<ul class="ord-items">' + items.slice(0, 3).map((it) => '<li><span>' + esc(it.product_name) + '</span><em>× ' + esc(it.quantity) + '</em></li>').join('') +
          (items.length > 3 ? '<li><em>+ ' + (items.length - 3) + ' منتجات أخرى</em></li>' : '') + '</ul>' : '') +
        '<div class="ord-meta"><span>' + esc(o.payment || 'الدفع غير محدد') + '</span><span class="ord-total">' + formatMoney(o.total) + '</span></div>' +
        '</div>' +
        '<div class="ord-actions">' +
        (step ? '<button type="button" class="admin-button admin-button--primary" data-ord-move="' + esc(o.id) + '" data-to="' + step[0] + '">' + step[1] + '</button>' : '') +
        '<button type="button" class="admin-button" data-order-view="' + esc(o.id) + '">التفاصيل</button>' +
        '<a class="admin-button admin-button--primary" href="admin-order.html?id=' + esc(o.id) + '">🚚 تتبّع الطلب</a>' +
        (['new', 'processing'].includes(o.status) ? '<button type="button" class="admin-button ord-danger" data-ord-move="' + esc(o.id) + '" data-to="cancelled">إلغاء</button>' : '') +
        '</div></article>';
    }).join('');
  }
  async function fetchOrders(silent) {
    if (!silent) $('#orders-grid').innerHTML = '<div class="ord-skel"></div><div class="ord-skel"></div><div class="ord-skel"></div>';
    const list = (await api('/admin/orders')) || [];
    const fresh = new Set();
    if (ordKnown) list.forEach((o) => { if (!ordKnown.has(o.id) && o.status === 'new') fresh.add(o.id); });
    ordKnown = new Set(list.map((o) => o.id));
    allOrders = list;
    renderOrders(fresh);
    if (fresh.size) { beep(); setNotice('وصل ' + fresh.size + ' طلب جديد.'); }
  }
  loaders.orders = () => fetchOrders(false);
  $('#ord-search').addEventListener('input', (e) => { ordSearch = e.target.value; renderOrders(); });
  $('#ord-sound').addEventListener('click', (e) => {
    ordSound = !ordSound; e.currentTarget.setAttribute('aria-pressed', ordSound);
    e.currentTarget.textContent = ordSound ? '🔔 صوت التنبيه شغّال' : '🔕 صوت التنبيه';
    if (ordSound) beep();
  });
  document.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-ord-filter]');
    if (chip) { ordFilter = chip.dataset.ordFilter; renderOrders(); return; }
    const mv = e.target.closest('[data-ord-move]');
    if (!mv) return;
    if (mv.dataset.to === 'cancelled' && !window.confirm('تأكيد إلغاء الطلب؟')) return;
    mv.disabled = true;
    try {
      await sendJson('/admin/orders/' + mv.dataset.ordMove + '/status', { status: mv.dataset.to }, 'PATCH');
      const o = allOrders.find((x) => String(x.id) === String(mv.dataset.ordMove)); if (o) o.status = mv.dataset.to;
      renderOrders(); api('/admin/summary').then(renderStats).catch(() => {});
    } catch (err) { setNotice(err.message, true); mv.disabled = false; }
  });
  setInterval(() => { if (ROLE === 'admin' && !document.hidden && !$('#admin-app').hidden) fetchOrders(true).catch(() => {}); }, 25000);

  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-order-view]');
    if (!viewBtn) return;
    api('/admin/orders/' + viewBtn.dataset.orderView).then((detail) => {
      const o = detail.order;
      const items = Array.isArray(o.order_items) ? o.order_items : [];
      let html = '<dl>' +
        '<dt>رقم الطلب</dt><dd dir="ltr">' + esc(o.order_number) + '</dd>' +
        '<dt>الإجمالي</dt><dd>' + formatMoney(o.total) + '</dd>' +
        '<dt>الشحن</dt><dd>' + formatMoney(o.shipping) + '</dd>' +
        '<dt>الخصم</dt><dd>' + formatMoney(o.discount) + '</dd>' +
        '<dt>الدفع</dt><dd>' + esc(o.payment || '—') + '</dd>' +
        '<dt>الحالة</dt><dd>' + badge(o.status) + '</dd>' +
        '<dt>التاريخ</dt><dd>' + formatDate(o.created_at) + '</dd>' +
        '</dl>';
      html += '<p><strong>المنتجات (' + items.length + ')</strong></p><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th></tr></thead><tbody>' +
        items.map((it) => '<tr><td>' + esc(it.product_name) + '</td><td>' + esc(it.quantity) + '</td><td>' + formatMoney(it.unit_price) + '</td></tr>').join('') + '</tbody></table></div>';
      if (detail.delivery) html += '<p><strong>التوصيل:</strong> ' + badge(detail.delivery.status) + (detail.delivery.riders ? ' — ' + esc(detail.delivery.riders.name) : '') + '</p>';
      html += '<p><a class="admin-button admin-button--primary" href="admin-order.html?id=' + esc(o.id) + '">فتح صفحة تتبّع الطلب</a></p>';
      openModal('تفاصيل الطلب', html);
    }).catch((err) => setNotice(err.message, true));
  });

  /* ===================== 8) اللوحة المالية ===================== */
  loaders.financial = async function () {
    skeletonStats('#financial-grid', 7);
    const f = await api('/admin/financial-summary');
    const cards = [
      ['إجمالي المبيعات', f.total_sales], ['عمولات المنصة', f.platform_commission],
      ['أرباح البائعين', f.seller_earnings], ['أرباح السائقين', f.rider_earnings],
      ['المدفوع', f.paid], ['المعلق', f.pending], ['المسترد', f.refunded]
    ];
    $('#financial-grid').innerHTML = cards.map((c) => '<div class="admin-stat"><span class="admin-stat__label">' + c[0] + '</span><strong class="admin-stat__value">' + formatMoney(c[1]) + '</strong></div>').join('');
  };

  /* ===================== 9) المعاملات ===================== */
  function renderTransactions(list) {
    const body = $('#transactions-body');
    $('#transactions-empty').hidden = list.length > 0;
    body.innerHTML = list.map((t) => '<tr>' +
      '<td dir="ltr">' + esc(String(t.id).slice(0, 8)) + '</td>' +
      '<td dir="ltr">' + esc(t.orders ? t.orders.order_number : '—') + '</td>' +
      '<td>' + esc(t.stores ? t.stores.name : '—') + '</td>' +
      '<td>' + esc(t.riders ? t.riders.name : '—') + '</td>' +
      '<td>' + formatMoney(t.amount) + '</td>' +
      '<td>' + formatMoney(t.commission_amount) + '</td>' +
      '<td>' + formatMoney(t.net_seller_amount) + '</td>' +
      '<td>' + badge(t.status) + '</td>' +
      '<td>' + formatDate(t.created_at) + '</td>' +
      '</tr>').join('');
  }
  loaders.transactions = async function () {
    skeletonRows('#transactions-body', 9);
    const status = $('#transaction-status-filter').value;
    const list = await api('/admin/transactions' + (status ? '?status=' + encodeURIComponent(status) : ''));
    renderTransactions(list || []);
  };
  $('#transaction-status-filter').addEventListener('change', () => { loaded.transactions = false; loaders.transactions().catch((e) => setNotice(e.message, true)); });

  /* ===================== الدعم (شات) ===================== */
  /* الكود بيحدّد صاحب المحادثة: SL- بائع | RD- سائق | US- مستخدم | GS- زائر */
  const SUP_GROUPS = [['', 'الكل', ''], ['SL', 'البائعين', 'SL-'], ['RD', 'السائقين', 'RD-'], ['US', 'المستخدمين', 'US-'], ['GS', 'زوّار', 'GS-']];
  const ORIGIN = { seller: 'بائع', customer: 'مستخدم', rider: 'سائق', guest: 'زائر' };
  const ORIGIN_PFX = { seller: 'SL', rider: 'RD', customer: 'US', guest: 'GS' };
  const supGroupOf = (t) => { const m = /^(SL|RD|US|GS)-/i.exec(t.ticket_number || ''); return m ? m[1].toUpperCase() : (ORIGIN_PFX[t.origin] || 'GS'); };
  const isOpenTicket = (t) => ['open', 'in_progress'].includes(t.status);
  let supTickets = [], supGroup = '', supStatus = 'active', supSearch = '', supCur = null, supCurCount = -1, supFiles = [], supSigned = {};
  const smEl = { conv: $('#sup-conv'), thread: $('#sup-thread') };

  function setSupportBadge(n) { const b = $('#support-badge'); if (b) { b.hidden = !n; b.textContent = n; } }

  function renderSupSummary() {
    const open = supTickets.filter(isOpenTicket), unread = open.filter((t) => t.admin_unread).length;
    const today = new Date().toDateString();
    const closedToday = supTickets.filter((t) => t.status === 'closed' && t.closed_at && new Date(t.closed_at).toDateString() === today).length;
    const by = (g) => open.filter((t) => supGroupOf(t) === g).length;
    const cards = [['محادثات مفتوحة', open.length, 'من ' + supTickets.length + ' إجمالاً'], ['رسائل جديدة', unread, 'مستنية ردّ'], ['اتقفلت النهارده', closedToday, 'محادثات'],
      ['بائعين / سائقين / مستخدمين', by('SL') + ' / ' + by('RD') + ' / ' + by('US'), 'المفتوح حالياً']];
    $('#sup-summary').innerHTML = cards.map((c) => '<div class="sup-sum"><span>' + c[0] + '</span><strong>' + c[1] + '</strong><small>' + c[2] + '</small></div>').join('');
    setSupportBadge(unread);
  }

  function renderSupList() {
    $('#sup-groups').innerHTML = SUP_GROUPS.map((g) => {
      const n = supTickets.filter((t) => isOpenTicket(t) && (!g[0] || supGroupOf(t) === g[0])).length;
      return '<button type="button" class="sup-group' + (supGroup === g[0] ? ' is-active' : '') + '" data-sup-group="' + g[0] + '">' + g[1] + (g[2] ? '<small>' + g[2] + '</small>' : '<small>&nbsp;</small>') + '<b>' + n + '</b></button>';
    }).join('');
    const q = supSearch.trim().toLowerCase();
    const list = supTickets.filter((t) => (!supGroup || supGroupOf(t) === supGroup) &&
      (supStatus === 'active' ? isOpenTicket(t) : (!supStatus || t.status === supStatus)) &&
      (!q || [t.ticket_number, t.name, t.subject, t.email].some((v) => String(v || '').toLowerCase().includes(q))));
    $('#support-empty').hidden = list.length > 0;
    $('#sup-items').innerHTML = list.map((t) => {
      const g = supGroupOf(t);
      return '<li class="sup-item' + (t.admin_unread && isOpenTicket(t) ? ' is-unread' : '') + (supCur === t.ticket_number ? ' is-active' : '') + '" data-open-ticket="' + esc(t.ticket_number) + '">' +
        '<span class="sup-av sup-av--' + g + '">' + g + '</span>' +
        '<div><div class="sup-item__name">' + (t.escalated ? '🆘 ' : '') + esc(t.name || 'زائر') + '<span>' + esc(t.ticket_number) + '</span></div>' +
        '<div class="sup-item__sub">' + esc(t.subject || t.message || '') + (t.handled_by ? ' · رد: ' + esc(t.handled_by) : '') + '</div></div>' +
        '<div class="sup-item__side"><span>' + timeAgo(t.last_message_at || t.created_at) + '</span>' +
        (t.admin_unread && isOpenTicket(t) ? '<i class="sup-unread">جديد</i>' : badge(t.status)) + '</div></li>';
    }).join('');
  }

  async function loadSupportList() {
    supTickets = (await api('/admin/support')) || [];
    renderSupSummary(); renderSupList();
  }
  loaders.support = async function () {
    $('#sup-items').innerHTML = Array.from({ length: 6 }).map(() => '<li class="sup-item"><span class="skeleton" style="width:42px;height:42px;border-radius:50%"></span><div><span class="skeleton skeleton--text"></span></div><span></span></li>').join('');
    await loadSupportList();
    if (ROLE === 'admin') loadStaff().catch(() => {});
  };

  async function signPaths(msgs) {
    const need = []; msgs.forEach((m) => (m.attachments || []).forEach((p) => { if (!supSigned[p]) need.push(p); }));
    if (!need.length) return;
    try { const out = await sendJson('/support/signed', { paths: need }); Object.assign(supSigned, out.urls || {}); } catch (_) { /* تظهر بدون معاينة */ }
  }
  async function smRender(data) {
    const t = data.ticket, msgs = data.messages && data.messages.length ? data.messages : [{ role: 'user', body: t.message, created_at: t.created_at, attachments: [] }];
    await signPaths(msgs);
    const g = supGroupOf(t);
    $('#sup-title').textContent = t.subject || t.ticket_number;
    $('#sup-meta').textContent = t.ticket_number + ' · ' + (t.name || 'زائر') + ' (' + (ORIGIN[t.origin] || ORIGIN[{ SL: 'seller', RD: 'rider', US: 'customer' }[g]] || 'زائر') + ')' + (t.email ? ' · ' + t.email : '') + (t.category ? ' · ' + t.category : '');
    const stick = smEl.thread.scrollHeight - smEl.thread.scrollTop - smEl.thread.clientHeight < 80;
    smEl.thread.innerHTML = msgs.map((m) => {
      const staff = m.role === 'admin' || m.role === 'support';
      const who = staff ? ((m.role === 'admin' ? 'الإدارة' : 'الدعم') + (m.author_name ? ' · ' + m.author_name : '')) : (t.name || 'المستخدم');
      const imgs = (m.attachments || []).map((p) => supSigned[p] ? '<img src="' + esc(supSigned[p]) + '" alt="مرفق" data-lightbox="' + esc(supSigned[p]) + '">' : '').join('');
      return '<li class="sup-msg' + (staff ? ' sup-msg--staff' : '') + '"><b>' + esc(who) + '</b>' + (m.body ? '<p>' + esc(m.body) + '</p>' : '') + (imgs ? '<div class="sup-imgs">' + imgs + '</div>' : '') + '<small>' + formatDate(m.created_at) + '</small></li>';
    }).join('') + (t.status === 'closed' ? '<li class="sup-sys">تم قفل المحادثة' + (t.closed_at ? ' · ' + formatDate(t.closed_at) : '') + '</li>' : '');
    $('#sup-status').value = t.status;
    const esc2 = $('#sup-escalate'); if (esc2) { esc2.hidden = ROLE === 'admin' || !!t.escalated; }
    if (t.escalated) $('#sup-meta').textContent += ' · 🆘 طُلبت مساعدة الإدارة';
    const closed = t.status === 'closed';
    $('#sup-form').hidden = closed; $('#sup-closed').hidden = !closed; $('#sup-close-btn').hidden = closed;
    supCurCount = msgs.length;
    if (stick || supCurCount <= 1) smEl.thread.scrollTop = smEl.thread.scrollHeight;
  }
  async function smOpen(ticket) {
    supCur = ticket; supFiles = []; renderPreviews(); $('#sup-text').value = '';
    $('#sup-placeholder').hidden = true; smEl.conv.hidden = false; $('#sup-shell').classList.add('is-chat');
    smEl.thread.innerHTML = '<li class="sup-msg"><span class="skeleton skeleton--text" style="width:60%"></span></li>';
    try {
      await smRender(await api('/admin/support/' + encodeURIComponent(ticket)));
      const t = supTickets.find((x) => x.ticket_number === ticket); if (t) t.admin_unread = false;
      renderSupSummary(); renderSupList(); $('#sup-text').focus();
    } catch (err) { setNotice(err.message, true); smBack(); }
  }
  function smBack() { supCur = null; $('#sup-shell').classList.remove('is-chat'); smEl.conv.hidden = true; $('#sup-placeholder').hidden = false; renderSupList(); }
  async function setTicketStatus(status) {
    if (!supCur) return;
    await sendJson('/admin/support/' + encodeURIComponent(supCur) + '/status', { status }, 'PATCH');
    await smRender(await api('/admin/support/' + encodeURIComponent(supCur))); loadSupportList().catch(() => {});
  }

  function renderPreviews() {
    $('#sup-previews').innerHTML = supFiles.map((f, i) => '<div class="sup-prev"><img src="' + f.dataUrl + '" alt=""><button type="button" data-sup-rm="' + i + '" aria-label="حذف">×</button></div>').join('');
  }
  $('#sup-file').addEventListener('change', async (e) => {
    for (const file of Array.from(e.target.files || [])) {
      if (supFiles.length >= 4) { setNotice('أقصى عدد 4 صور في الرسالة.', true); break; }
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { setNotice('الصور فقط (JPG / PNG / WebP / GIF).', true); continue; }
      if (file.size > 5 * 1024 * 1024) { setNotice('الصورة أكبر من 5 ميجابايت.', true); continue; }
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      supFiles.push({ dataUrl, name: file.name });
    }
    e.target.value = ''; renderPreviews();
  });
  $('#sup-text').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; });
  $('#sup-text').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#sup-form').requestSubmit(); } });

  $('#sup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('#sup-text').value.trim();
    if ((!text && !supFiles.length) || !supCur) return;
    const btn = $('#sup-send'); btn.disabled = true;
    try {
      const paths = [];
      for (const f of supFiles) paths.push((await sendJson('/admin/support/' + encodeURIComponent(supCur) + '/upload', { dataUrl: f.dataUrl })).path);
      const st = $('#sup-status').value;
      await sendJson('/admin/support/' + encodeURIComponent(supCur) + '/reply', { body: text, status: st === 'open' ? 'in_progress' : st, attachments: paths });
      $('#sup-text').value = ''; $('#sup-text').style.height = ''; supFiles = []; renderPreviews();
      await smRender(await api('/admin/support/' + encodeURIComponent(supCur))); smEl.thread.scrollTop = smEl.thread.scrollHeight;
      loadSupportList().catch(() => {});
    } catch (err) { setNotice(err.message, true); } finally { btn.disabled = false; }
  });

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-sup-group]'); if (g) { supGroup = g.dataset.supGroup; renderSupList(); return; }
    const open = e.target.closest('[data-open-ticket]'); if (open) { smOpen(open.dataset.openTicket); return; }
    const rm = e.target.closest('[data-sup-rm]'); if (rm) { supFiles.splice(Number(rm.dataset.supRm), 1); renderPreviews(); return; }
    if (e.target.closest('#sup-escalate')) { const n = window.prompt('ملاحظة للإدارة (اختياري)') ; window.sb.rpc('support_escalate', { p_ticket_number: supCur, p_note: n || null }).then(() => smOpen(supCur)).catch((err) => setNotice(err.message, true)); return; }
    if (e.target.closest('#sup-back')) { smBack(); return; }
    if (e.target.closest('#sup-close-btn')) { if (window.confirm('قفل المحادثة دي؟ تقدر تعيد فتحها بعدين.')) setTicketStatus('closed').catch((err) => setNotice(err.message, true)); return; }
    if (e.target.closest('#sup-reopen')) { setTicketStatus('open').catch((err) => setNotice(err.message, true)); }
  });
  $('#sup-status').addEventListener('change', (e) => setTicketStatus(e.target.value).catch((err) => setNotice(err.message, true)));
  $('#sup-search').addEventListener('input', (e) => { supSearch = e.target.value; renderSupList(); });
  $('#sup-status-filter').addEventListener('change', (e) => { supStatus = e.target.value; renderSupList(); });

  /* ---- فريق الدعم (للأدمن فقط) ---- */
  const CODE_LABELS = [['seller', 'SL', 'بائعين'], ['rider', 'RD', 'سائقين'], ['customer', 'US', 'مستخدمين']];
  async function loadStaff() {
    const rows = (await api('/admin/support-staff')) || [];
    $('#staff-count').textContent = rows.length + ' موظف';
    $('#staff-body').innerHTML = rows.length ? rows.map((s) => '<tr><td><strong>' + esc(s.name || '—') + '</strong></td><td dir="ltr">' + esc(s.email || '') + '</td><td class="sup-codes">' +
      CODE_LABELS.map((c) => '<label><input type="checkbox" data-staff-scope="' + esc(s.user_id) + '" value="' + c[0] + '"' + ((s.handles || []).includes(c[0]) ? ' checked' : '') + '> <b dir="ltr">' + c[1] + '</b> ' + c[2] + '</label>').join('') +
      '</td><td>' + formatDate(s.created_at) + '</td><td><button class="admin-link-btn" style="color:var(--a-bad)" data-staff-remove="' + esc(s.user_id) + '">إزالة</button></td></tr>').join('') :
      '<tr><td colspan="5" class="admin-empty">لم تضف موظفي دعم بعد.</td></tr>';
  }
  document.addEventListener('change', async (e) => {
    const c = e.target.closest('[data-staff-scope]'); if (!c) return;
    const all = Array.from(document.querySelectorAll('[data-staff-scope="' + c.dataset.staffScope + '"]:checked')).map((x) => x.value);
    if (!all.length) { c.checked = true; setNotice('لازم يبقى للموظف كود واحد على الأقل.', true); return; }
    try { await window.sb.rpc('admin_support_staff_set_scope', { p_user_id: c.dataset.staffScope, p_handles: all }).then((r) => { if (r.error) throw r.error; }); setNotice('تم تحديث أكواد الموظف.'); } catch (err) { setNotice(err.message, true); }
  });
  $('#staff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#staff-email').value.trim().toLowerCase(), name = $('#staff-name').value.trim(), pass = $('#staff-pass').value;
    const handles = Array.from(document.querySelectorAll('#staff-codes input:checked')).map((x) => x.value);
    if (!handles.length) { setNotice('اختر كود واحد على الأقل (SL / RD / US).', true); return; }
    const btn = e.submitter || e.target.querySelector('button[type=submit]'); if (btn) btn.disabled = true;
    try {
      /* إنشاء الحساب + صلاحية الدعم في خطوة واحدة على السيرفر (مؤكَّد فورًا، بدون إيميل تأكيد) */
      if (pass.length < 6) throw new Error('كلمة المرور لازم تكون 6 أحرف على الأقل.');
      const r = await window.sb.rpc('admin_support_staff_create_direct', { p_email: email, p_name: name, p_handles: handles, p_password: pass });
      if (r.error) throw r.error;
      const res = r.data || {};
      $('#staff-form').reset(); $('#staff-codes input[value=seller]').checked = true;
      setNotice(res.created ? ('تم إنشاء موظف الدعم. يدخل من support.html بالبريد ' + email + ' وكلمة المرور اللي كتبتها.') : res.password_reset ? ('تم تغيير كلمة مرور الموظف. يدخل من support.html بالبريد ' + email) : ('الحساب موجود قبل كده وبقى موظف دعم. يدخل من support.html بنفس كلمة مروره الحالية.')); await loadStaff();
    } catch (err) { setNotice(err.message, true); }
    finally { if (btn) btn.disabled = false; }
  });
  document.addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-staff-remove]'); if (!rm || !window.confirm('إزالة موظف الدعم ده؟')) return;
    try { await api('/admin/support-staff/' + rm.dataset.staffRemove, { method: 'DELETE' }); await loadStaff(); } catch (err) { setNotice(err.message, true); }
  });

  /* تحديث تلقائي: القائمة والمحادثة المفتوحة كل 8 ثواني */
  setInterval(() => {
    if (document.hidden || $('#admin-app').hidden) return;
    loadSupportList().catch(() => {});
    if (supCur && !smEl.conv.hidden) api('/admin/support/' + encodeURIComponent(supCur)).then((d) => {
      if ((d.messages || []).length !== supCurCount || (d.ticket && d.ticket.status !== $('#sup-status').value)) return smRender(d);
    }).catch(() => {});
  }, 8000);
  setTimeout(() => { if (!$('#admin-app').hidden) loadSupportList().catch(() => {}); }, 2500);

/* ===================== التوصيلات (Deliveries) — كما هو ===================== */
  let cachedRiders = [];
  function riderOptions(riders, selected) {
    return '<option value="">اختر مندوباً</option>' + riders.filter((rider) => rider.status === 'active').map((rider) =>
      '<option value="' + esc(rider.id) + '"' + (String(rider.id) === String(selected || '') ? ' selected' : '') + '>' + esc(rider.name || rider.phone || 'مندوب') + '</option>').join('');
  }
  function renderDeliveries(deliveries, riders) {
    const body = $('#deliveries-body');
    $('#deliveries-empty').hidden = deliveries.length > 0;
    body.innerHTML = deliveries.map((delivery) => {
      const store = delivery.stores || {};
      const currentRider = delivery.riders || {};
      return '<tr><td><strong dir="ltr">' + esc(delivery.order_number || delivery.order_id || delivery.id) + '</strong></td>' +
        '<td>' + esc(store.name || '—') + '</td><td>' + esc(delivery.delivery_address || delivery.address || '—') + '</td>' +
        '<td>' + esc(labels[delivery.status] || delivery.status || '—') + '</td><td><select class="admin-select admin-delivery-rider" data-delivery-id="' + esc(delivery.id) + '">' +
        (currentRider.name ? '<option value="' + esc(delivery.rider_id) + '">' + esc(currentRider.name) + '</option>' : '') +
        riderOptions(riders, delivery.rider_id) + '</select></td></tr>';
    }).join('');
  }
  loaders.deliveries = async function () {
    skeletonRows('#deliveries-body', 5);
    loadRadius().catch((err) => setNotice(err.message, true));
    const [deliveries, riders] = await Promise.all([api('/admin/deliveries'), api('/admin/riders')]);
    cachedRiders = riders || [];
    renderDeliveries(deliveries || [], cachedRiders);
  };

  /* ---------- إعداد Radius الطلبات القريبة (متر) ---------- */
  const radiusText = (m) => (window.Distance ? window.Distance.format(m) : m + ' متر');
  async function loadRadius() {
    const data = await api('/admin/settings/delivery-radius');
    $('#radius-input').value = data.meters;
    $('#radius-current').textContent = 'القيمة الحالية: ' + radiusText(data.meters);
  }
  $('#radius-save').addEventListener('click', async () => {
    const btn = $('#radius-save');
    const meters = Number($('#radius-input').value);
    if (!Number.isFinite(meters) || meters < 1 || meters > 50000) { setNotice('النطاق يجب أن يكون بين 1 متر و50000 متر (50 كم).', true); return; }
    btn.disabled = true;
    try {
      const data = await sendJson('/admin/settings/delivery-radius', { meters }, 'PUT');
      $('#radius-input').value = data.meters;
      $('#radius-current').textContent = 'القيمة الحالية: ' + radiusText(data.meters);
      setNotice('تم حفظ نطاق الطلبات القريبة.');
    } catch (err) { setNotice(err.message, true); }
    finally { btn.disabled = false; }
  });

  /* ===================== تحميل أولي + تحديث ===================== */
  async function loadOverviewAndFirstTab() {
    setNotice('');
    Object.keys(loaded).forEach((k) => { loaded[k] = false; });
    if (ROLE === 'support') { activateTab('support'); return; }
    skeletonStats('#admin-stats', 5);
    api('/admin/summary').then(renderStats).catch((e) => setNotice(e.message, true));
    activateTab('orders');
  }

  function applyRole() {
    const support = ROLE === 'support';
    $('#admin-role-tag').textContent = support ? 'دعم' : 'إدارة';
    $$('.admin-tab').forEach((btn) => { btn.hidden = support && btn.dataset.tab !== 'support'; });
    $('#admin-stats').hidden = support;
    $('#staff-card').hidden = support;
  }

  async function showApp() {
    const session = await api('/admin/session');
    ROLE = (session.user && session.user.role) === 'support' ? 'support' : 'admin';
    $('#admin-identity').textContent = session.user.email || 'مشرف نَسَق';
    $('#admin-login').hidden = true; $('#admin-app').hidden = false;
    if (ROLE === 'support') { location.replace('support.html'); return; }
    applyRole();
    await loadOverviewAndFirstTab();
  }

  $('#admin-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = $('#admin-login-error'); error.textContent = '';
    try {
      const data = await fetch('/api/admin/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: $('#admin-email').value, password: $('#admin-password').value })
      }).then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error || 'فشل الدخول'); return value; });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem('nasaq_access_token_v1', data.access_token);
      localStorage.setItem('nasaq_session_v1', JSON.stringify(data.user));
      await showApp();
    } catch (err) { error.textContent = err.message; }
  });

  $('#admin-logout').addEventListener('click', () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('nasaq_access_token_v1');
      localStorage.removeItem('nasaq_session_v1');
      location.reload();
    });
  });
  $('#admin-refresh').addEventListener('click', () => {
    Object.keys(loaded).forEach((k) => { loaded[k] = false; });
    const activeTab = $('.admin-tab.is-active');
    if (ROLE === 'admin') api('/admin/summary').then(renderStats).catch(() => {});
    if (activeTab && loaders[activeTab.dataset.tab]) {
      loaded[activeTab.dataset.tab] = true;
      loaders[activeTab.dataset.tab]().catch((err) => setNotice(err.message, true));
    }
  });

  /* ---------- تغيير الحالات عبر القوائم المنسدلة (statusSelect) ---------- */
  document.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-status-type]');
    if (select) {
      const type = select.dataset.statusType; const id = select.dataset.id; const value = select.value;
      try {
        if (type === 'product' && value === 'rejected') {
          const reason = window.prompt('اكتب سبب رفض المنتج (سيُرسل إشعار للبائع):', '');
          if (reason == null) { loaded.products = false; await loaders.products(); return; }
          if (!reason.trim()) { setNotice('لازم تكتب سبب الرفض.', true); loaded.products = false; await loaders.products(); return; }
          await sendJson('/admin/products/' + id + '/review', { status: value, reason });
        } else if (type === 'product') {
          await sendJson('/admin/products/' + id + '/review', { status: value });
        } else if (type === 'order') {
          await sendJson('/admin/orders/' + id + '/status', { status: value }, 'PATCH');
        } else if (type === 'support') {
          await sendJson('/admin/support/' + id + '/status', { status: value }, 'PATCH');
        } else if (type === 'store') {
          await sendJson('/admin/stores/' + id + '/review', { status: value });
        } else if (type === 'rider') {
          await sendJson('/admin/riders/' + id + '/review', { status: value });
        }
        setNotice('تم تحديث الحالة.');
        Object.keys(loaded).forEach((k) => { loaded[k] = false; });
        const activeTab = $('.admin-tab.is-active');
        if (activeTab && loaders[activeTab.dataset.tab]) { loaded[activeTab.dataset.tab] = true; await loaders[activeTab.dataset.tab](); }
      } catch (err) { setNotice(err.message, true); }
      return;
    }
    const deliverySelect = event.target.closest('[data-delivery-id]');
    if (!deliverySelect || !deliverySelect.value) return;
    try {
      await sendJson('/admin/deliveries/' + deliverySelect.dataset.deliveryId + '/assign', { riderId: deliverySelect.value });
      setNotice('تم إسناد التوصيلة.');
      loaded.deliveries = false; await loaders.deliveries();
    } catch (err) { setNotice(err.message, true); }
  });

  /* Supabase keeps its session across reloads, so an admin who signed in from
     the normal auth page must also be able to open this dashboard directly. */
  showApp().catch(() => {
    localStorage.removeItem(TOKEN_KEY);
  });

  /* قايمة الموبايل (الأربع خطوط) */
  (function () {
    const burger = document.getElementById('admin-burger'), side = document.getElementById('admin-side'), bd = document.getElementById('admin-backdrop');
    if (!burger || !side || !bd) return;
    const set = (open) => { document.body.classList.toggle('admin-nav-open', open); burger.setAttribute('aria-expanded', open ? 'true' : 'false'); bd.hidden = !open; };
    burger.addEventListener('click', () => set(!document.body.classList.contains('admin-nav-open')));
    bd.addEventListener('click', () => set(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    side.addEventListener('click', (e) => { if (e.target.closest('.admin-tab')) set(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 860) set(false); });
  })();
})();
