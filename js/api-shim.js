/* ==========================================================================
   js/api-shim.js — يحلّ محل سيرفر الـ Node/Express القديم بالكامل.

   كل ملفات الموقع (cloud.js, admin.js, rider.js, rider-gate.js,
   seller-gate.js, onboarding.js...) كانت أصلاً تتكلم مع الباك إند عبر
   fetch('/api' + path, ...). هذا الملف "يعترض" أي طلب زي ده على مستوى
   المتصفح، وينفّذه مباشرة ضد Supabase (تسجيل دخول حقيقي، جداول، دوال RPC،
   تخزين الصور) — من غير ما يحتاج أي كود تاني في الموقع يتغيّر.

   لازم يتحمّل هذا الملف بعد مكتبة supabase-js وبعد js/nasaq-config.js،
   وقبل أي سكربت تاني بيستخدم fetch('/api...').
   ========================================================================== */
(function () {
  'use strict';

  const realFetch = window.fetch.bind(window);

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[nasaq] مكتبة supabase-js لم تُحمَّل — تأكد من الاتصال بالإنترنت.');
    return;
  }

  const sb = window.supabase.createClient(window.NASAQ_SUPABASE_URL, window.NASAQ_SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  window.sb = sb;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

  function jsonResponse(body, status) {
    return new Response(body == null ? null : JSON.stringify(body), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  function okRes(body, status) { return jsonResponse(body, status || 200); }
  function errRes(message, status) { return jsonResponse({ error: message }, status || 400); }

  function translateAuthError(error) {
    const msg = (error && error.message) || '';
    if (/already registered|already exists/i.test(msg)) return 'هذا البريد الإلكتروني مسجَّل من قبل.';
    if (/invalid login credentials/i.test(msg)) return 'بيانات الدخول غير صحيحة.';
    if (/password should be at least/i.test(msg)) return 'كلمة المرور قصيرة جدًا (٦ أحرف على الأقل).';
    if (/rate limit/i.test(msg)) return 'محاولات كثيرة، حاول بعد قليل.';
    return msg || 'حدث خطأ غير متوقع.';
  }

  async function dataUrlToBlob(dataUrl) {
    const res = await realFetch(dataUrl);
    return res.blob();
  }

  /* ---------- الجلسة / الدور الحالي ---------- */
  async function getRole(userId) {
    const { data: adminRow } = await sb.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
    if (adminRow) return 'admin';
    const { data: mu } = await sb.from('marketplace_users').select('role').eq('external_id', userId).maybeSingle();
    return (mu && mu.role) || 'customer';
  }

  async function currentSession() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const role = await getRole(user.id);
    const { data: profile } = await sb.from('marketplace_users').select('name,phone').eq('external_id', user.id).maybeSingle();
    return {
      userId: user.id,
      email: user.email,
      role,
      name: (profile && profile.name) || (user.user_metadata && user.user_metadata.name),
      phone: (profile && profile.phone) || (user.user_metadata && user.user_metadata.phone) || null
    };
  }

  function persistLocal(accessToken, sessionUser) {
    try {
      if (accessToken) localStorage.setItem('nasaq_access_token_v1', accessToken);
      if (sessionUser) {
        localStorage.setItem('nasaq_session_v1', JSON.stringify(sessionUser));
        localStorage.setItem('nasaq_cloud_user_v1', sessionUser.userId);
      }
    } catch (_) { /* التخزين غير متاح */ }
  }

  async function syncMarketplaceUser(user, role, extra) {
    extra = extra || {};
    const row = {
      external_id: user.id,
      email: user.email || null,
      name: extra.name || (user.user_metadata && user.user_metadata.name) || (user.email ? user.email.split('@')[0] : 'عميل نَسَق'),
      phone: extra.phone || (user.user_metadata && user.user_metadata.phone) || null,
      role: role || 'customer'
    };
    const { error } = await sb.from('marketplace_users').upsert(row, { onConflict: 'external_id' });
    if (error) throw new Error(error.message);
    return row;
  }

  function requestId() {
    return 'NSQ-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
  }

  /* ---------- الموجّه (router) ---------- */
  const routes = [];
  function on(method, parts, handler) { routes.push({ method, parts: parts.split('/').filter(Boolean), handler }); }

  function matchRoute(method, pathname) {
    const segs = pathname.split('/').filter(Boolean);
    for (const r of routes) {
      if (r.method !== method || r.parts.length !== segs.length) continue;
      const params = {};
      let matched = true;
      for (let i = 0; i < r.parts.length; i++) {
        const p = r.parts[i];
        if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segs[i]);
        else if (p !== segs[i]) { matched = false; break; }
      }
      if (matched) return { handler: r.handler, params };
    }
    return null;
  }

  /* ===================== AUTH ===================== */
  on('POST', 'auth/signup', async (params, query, body) => {
    const { email, password, name, phone } = body || {};
    if (!email || !password || !name || !phone) return errRes('أكمل الاسم والبريد والهاتف وكلمة المرور.');
    const { data, error } = await sb.auth.signUp({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      options: { data: { name: String(name).trim(), phone: String(phone).trim() } }
    });
    if (error) return errRes(translateAuthError(error), 400);
    if (!data.user) return errRes('تعذّر إنشاء الحساب.');
    if (!data.session) {
      /* تأكيد البريد الإلكتروني مفعّل في إعدادات المشروع. Supabase عن قصد
         لا يفرّق في الرد بين "بريد جديد" و"بريد مسجَّل من قبل" (حماية من
         تخمين البريدات المسجَّلة) — لكن نقدر نكتشف الحالة الثانية: لو الحساب
         موجود مسبقاً، data.user.identities بتيجي فاضية []. */
      const alreadyExists = Array.isArray(data.user.identities) && data.user.identities.length === 0;
      if (alreadyExists) return errRes('هذا البريد الإلكتروني مسجَّل بحساب من قبل. سجّل الدخول بدلاً من إنشاء حساب جديد.', 400);
      return errRes('تم إنشاء الحساب. الرجاء تأكيد بريدك الإلكتروني من الرسالة المُرسلة إليك قبل تسجيل الدخول.', 400);
    }
    await syncMarketplaceUser(data.user, 'customer', { name, phone });
    const sessionUser = { userId: data.user.id, email: data.user.email, role: 'customer', name: String(name).trim() };
    persistLocal(data.session.access_token, sessionUser);
    return okRes({ access_token: data.session.access_token, user: sessionUser }, 201);
  });

  on('POST', 'auth/login', async (params, query, body) => {
    const { identifier, password } = body || {};
    if (!identifier || !password) return errRes('أدخل بيانات الدخول.');
    let email = String(identifier).trim();
    if (!email.includes('@')) {
      const { data } = await sb.from('marketplace_users').select('email').eq('phone', email).limit(1).maybeSingle();
      if (!data || !data.email) return errRes('لم نعثر على حساب بهذا البريد أو رقم الهاتف.', 401);
      email = data.email;
    }
    const { data, error } = await sb.auth.signInWithPassword({ email: email.toLowerCase(), password: String(password) });
    if (error || !data.user || !data.session) return errRes('بيانات الدخول غير صحيحة.', 401);
    const role = await getRole(data.user.id);
    await syncMarketplaceUser(data.user, role);
    const sessionUser = { userId: data.user.id, email: data.user.email, role, name: data.user.user_metadata && data.user.user_metadata.name };
    persistLocal(data.session.access_token, sessionUser);
    return okRes({ access_token: data.session.access_token, user: sessionUser });
  });

  on('GET', 'auth/session', async () => {
    const session = await currentSession();
    if (!session) return errRes('لا توجد جلسة دخول.', 401);
    return okRes({ user: session });
  });

  on('POST', 'auth/logout', async () => {
    await sb.auth.signOut();
    try {
      localStorage.removeItem('nasaq_access_token_v1');
      localStorage.removeItem('nasaq_session_v1');
      localStorage.removeItem('nasaq_admin_access_token_v1');
    } catch (_) { /* تجاهل */ }
    return new Response(null, { status: 204 });
  });

  /* ===================== STORE (عام) ===================== */
  on('GET', 'store/profile', async () => {
    const session = await currentSession();
    if (!session) return errRes('سجّل الدخول أولاً.', 401);
    const { data, error } = await sb.from('marketplace_users').select('external_id,email,name,phone,role,created_at').eq('external_id', session.userId).maybeSingle();
    if (error) return errRes(error.message, 400);
    const profile = data || {
      external_id: session.userId,
      email: session.email || null,
      name: session.name || 'عميل نَسَق',
      phone: session.phone || null,
      role: session.role
    };
    return okRes({ profile });
  });

  on('PATCH', 'store/profile', async (params, query, body) => {
    const session = await currentSession();
    if (!session) return errRes('سجّل الدخول أولاً.', 401);
    body = body || {};
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    if (name.length < 2) return errRes('اكتب الاسم بالكامل.');
    if (phone.length < 3) return errRes('اكتب رقم هاتف صحيحاً.');
    const { data, error } = await sb.from('marketplace_users').upsert({
      external_id: session.userId,
      email: session.email || null,
      name,
      phone,
      role: session.role
    }, { onConflict: 'external_id' }).select('external_id,email,name,phone,role,created_at').maybeSingle();
    if (error) return errRes(error.message, 400);
    await sb.auth.updateUser({ data: { name, phone } });
    return okRes({ profile: data || { external_id: session.userId, email: session.email, name, phone, role: session.role } });
  });

  on('GET', 'store/orders/mine', async () => {
    const session = await currentSession();
    if (!session) return errRes('سجّل الدخول أولاً.', 401);
    const { data, error } = await sb.from('orders').select('*,order_items(*)').eq('customer_external_id', session.userId).order('created_at', { ascending: false }).limit(50);
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('POST', 'store/users/upsert', async (params, query, body) => {
    body = body || {};
    const session = await currentSession();
    const externalId = session ? session.userId : (body.externalId || ('browser-' + crypto.randomUUID()));
    const row = {
      external_id: externalId,
      email: body.email || null,
      name: body.name || 'عميل نَسَق',
      phone: body.phone || null,
      role: ['customer', 'seller', 'rider'].includes(body.role) ? body.role : 'customer'
    };
    const { data, error } = await sb.from('marketplace_users').upsert(row, { onConflict: 'external_id' }).select().maybeSingle();
    if (error) return errRes(session ? error.message : 'سجّل الدخول أولاً.', 400);
    return okRes(data || row);
  });

  on('POST', 'store/products/upsert', async (params, query, body) => {
    body = body || {};
    const row = {
      legacy_id: Number.isFinite(Number(body.legacyId)) ? Number(body.legacyId) : null,
      store_id: isUuid(body.storeId) ? body.storeId : null,
      seller_external_id: body.sellerExternalId || null,
      name: body.name || '',
      slug: body.slug || null,
      category: body.category || 'clothes',
      price: Number(body.price || 0),
      old_price: body.oldPrice == null ? null : Number(body.oldPrice),
      stock: Math.max(0, Number(body.stock || 0)),
      status: ['draft', 'active', 'archived'].includes(body.status) ? body.status : 'active',
      sku: body.sku || null,
      description: body.description || null,
      details: Array.isArray(body.details) ? body.details : [],
      sizes: Array.isArray(body.sizes) ? body.sizes : [],
      colors: Array.isArray(body.colors) ? body.colors : [],
      photos: Array.isArray(body.photos) ? body.photos : []
    };
    let query_ = sb.from('products');
    let res;
    if (row.legacy_id != null) {
      res = await query_.upsert(row, { onConflict: 'legacy_id' }).select().maybeSingle();
    } else {
      res = await query_.insert(row).select().maybeSingle();
    }
    if (res.error) return errRes(res.error.message, 400);
    return okRes(res.data || row);
  });

  on('POST', 'store/stores/upsert', async (params, query, body) => {
    body = body || {};
    const session = await currentSession();
    const row = {
      owner_external_id: body.ownerExternalId || (session && session.userId),
      name: body.name || '',
      slug: body.slug || ('store-' + crypto.randomUUID().slice(0, 8)),
      category: body.category || null,
      phone: body.phone || null,
      email: body.email || null,
      description: body.description || null,
      logo_url: body.logoUrl || null,
      address: body.address || {}
    };
    if (!row.owner_external_id) return errRes('سجّل الدخول أولاً.', 401);
    const { data, error } = await sb.from('stores').upsert(row, { onConflict: 'slug' }).select().maybeSingle();
    if (error) return errRes(error.message, 400);
    return okRes(data || row);
  });

  on('POST', 'store/orders', async (params, query, body) => {
    body = body || {};
    const session = await currentSession();
    const customerExternalId = session ? session.userId : (body.customerExternalId || ('browser-' + crypto.randomUUID()));
    if (session) {
      await syncMarketplaceUser({ id: session.userId, email: body.customer && body.customer.email, user_metadata: {} },
        'customer', { name: (body.customer && body.customer.name) || session.name, phone: body.customer && body.customer.phone });
    }
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const p = {
      order_number: body.orderNumber || undefined,
      customer_external_id: session ? undefined : customerExternalId,
      customer: body.customer || {},
      shipping: Number(body.shipping || 0),
      discount: Number(body.discount || 0),
      payment: body.payment || 'cod',
      method: body.method || 'standard',
      lines: lines.map((line) => ({
        legacy_product_id: Number.isFinite(Number(line.productId)) ? Number(line.productId) : null,
        product_name: line.productName || line.name || '',
        quantity: Math.max(1, Number(line.qty || line.quantity || 1)),
        unit_price: Math.max(0, Number(line.price || line.unitPrice || 0)),
        size: line.size || null,
        color: line.color || null
      }))
    };
    const { data: result, error } = await sb.rpc('create_marketplace_order', { p });
    if (error) return errRes(error.message || 'تعذّر حفظ الطلب.', 400);
    const { data: saved } = await sb.from('orders').select('*,order_items(*)').eq('id', result.id).maybeSingle();
    return okRes(saved || result, 201);
  });

  /* ---------- صور طلبات التقديم (bucket خاص: application-documents) ---------- */
  const DOC_KINDS = ['idPhoto', 'personalPhoto', 'storefrontPhoto', 'licensePhoto'];
  const DOC_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  on('POST', 'store/application-uploads', async (params, query, body) => {
    const session = await currentSession();
    if (!session) return errRes('أنشئ حسابك أولاً قبل رفع الصور.', 401);
    body = body || {};
    if (!DOC_KINDS.includes(body.kind)) return errRes('نوع المستند غير معروف.');
    const match = typeof body.dataUrl === 'string' && /^data:(image\/(?:jpeg|png|webp));base64,/.exec(body.dataUrl);
    if (!match) return errRes('صيغة الصورة غير مدعومة (JPG أو PNG أو WEBP).');
    const blob = await dataUrlToBlob(body.dataUrl);
    if (blob.size > 5 * 1024 * 1024) return errRes('حجم الصورة أكبر من 5 ميجابايت.', 413);
    const path = session.userId + '/' + body.kind + '-' + crypto.randomUUID() + '.' + DOC_EXT[match[1]];
    const { error } = await sb.storage.from('application-documents').upload(path, blob, { contentType: match[1], upsert: false });
    if (error) return errRes('تعذّر رفع الصورة: ' + error.message, 400);
    return okRes({ path }, 201);
  });

  /* يقبل فقط مسارات داخل مجلد المستخدم نفسه ومن الأنواع المعروفة */
  function cleanDocuments(documents, userId) {
    const out = {};
    if (!documents || typeof documents !== 'object') return out;
    DOC_KINDS.forEach((k) => {
      const v = documents[k];
      if (typeof v === 'string' && v.startsWith(userId + '/') && !v.includes('..')) out[k] = v;
    });
    return out;
  }

  on('POST', 'store/seller-application', async (params, query, body) => {
    const session = await currentSession();
    if (!session) return errRes('أنشئ حسابك أولاً قبل تقديم طلب المتجر.', 401);
    body = body || {};
    if (!body.storeName || !body.phone || !body.address) return errRes('أكمل اسم المتجر ورقم الهاتف والعنوان.');
    await sb.from('marketplace_users').upsert({ external_id: session.userId, role: 'seller' }, { onConflict: 'external_id' });
    const slugBase = String(body.storeName).trim().toLowerCase().replace(/[^a-z0-9أ-ي\s-]/gi, '').replace(/\s+/g, '-').slice(0, 40) || 'store';
    const storeRow = {
      owner_external_id: session.userId,
      name: String(body.storeName).trim(),
      slug: slugBase + '-' + session.userId.slice(-6),
      category: body.category || null,
      phone: String(body.phone).trim(),
      email: session.email,
      description: body.description || null,
      logo_url: body.logoUrl || null,
      address: typeof body.address === 'string' ? { raw: body.address } : (body.address || {})
    };
    const { data: store, error: storeErr } = await sb.from('stores').upsert(storeRow, { onConflict: 'owner_external_id' }).select().maybeSingle();
    if (storeErr || !store) return errRes((storeErr && storeErr.message) || 'تعذّر إنشاء المتجر.', 400);
    const appRow = {
      request_id: requestId(),
      account_type: 'seller',
      name: body.ownerName || session.name || '',
      phone: String(body.phone).trim(),
      email: session.email,
      status: 'pending',
      user_external_id: session.userId,
      store_id: store.id,
      payload: Object.assign({ nationalId: body.nationalId || null, license: body.license || null }, cleanDocuments(body.documents, session.userId))
    };
    const { data: application } = await sb.from('applications').insert(appRow).select().maybeSingle();
    const newUser = Object.assign({}, session, { role: 'seller' });
    persistLocal(null, newUser);
    return okRes({ store, application, access_token: localStorage.getItem('nasaq_access_token_v1'), user: newUser }, 201);
  });

  on('POST', 'store/rider-application', async (params, query, body) => {
    const session = await currentSession();
    if (!session) return errRes('أنشئ حسابك أولاً قبل تقديم طلب الانضمام.', 401);
    body = body || {};
    if (!body.name || !body.phone) return errRes('أكمل الاسم ورقم الهاتف.');
    await sb.from('marketplace_users').upsert({ external_id: session.userId, role: 'rider' }, { onConflict: 'external_id' });
    const riderRow = {
      user_external_id: session.userId,
      name: String(body.name).trim(),
      phone: String(body.phone).trim(),
      national_id: body.nationalId || null,
      vehicle: ['motorbike', 'scooter', 'car', 'bike'].includes(body.vehicle) ? body.vehicle : 'motorbike',
      city: body.city || null,
      area: body.area || null,
      coverage: body.coverage || null
    };
    const { data: rider, error: riderErr } = await sb.from('riders').upsert(riderRow, { onConflict: 'user_external_id' }).select().maybeSingle();
    if (riderErr || !rider) return errRes((riderErr && riderErr.message) || 'تعذّر إنشاء حساب المندوب.', 400);
    const appRow = {
      request_id: requestId(),
      account_type: 'rider',
      name: String(body.name).trim(),
      phone: String(body.phone).trim(),
      email: session.email,
      status: 'pending',
      user_external_id: session.userId,
      rider_id: rider.id,
      payload: cleanDocuments(body.documents, session.userId)
    };
    const { data: application } = await sb.from('applications').insert(appRow).select().maybeSingle();
    const newUser = Object.assign({}, session, { role: 'rider' });
    persistLocal(null, newUser);
    return okRes({ rider, application, access_token: localStorage.getItem('nasaq_access_token_v1'), user: newUser }, 201);
  });

  on('GET', 'store/application-status', async () => {
    const session = await currentSession();
    if (!session) return errRes('لا توجد جلسة دخول.', 401);
    const { data } = await sb.from('applications').select('*').eq('user_external_id', session.userId).order('submitted_at', { ascending: false }).limit(1);
    return okRes({ application: (data && data[0]) || null });
  });

  on('POST', 'store/applications', async (params, query, body) => {
    body = body || {};
    const session = await currentSession();
    const row = {
      request_id: body.requestId || ('NSQ-' + Date.now()),
      account_type: body.accountType || 'seller',
      name: body.name || '',
      phone: body.phone || null,
      email: body.email || null,
      status: 'pending',
      user_external_id: session ? session.userId : null
    };
    const { data, error } = await sb.from('applications').upsert(row, { onConflict: 'request_id' }).select().maybeSingle();
    if (error) return errRes(error.message, 400);
    return okRes(data || row, 201);
  });

  on('POST', 'store/support', async (params, query, body) => {
    body = body || {};
    const session = await currentSession();
    const row = {
      ticket_number: body.ticketNumber || ('SUP-' + Date.now().toString(36).toUpperCase()),
      user_external_id: (session && session.userId) || body.userExternalId || null,
      email: body.email || null,
      name: body.name || null,
      subject: body.subject || 'استفسار من المتجر',
      message: body.message || '',
      priority: ['low', 'normal', 'high', 'urgent'].includes(body.priority) ? body.priority : 'normal',
      source: 'storefront'
    };
    const { data, error } = await sb.from('support_tickets').insert(row).select().maybeSingle();
    if (error) return errRes(error.message, 400);
    return okRes(data || row, 201);
  });

  on('POST', 'store/uploads', async (params, query, body) => {
    body = body || {};
    const { dataUrl, filename } = body;
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return errRes('ملف الصورة غير صالح.');
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(dataUrl);
    if (!match) return errRes('صيغة الصورة غير مدعومة.');
    const contentType = match[1];
    const blob = await dataUrlToBlob(dataUrl);
    if (blob.size > 5 * 1024 * 1024) return errRes('حجم الصورة أكبر من 5 ميجابايت.', 413);
    const safeName = String(filename || 'image').replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = new Date().toISOString().slice(0, 10) + '/' + crypto.randomUUID() + '-' + safeName;
    const { error } = await sb.storage.from('product-images').upload(path, blob, { contentType, upsert: true });
    if (error) return errRes('تعذّر رفع الصورة (سجّل الدخول أولاً): ' + error.message, 400);
    const { data } = sb.storage.from('product-images').getPublicUrl(path);
    return okRes({ publicUrl: data.publicUrl, proxyUrl: data.publicUrl }, 201);
  });

  /* ===================== ADMIN ===================== */
  async function requireAdmin() {
    const session = await currentSession();
    if (!session || session.role !== 'admin') return null;
    return session;
  }

  /* روابط موقَّعة مؤقتة (ساعة) لعرض صور طلبات التقديم للإدمن فقط */
  on('POST', 'admin/application-documents', async (params, query, body) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const paths = ((body && body.paths) || []).filter((p) => typeof p === 'string' && p && !p.includes('..')).slice(0, 10);
    if (!paths.length) return okRes({ urls: [] });
    const { data, error } = await sb.storage.from('application-documents').createSignedUrls(paths, 3600);
    if (error) return errRes(error.message, 400);
    return okRes({ urls: paths.map((p) => { const hit = (data || []).find((x) => x.path === p); return (hit && hit.signedUrl) || null; }) });
  });

  on('POST', 'admin/auth/login', async (params, query, body) => {
    body = body || {};
    const { data, error } = await sb.auth.signInWithPassword({ email: String(body.email || '').trim().toLowerCase(), password: String(body.password || '') });
    if (error || !data.user) return errRes('فشل دخول الإدمن.', 401);
    const role = await getRole(data.user.id);
    if (role !== 'admin') { await sb.auth.signOut(); return errRes('الحساب ليس حساب إدمن.', 403); }
    const sessionUser = { userId: data.user.id, email: data.user.email, role: 'admin', name: data.user.user_metadata && data.user.user_metadata.name };
    return okRes({ access_token: data.session.access_token, user: sessionUser });
  });

  on('GET', 'admin/session', async () => {
    const session = await requireAdmin();
    if (!session) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    return okRes({ user: { email: session.email, name: session.name, role: session.role } });
  });

  on('GET', 'admin/summary', async () => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data: overview, error } = await sb.rpc('admin_overview');
    if (error) return errRes(error.message, 400);
    return okRes({
      orders: overview.orders.total,
      openOrders: overview.orders.open,
      openTickets: overview.tickets_open,
      products: overview.products_active,
      revenue: overview.orders.revenue
    });
  });

  on('GET', 'admin/orders', async (params, query) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    let q = sb.from('orders').select('*,order_items(*)').order('created_at', { ascending: false }).limit(1000);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('GET', 'admin/support', async () => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data, error } = await sb.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(1000);
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('PATCH', 'admin/orders/:id/status', async (params, query, body) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const allowed = ['new', 'processing', 'shipped', 'completed', 'cancelled'];
    if (!allowed.includes(body && body.status)) return errRes('حالة الطلب غير صحيحة.');
    const { data, error } = await sb.from('orders').update({ status: body.status }).eq('id', params.id).select().maybeSingle();
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  on('GET', 'admin/overview', async () => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data, error } = await sb.rpc('admin_overview');
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  on('GET', 'admin/stores', async (params, query) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    let q = sb.from('stores').select('*').order('created_at', { ascending: false }).limit(500);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('GET', 'admin/riders', async (params, query) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    let q = sb.from('riders').select('*').order('created_at', { ascending: false }).limit(500);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('GET', 'admin/deliveries', async (params, query) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    let q = sb.from('deliveries').select('*,stores(name),riders(name,phone)').order('requested_at', { ascending: false }).limit(500);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('POST', 'admin/deliveries/:id/assign', async (params, query, body) => {
    const session = await requireAdmin();
    if (!session) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data, error } = await sb.rpc('admin_assign_delivery', { p_delivery: params.id, p_rider: (body && body.riderId) || null, p_admin: session.email });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  /* إعداد Radius الطلبات القريبة (متر) — الحد الأدنى 1 والأقصى 50000 (50 كم)، الافتراضي 5000 */
  on('GET', 'admin/settings/delivery-radius', async () => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data, error } = await sb.from('app_settings').select('value_num').eq('key', 'delivery_radius_m').maybeSingle();
    if (error) return errRes(error.message, 400);
    return okRes({ meters: data ? Number(data.value_num) : 5000 });
  });

  on('PUT', 'admin/settings/delivery-radius', async (params, query, body) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const meters = Number(body && body.meters);
    if (!isFinite(meters) || meters < 1 || meters > 50000) return errRes('النطاق يجب أن يكون بين 1 متر و50000 متر (50 كم).', 400);
    const { data, error } = await sb.rpc('admin_set_delivery_radius', { p_meters: meters });
    if (error) return errRes(error.message, 400);
    return okRes({ meters: Number(data) });
  });

  on('POST', 'admin/stores/:id/review', async (params, query, body) => {
    const session = await requireAdmin();
    if (!session) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const allowed = ['active', 'rejected', 'suspended'];
    if (!allowed.includes(body && body.status)) return errRes('حالة غير صحيحة.');
    const { data, error } = await sb.rpc('admin_review_entity', { p_kind: 'store', p_id: params.id, p_status: body.status, p_note: (body && body.note) || null, p_admin: session.email });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  on('POST', 'admin/riders/:id/review', async (params, query, body) => {
    const session = await requireAdmin();
    if (!session) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const allowed = ['active', 'rejected', 'suspended'];
    if (!allowed.includes(body && body.status)) return errRes('حالة غير صحيحة.');
    const { data, error } = await sb.rpc('admin_review_entity', { p_kind: 'rider', p_id: params.id, p_status: body.status, p_note: (body && body.note) || null, p_admin: session.email });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  on('PATCH', 'admin/support/:id/status', async (params, query, body) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const allowed = ['open', 'in_progress', 'resolved', 'closed'];
    if (!allowed.includes(body && body.status)) return errRes('حالة التذكرة غير صحيحة.');
    const { data, error } = await sb.from('support_tickets').update({ status: body.status }).eq('id', params.id).select().maybeSingle();
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  /* ---------- Admin Dashboard: طلبات التقديم (Applications) ---------- */
  on('GET', 'admin/applications', async (params, query) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    let q = sb.from('applications').select('*,stores(name,category,address,phone,logo_url),riders(name,vehicle,city,area,coverage)').order('submitted_at', { ascending: false }).limit(1000);
    if (query.status) q = q.eq('status', query.status);
    if (query.type) q = q.eq('account_type', query.type);
    const { data, error } = await q;
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('POST', 'admin/applications/:id/review', async (params, query, body) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const allowed = ['pending', 'approved', 'rejected'];
    if (!allowed.includes(body && body.status)) return errRes('حالة غير صحيحة.');
    if (body.status === 'rejected' && !(body.reason && String(body.reason).trim())) return errRes('اكتب سبب الرفض.');
    const { data, error } = await sb.rpc('admin_review_application', { p_id: params.id, p_status: body.status, p_reason: (body && body.reason) || null });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  /* ---------- Admin Dashboard: المستخدمون (Users) ---------- */
  on('GET', 'admin/users', async () => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data, error } = await sb.rpc('admin_users_overview');
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('GET', 'admin/users/:id', async (params) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data: profile, error } = await sb.from('marketplace_users').select('*').eq('external_id', params.id).maybeSingle();
    if (error) return errRes(error.message, 400);
    if (!profile) return errRes('المستخدم غير موجود.', 404);
    const { data: orders } = await sb.from('orders').select('*,order_items(*)').eq('customer_external_id', params.id).order('created_at', { ascending: false }).limit(100);
    const { data: transactions } = await sb.from('transactions').select('*').eq('customer_external_id', params.id).order('created_at', { ascending: false }).limit(100);
    return okRes({ profile, orders: orders || [], transactions: transactions || [] });
  });

  on('POST', 'admin/users/:id/status', async (params, query, body) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const allowed = ['active', 'disabled'];
    if (!allowed.includes(body && body.status)) return errRes('حالة غير صحيحة.');
    const { data, error } = await sb.rpc('admin_set_user_status', { p_external_id: params.id, p_status: body.status });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  on('POST', 'admin/users/:id/delete', async (params) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data, error } = await sb.rpc('admin_soft_delete_user', { p_external_id: params.id });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  /* ---------- Admin Dashboard: البائعون (Sellers, extended) ---------- */
  on('GET', 'admin/sellers', async () => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data, error } = await sb.rpc('admin_sellers_overview');
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('GET', 'admin/sellers/:id/earnings', async (params) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data, error } = await sb.rpc('admin_seller_earnings', { p_store: params.id });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  /* ---------- Admin Dashboard: السائقون (Riders, extended) ---------- */
  on('GET', 'admin/riders/:id/earnings', async (params) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data, error } = await sb.rpc('admin_rider_earnings', { p_rider: params.id });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  /* ---------- Admin Dashboard: المنتجات (Products) ---------- */
  on('GET', 'admin/products', async (params, query) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    let q = sb.from('products').select('*,stores(name,owner_external_id)').order('added_at', { ascending: false }).limit(1000);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('POST', 'admin/products/:id/review', async (params, query, body) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const allowed = ['active', 'rejected', 'hidden', 'pending', 'archived'];
    if (!allowed.includes(body && body.status)) return errRes('حالة غير صحيحة.');
    if (body.status === 'rejected' && !(body.reason && String(body.reason).trim())) return errRes('اكتب سبب الرفض.');
    const { data, error } = await sb.rpc('admin_review_product', { p_id: params.id, p_status: body.status, p_reason: (body && body.reason) || null });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  on('DELETE', 'admin/products/:id', async (params) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { error } = await sb.from('products').delete().eq('id', params.id);
    if (error) return errRes(error.message, 400);
    return new Response(null, { status: 204 });
  });

  /* ---------- Admin Dashboard: تفاصيل طلب (Order detail) ---------- */
  on('GET', 'admin/orders/:id', async (params) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data: order, error } = await sb.from('orders').select('*,order_items(*)').eq('id', params.id).maybeSingle();
    if (error) return errRes(error.message, 400);
    if (!order) return errRes('الطلب غير موجود.', 404);
    const { data: storeOrders } = await sb.from('store_orders').select('*,stores(name,phone)').eq('order_id', params.id);
    const { data: delivery } = await sb.from('deliveries').select('*,riders(name,phone)').eq('order_id', params.id).maybeSingle();
    const { data: transactions } = await sb.from('transactions').select('*').eq('order_id', params.id);
    return okRes({ order, storeOrders: storeOrders || [], delivery: delivery || null, transactions: transactions || [] });
  });

  /* ---------- Admin Dashboard: اللوحة المالية والمعاملات ---------- */
  on('GET', 'admin/financial-summary', async () => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    const { data, error } = await sb.rpc('admin_financial_summary');
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  on('GET', 'admin/transactions', async (params, query) => {
    if (!(await requireAdmin())) return errRes('هذه الصفحة مخصصة للإدمن.', 403);
    let q = sb.from('transactions').select('*,orders(order_number),stores(name),riders(name)').order('created_at', { ascending: false }).limit(1000);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  /* ===================== SELLER ===================== */
  async function requireSeller() {
    const session = await currentSession();
    if (!session || (session.role !== 'seller' && session.role !== 'admin')) return null;
    return session;
  }
  async function myStore(externalId) {
    const { data } = await sb.from('stores').select('*').eq('owner_external_id', externalId).limit(1).maybeSingle();
    return data || null;
  }

  on('GET', 'seller/me', async () => {
    const session = await requireSeller();
    if (!session) return errRes('هذه الصفحة مخصصة للبائعين.', 403);
    return okRes({ store: await myStore(session.userId) });
  });

  on('GET', 'seller/dashboard', async (params, query) => {
    const session = await requireSeller();
    if (!session) return errRes('هذه الصفحة مخصصة للبائعين.', 403);
    const store = await myStore(session.userId);
    if (!store) return errRes('لا يوجد متجر بعد.', 404);
    const year = Number.isFinite(Number(query.year)) ? Number(query.year) : new Date().getFullYear();
    const { data, error } = await sb.rpc('seller_dashboard', { p_store: store.id, p_year: year });
    if (error) return errRes(error.message, 400);
    return okRes({ store, dashboard: data });
  });

  on('GET', 'seller/products', async (params, query) => {
    const session = await requireSeller();
    if (!session) return errRes('هذه الصفحة مخصصة للبائعين.', 403);
    const store = await myStore(session.userId);
    if (!store) return okRes([]);
    let q = sb.from('products').select('*').eq('store_id', store.id).order('added_at', { ascending: false }).limit(500);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('GET', 'seller/orders', async (params, query) => {
    const session = await requireSeller();
    if (!session) return errRes('هذه الصفحة مخصصة للبائعين.', 403);
    const store = await myStore(session.userId);
    if (!store) return okRes([]);
    let q = sb.from('store_orders').select('*,orders(order_number,customer,payment,created_at),order_items(*)').eq('store_id', store.id).order('created_at', { ascending: false }).limit(500);
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('PATCH', 'seller/orders/:id/status', async (params, query, body) => {
    const session = await requireSeller();
    if (!session) return errRes('هذه الصفحة مخصصة للبائعين.', 403);
    const store = await myStore(session.userId);
    if (!store) return errRes('لا يوجد متجر بعد.', 404);
    const allowed = ['new', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
    if (!allowed.includes(body && body.status)) return errRes('حالة الطلب غير صحيحة.');
    const { data, error } = await sb.rpc('seller_set_order_status', { p_store: store.id, p_id: params.id, p_status: body.status });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  /* ===================== RIDER ===================== */
  async function requireRider() {
    const session = await currentSession();
    if (!session || (session.role !== 'rider' && session.role !== 'admin')) return null;
    return session;
  }
  async function myRider(externalId) {
    const { data } = await sb.from('riders').select('*').eq('user_external_id', externalId).limit(1).maybeSingle();
    return data || null;
  }

  on('GET', 'rider/me', async () => {
    const session = await requireRider();
    if (!session) return errRes('هذه الصفحة مخصصة لمناديب التوصيل.', 403);
    return okRes({ rider: await myRider(session.userId) });
  });

  on('PATCH', 'rider/online', async (params, query, body) => {
    const session = await requireRider();
    if (!session) return errRes('هذه الصفحة مخصصة لمناديب التوصيل.', 403);
    const rider = await myRider(session.userId);
    if (!rider) return errRes('لا يوجد حساب مندوب بعد.', 404);
    if (rider.status !== 'active') return errRes('حسابك قيد المراجعة، سيصلك إشعار عند التفعيل.', 403);
    const { data, error } = await sb.from('riders').update({ is_online: !!(body && body.online) }).eq('id', rider.id).select().maybeSingle();
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  /* تحديث موقع المندوب — يُقبل فقط لمندوب مفعّل وهو متصل (is_online = true) */
  on('PATCH', 'rider/location', async (params, query, body) => {
    const session = await requireRider();
    if (!session) return errRes('هذه الصفحة مخصصة لمناديب التوصيل.', 403);
    const lat = body && body.latitude, lng = body && body.longitude, acc = body && body.accuracy;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return errRes('إحداثيات الموقع غير صحيحة.', 400);
    }
    const { data, error } = await sb.from('riders').update({
      latitude: lat,
      longitude: lng,
      location_accuracy: (typeof acc === 'number' && isFinite(acc) && acc >= 0) ? acc : null,
      location_updated_at: new Date().toISOString()
    }).eq('user_external_id', session.userId).eq('status', 'active').eq('is_online', true).select('id').maybeSingle();
    if (error) return errRes(error.message, 400);
    if (!data) return errRes('يجب أن تكون متصلاً لإرسال الموقع.', 409);
    return okRes({ ok: true });
  });

  on('GET', 'rider/dashboard', async () => {
    const session = await requireRider();
    if (!session) return errRes('هذه الصفحة مخصصة لمناديب التوصيل.', 403);
    const rider = await myRider(session.userId);
    if (!rider) return errRes('لا يوجد حساب مندوب بعد.', 404);
    const { data, error } = await sb.rpc('rider_dashboard', { p_rider: rider.id });
    if (error) return errRes(error.message, 400);
    return okRes({ rider, dashboard: data });
  });

  on('GET', 'rider/deliveries/available', async () => {
    const session = await requireRider();
    if (!session) return errRes('هذه الصفحة مخصصة لمناديب التوصيل.', 403);
    const rider = await myRider(session.userId);
    if (!rider || rider.status !== 'active') return okRes([]);
    const { data, error } = await sb.from('deliveries').select('*,stores(name,phone,address)').eq('status', 'unassigned').order('requested_at', { ascending: true }).limit(100);
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  /* الطلبات المتاحة + بيانات المتجر + قيمة الطلب + Radius الحالي (الفلترة بالمسافة تتم في rider.js بـ GPS السائق) */
  on('GET', 'rider/deliveries/nearby', async () => {
    const session = await requireRider();
    if (!session) return errRes('هذه الصفحة مخصصة لمناديب التوصيل.', 403);
    const { data, error } = await sb.rpc('rider_nearby_deliveries');
    if (error) return errRes(error.message, 400);
    return okRes(data || { radius_m: 5000, deliveries: [] });
  });

  on('GET', 'rider/deliveries/mine', async (params, query) => {
    const session = await requireRider();
    if (!session) return errRes('هذه الصفحة مخصصة لمناديب التوصيل.', 403);
    const rider = await myRider(session.userId);
    if (!rider) return okRes([]);
    let q = sb.from('deliveries').select('*,stores(name,phone,address)').eq('rider_id', rider.id).order('requested_at', { ascending: false }).limit(200);
    q = query.status ? q.eq('status', query.status) : q.in('status', ['assigned', 'picked_up', 'out_for_delivery']);
    const { data, error } = await q;
    if (error) return errRes(error.message, 400);
    return okRes(data || []);
  });

  on('POST', 'rider/deliveries/:id/:action', async (params, query, body) => {
    const session = await requireRider();
    if (!session) return errRes('هذه الصفحة مخصصة لمناديب التوصيل.', 403);
    const rider = await myRider(session.userId);
    if (!rider) return errRes('لا يوجد حساب مندوب بعد.', 404);
    const allowed = ['accept', 'release', 'pickup', 'out_for_delivery', 'deliver', 'fail'];
    if (!allowed.includes(params.action)) return errRes('إجراء غير معروف.');
    const { data, error } = await sb.rpc('rider_delivery_action', { p_rider: rider.id, p_delivery: params.id, p_action: params.action, p_note: (body && body.note) || null });
    if (error) return errRes(error.message, 400);
    return okRes(data);
  });

  /* ---------- اعتراض fetch('/api/...') ---------- */
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!url.startsWith('/api/')) return realFetch(input, init);

    const rest = url.slice('/api'.length);
    const [pathname, search] = rest.split('?');
    const query = {};
    if (search) new URLSearchParams(search).forEach((v, k) => { query[k] = v; });
    const method = ((init && init.method) || 'GET').toUpperCase();
    let body = null;
    if (init && init.body) {
      try { body = JSON.parse(init.body); } catch (_) { body = null; }
    }

    const match = matchRoute(method, pathname);
    if (!match) return errRes('مسار غير معروف: ' + method + ' ' + pathname, 404);

    try {
      return await match.handler(match.params, query, body);
    } catch (error) {
      console.error('[nasaq api-shim]', method, pathname, error);
      return errRes((error && error.message) || 'حدث خطأ غير متوقع.', 500);
    }
  };
})();
