(function () {
  'use strict';
  const TOKEN_KEY = 'nasaq_admin_access_token_v1';
  const $ = (s) => document.querySelector(s);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {
    new: 'جديد', processing: 'قيد التجهيز', shipped: 'تم الشحن',
    completed: 'مكتمل', cancelled: 'ملغى', open: 'مفتوحة',
    in_progress: 'قيد المتابعة', resolved: 'تم الحل', closed: 'مغلقة',
    pending: 'قيد المراجعة', active: 'مفعّل', rejected: 'مرفوض',
    suspended: 'موقوف', unassigned: 'غير معيّن', assigned: 'مُسنَد',
    picked_up: 'تم الاستلام', delivered: 'تم التسليم', failed: 'تعذّر التسليم'
  };
  const api = async (path, options) => {
    const response = await fetch('/api' + path, Object.assign({
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + (localStorage.getItem(TOKEN_KEY) || '') }
    }, options || {}));
    const text = await response.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) {}
    if (!response.ok) throw new Error((data && data.error) || 'تعذر تحميل البيانات');
    return data;
  };
  const postJson = (path, body, method) => api(path, {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + (localStorage.getItem(TOKEN_KEY) || '') },
    body: JSON.stringify(body)
  });
  const formatMoney = (value) => Number(value || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 });
  const formatDate = (value) => value ? new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const setNotice = (message) => { const node = $('#admin-notice'); node.textContent = message || ''; node.hidden = !message; };

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

  function statusSelect(value, values, dataId, type) {
    return '<select class="admin-status" data-status-type="' + type + '" data-id="' + esc(dataId) + '">' +
      values.map((item) => '<option value="' + item + '"' + (item === value ? ' selected' : '') + '>' + labels[item] + '</option>').join('') + '</select>';
  }

  function renderOrders(orders) {
    const body = $('#orders-body');
    $('#orders-empty').hidden = orders.length > 0;
    body.innerHTML = orders.map((order) => {
      const customer = order.customer || {};
      const itemCount = Array.isArray(order.order_items) ? order.order_items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0;
      return '<tr><td><strong dir="ltr">' + esc(order.order_number) + '</strong><small>' + itemCount + ' قطعة</small></td>' +
        '<td>' + esc(customer.name || order.customer_external_id || 'عميل') + '<small dir="ltr">' + esc(customer.phone || customer.email || '') + '</small></td>' +
        '<td>' + formatMoney(order.total) + '</td><td>' + formatDate(order.created_at) + '</td><td>' +
        statusSelect(order.status, ['new','processing','shipped','completed','cancelled'], order.id, 'order') + '</td></tr>';
    }).join('');
  }

  function renderSupport(tickets) {
    const body = $('#support-body');
    const open = tickets.filter((ticket) => ['open', 'in_progress'].includes(ticket.status)).length;
    $('#support-count').textContent = open + ' مفتوحة';
    $('#support-empty').hidden = tickets.length > 0;
    body.innerHTML = tickets.map((ticket) => '<tr><td><strong dir="ltr">' + esc(ticket.ticket_number) + '</strong><small>' + formatDate(ticket.created_at) + '</small></td>' +
      '<td><strong>' + esc(ticket.subject) + '</strong><small>' + esc(ticket.message).slice(0, 90) + '</small></td>' +
      '<td>' + esc(ticket.name || 'زائر') + '<small dir="ltr">' + esc(ticket.email || '') + '</small></td>' +
      '<td class="admin-priority admin-priority--' + esc(ticket.priority) + '">' + esc(ticket.priority) + '</td><td>' +
      statusSelect(ticket.status, ['open','in_progress','resolved','closed'], ticket.id, 'support') + '</td></tr>').join('');
  }

  function renderStores(stores) {
    const body = $('#stores-body');
    $('#stores-empty').hidden = stores.length > 0;
    body.innerHTML = stores.map((store) => '<tr><td><strong>' + esc(store.name || 'متجر بلا اسم') + '</strong><small dir="ltr">' + esc(store.slug || '') + '</small></td>' +
      '<td>' + esc(store.phone || store.email || '—') + '</td><td>' + esc(store.category || '—') + '</td><td>' + esc(labels[store.status] || store.status || '—') + '</td><td>' +
      statusSelect(store.status, ['active','rejected','suspended'], store.id, 'store') + '</td></tr>').join('');
  }

  function renderRiders(riders) {
    const body = $('#riders-body');
    $('#riders-empty').hidden = riders.length > 0;
    body.innerHTML = riders.map((rider) => '<tr><td><strong>' + esc(rider.name || 'مندوب') + '</strong><small>' + esc(rider.user_external_id || '') + '</small></td>' +
      '<td dir="ltr">' + esc(rider.phone || '—') + '</td><td>' + esc(rider.vehicle || '—') + '</td><td>' + esc(rider.city || '—') + '</td><td>' +
      statusSelect(rider.status, ['active','rejected','suspended'], rider.id, 'rider') + '</td></tr>').join('');
  }

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

  async function load() {
    setNotice('');
    const [summary, orders, tickets, stores, riders, deliveries] = await Promise.all([
      api('/admin/summary'),
      api('/admin/orders' + ($('#order-filter').value ? '?status=' + encodeURIComponent($('#order-filter').value) : '')),
      api('/admin/support'),
      api('/admin/stores'),
      api('/admin/riders'),
      api('/admin/deliveries')
    ]);
    renderStats(summary); renderOrders(orders); renderSupport(tickets);
    renderStores(stores || []); renderRiders(riders || []); renderDeliveries(deliveries || [], riders || []);
  }

  async function showApp() {
    const session = await api('/admin/session');
    $('#admin-identity').textContent = session.user.email || 'مشرف نَسَق';
    $('#admin-login').hidden = true; $('#admin-app').hidden = false;
    await load();
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
  $('#admin-refresh').addEventListener('click', () => load().catch((err) => setNotice(err.message)));
  $('#order-filter').addEventListener('change', () => load().catch((err) => setNotice(err.message)));
  document.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-status-type]');
    if (select) {
      try {
        let path = '';
        if (select.dataset.statusType === 'order') path = '/admin/orders/' + select.dataset.id + '/status';
        else if (select.dataset.statusType === 'support') path = '/admin/support/' + select.dataset.id + '/status';
        else if (select.dataset.statusType === 'store') path = '/admin/stores/' + select.dataset.id + '/review';
        else if (select.dataset.statusType === 'rider') path = '/admin/riders/' + select.dataset.id + '/review';
        await postJson(path, { status: select.value }, select.dataset.statusType === 'order' || select.dataset.statusType === 'support' ? 'PATCH' : 'POST');
        setNotice('تم تحديث الحالة.');
        await load();
      } catch (err) { setNotice(err.message); }
      return;
    }
    const deliverySelect = event.target.closest('[data-delivery-id]');
    if (!deliverySelect || !deliverySelect.value) return;
    try {
      await postJson('/admin/deliveries/' + deliverySelect.dataset.deliveryId + '/assign', { riderId: deliverySelect.value });
      setNotice('تم إسناد التوصيلة.');
      await load();
    } catch (err) { setNotice(err.message); }
  });

  /* Supabase keeps its session across reloads, so an admin who signed in from
     the normal auth page must also be able to open this dashboard directly. */
  showApp().catch(() => {
    localStorage.removeItem(TOKEN_KEY);
  });
})();