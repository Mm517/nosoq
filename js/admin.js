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

  const formatMoney = (value) => Number(value || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 });
  const formatDate = (value) => value ? new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
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
  const TABS = ['applications', 'users', 'sellers', 'riders', 'products', 'orders', 'financial', 'transactions', 'support', 'deliveries'];
  const loaders = {};
  const loaded = {};
  function activateTab(name) {
    if (!TABS.includes(name)) name = TABS[0];
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

  /* ===================== 7) الطلبات (Orders) ===================== */
  function renderOrders(orders) {
    const body = $('#orders-body');
    $('#orders-empty').hidden = orders.length > 0;
    body.innerHTML = orders.map((order) => {
      const customer = order.customer || {};
      return '<tr>' +
        '<td><strong dir="ltr">' + esc(order.order_number) + '</strong></td>' +
        '<td>' + esc(customer.name || order.customer_external_id || 'عميل') + '<small dir="ltr">' + esc(customer.phone || customer.email || '') + '</small></td>' +
        '<td>' + formatMoney(order.total) + '</td>' +
        '<td>' + formatMoney(order.shipping) + '</td>' +
        '<td>' + formatMoney(order.discount) + '</td>' +
        '<td>' + esc(order.payment || '—') + '</td>' +
        '<td>' + formatDate(order.created_at) + '</td>' +
        '<td>' + statusSelect(order.status, ['new', 'processing', 'shipped', 'completed', 'cancelled'], order.id, 'order') + '</td>' +
        '<td><button class="admin-link-btn" data-order-view="' + esc(order.id) + '">تفاصيل</button></td>' +
        '</tr>';
    }).join('');
  }

  loaders.orders = async function () {
    skeletonRows('#orders-body', 9);
    const orders = await api('/admin/orders' + ($('#order-filter').value ? '?status=' + encodeURIComponent($('#order-filter').value) : ''));
    renderOrders(orders || []);
  };
  $('#order-filter').addEventListener('change', () => { loaded.orders = false; loaders.orders().catch((e) => setNotice(e.message, true)); });

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

  /* ===================== الدعم (Support) — كما هو ===================== */
  function renderSupport(tickets) {
    const body = $('#support-body');
    const open = tickets.filter((ticket) => ['open', 'in_progress'].includes(ticket.status)).length;
    $('#support-count').textContent = open + ' مفتوحة';
    $('#support-empty').hidden = tickets.length > 0;
    body.innerHTML = tickets.map((ticket) => '<tr><td><strong dir="ltr">' + esc(ticket.ticket_number) + '</strong><small>' + formatDate(ticket.created_at) + '</small></td>' +
      '<td><strong>' + esc(ticket.subject) + '</strong><small>' + esc(ticket.message).slice(0, 90) + '</small></td>' +
      '<td>' + esc(ticket.name || 'زائر') + '<small dir="ltr">' + esc(ticket.email || '') + '</small></td>' +
      '<td class="admin-priority admin-priority--' + esc(ticket.priority) + '">' + esc(ticket.priority) + '</td><td>' +
      statusSelect(ticket.status, ['open', 'in_progress', 'resolved', 'closed'], ticket.id, 'support') + '</td></tr>').join('');
  }
  loaders.support = async function () { skeletonRows('#support-body', 5); renderSupport((await api('/admin/support')) || []); };

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
    skeletonStats('#admin-stats', 5);
    const summary = await api('/admin/summary');
    renderStats(summary);
    Object.keys(loaded).forEach((k) => { loaded[k] = false; });
    await loaders.applications();
    loaded.applications = true;
  }

  async function showApp() {
    const session = await api('/admin/session');
    $('#admin-identity').textContent = session.user.email || 'مشرف نَسَق';
    $('#admin-login').hidden = true; $('#admin-app').hidden = false;
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
    api('/admin/summary').then(renderStats).catch(() => {});
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
})();
