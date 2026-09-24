/* Nasaq cloud sync.
   The storefront keeps its existing local UI state for instant interactions,
   while this bridge mirrors users, stores, products, orders, applications, and
   image URLs to the Supabase-backed API. */
(function () {
  'use strict';

  const USER_KEY = 'nasaq_cloud_user_v1';
  const TOKEN_KEY = 'nasaq_access_token_v1';
  const SESSION_KEY = 'nasaq_session_v1';
  const getSession = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; }
  };
  const getUserId = () => {
    try {
      const session = getSession();
      if (session && session.userId) return session.userId;
      let id = localStorage.getItem(USER_KEY);
      if (!id) {
        id = 'browser-' + crypto.randomUUID();
        localStorage.setItem(USER_KEY, id);
      }
      return id;
    } catch (_) {
      return 'browser-session';
    }
  };

  async function request(path, body, method) {
    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch('/api' + path, {
      method: method || 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: body == null ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
    if (!response.ok) throw new Error((data && data.error) || 'تعذّر الاتصال بالخادم');
    return data;
  }

  const safe = (promise) => promise.catch((err) => {
    window.dispatchEvent(new CustomEvent('nasaq:cloud-error', { detail: err.message }));
    return null;
  });

  async function syncUser(data) {
    return request('/store/users/upsert', Object.assign({
      externalId: getUserId(), role: 'customer', name: 'عميل نَسَق'
    }, data || {}));
  }

  async function uploadImage(dataUrl, filename) {
    if (!/^data:image\//.test(dataUrl || '')) return dataUrl;
    const out = await request('/store/uploads', { dataUrl, filename: filename || 'product-image' });
    return out && (out.publicUrl || out.proxyUrl) || dataUrl;
  }

  async function syncProduct(p) {
    const photos = [];
    for (let i = 0; i < (p.photos || []).length; i++) {
      photos.push(await uploadImage(p.photos[i], 'product-' + (p.id || 'new') + '-' + i));
    }
    return request('/store/products/upsert', {
      legacyId: Number.isFinite(Number(p.id)) ? Number(p.id) : null,
      storeId: p.storeId || null,
      sellerExternalId: p.sellerId || (p.seller && p.seller.id) || null,
      name: p.name || '',
      slug: p.slug || null,
      category: p.category || 'clothes',
      price: Number(p.price || 0),
      oldPrice: p.oldPrice == null ? null : Number(p.oldPrice),
      stock: Number(p.stock || 0),
      status: p.status || 'active',
      sku: p.sku || null,
      description: p.description || null,
      details: Array.isArray(p.details) ? p.details : [],
      sizes: Array.isArray(p.sizes) ? p.sizes : [],
      colors: Array.isArray(p.colors) ? p.colors : [],
      photos
    });
  }

  async function syncOrder(order, source) {
    const customer = (order && order.customer) || {};
    /* مزامنة ملف العميل فقط لو مسجّل دخول فعلاً؛ عميل زائر (بدون حساب) لا يملك
       جلسة Supabase حقيقية فتفشل RLS هنا — وتفشل معها مزامنة الطلب كله لو لم
       نتجاهل الخطأ، فيختفي الطلب عن البائع والمندوب والإدارة رغم دفعه فعلياً. */
    if (getSession()) {
      try {
        await syncUser({
          email: customer.email || null,
          name: customer.name || 'عميل نَسَق',
          phone: customer.phone || null,
          role: 'customer'
        });
      } catch (_) { /* لا نمنع حفظ الطلب بسبب فشل تحديث الملف الشخصي فقط */ }
    }
    return request('/store/orders', {
      orderNumber: order.id,
      customerExternalId: getUserId(),
      customer,
      shipping: Number(order.shipping || 0),
      discount: Number(order.discount || 0),
      total: Number(order.total || 0),
      payment: order.payment || (source && source.pay) || 'cod',
      method: order.method || (source && source.method) || 'standard',
      lines: (order.lines || []).map(function (line) {
        return {
          productId: line.productId || null,
          productUuid: line.productUuid || null,
          productName: line.name || line.productName || '',
          quantity: Number(line.qty || line.quantity || 1),
          unitPrice: Number(line.price || line.unitPrice || 0),
          size: line.size || null,
          color: line.color || null,
          sellerExternalId: line.sellerId || line.sellerExternalId || null
        };
      })
    });
  }

  async function syncStore(s) {
    if (!s) return null;
    await syncUser({ externalId: s.id, name: s.name, email: s.email, phone: s.phone, role: 'seller' });
    const logo = s.logo ? await uploadImage(s.logo, 'store-logo-' + s.slug) : null;
    return request('/store/stores/upsert', {
      ownerExternalId: s.id,
      name: s.name,
      slug: s.slug,
      category: s.category || null,
      phone: s.phone || null,
      email: s.email || null,
      description: s.description || null,
      logoUrl: logo,
      address: s.address || {}
    });
  }

  async function submitApplication(data) {
    return request('/store/applications', data);
  }

  /* تسجيل حساب جديد عبر Supabase Auth (بريد + كلمة مرور)، يُستخدم كخطوة أولى
     قبل تقديم طلب بائع أو مندوب، حتى يكون لصاحب الطلب حساب دخول فوراً. */
  async function signup(fields) {
    const out = await request('/auth/signup', fields);
    if (out) window.NasaqCloud.saveSession(out);
    return out;
  }

  async function sellerApplication(data) {
    const out = await request('/store/seller-application', data);
    if (out && out.access_token) window.NasaqCloud.saveSession(out);
    return out;
  }

  async function riderApplication(data) {
    const out = await request('/store/rider-application', data);
    if (out && out.access_token) window.NasaqCloud.saveSession(out);
    return out;
  }

  async function applicationStatus() {
    return request('/store/application-status', null, 'GET');
  }

  async function submitSupport(data) {
    return request('/store/support', data);
  }

  window.NasaqCloud = {
    getUserId, request,
    getSession,
    saveSession(data) {
      if (!data) return;
      try {
        if (data.access_token) localStorage.setItem(TOKEN_KEY, data.access_token);
        if (data.user) localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
        if (data.user && data.user.userId) localStorage.setItem(USER_KEY, data.user.userId);
      } catch (_) { /* التخزين غير متاح */ }
    },
    clearSession() {
      try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SESSION_KEY); } catch (_) { /* تجاهل */ }
    },
    token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; } },
    syncUser: (data) => safe(syncUser(data)),
    syncProduct: (p) => safe(syncProduct(p)),
    syncOrder: (o, source) => safe(syncOrder(o, source)),
    syncStore: (s) => safe(syncStore(s)),
    submitApplication: (data) => safe(submitApplication(data)),
    submitSupport: (data) => safe(submitSupport(data)),
    /* هذه الثلاثة لا تُغلَّف بـ safe() عمداً: الصفحة التي تستدعيها تحتاج أن
       تعرض رسالة الخطأ نفسها للمستخدم (مثلاً بريد مسجَّل من قبل). */
    signup: (fields) => signup(fields),
    sellerApplication: (data) => sellerApplication(data),
    riderApplication: (data) => riderApplication(data),
    applicationStatus: () => applicationStatus(),
    uploadImage: (dataUrl, filename) => safe(uploadImage(dataUrl, filename))
  };
})();