/* Nasaq cloud sync.
   The storefront keeps its existing local UI state for instant interactions,
   while this bridge mirrors users, stores, products, orders, applications, and
   image URLs to the Supabase-backed API. */
(function () {
  'use strict';

  const USER_KEY = 'nasaq_cloud_user_v1';
  const getUserId = () => {
    try {
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
    const response = await fetch('/api' + path, {
      method: method || 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
    await syncUser({
      email: customer.email || null,
      name: customer.name || 'عميل نَسَق',
      phone: customer.phone || null,
      role: 'customer'
    });
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

  async function submitSupport(data) {
    return request('/store/support', data);
  }

  window.NasaqCloud = {
    getUserId, request,
    syncUser: (data) => safe(syncUser(data)),
    syncProduct: (p) => safe(syncProduct(p)),
    syncOrder: (o, source) => safe(syncOrder(o, source)),
    syncStore: (s) => safe(syncStore(s)),
    submitApplication: (data) => safe(submitApplication(data)),
    submitSupport: (data) => safe(submitSupport(data)),
    uploadImage: (dataUrl, filename) => safe(uploadImage(dataUrl, filename))
  };
})();