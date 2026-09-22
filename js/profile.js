(function () {
  'use strict';
  const root = document.getElementById('profile-root');
  if (!root) return;
  const esc = (value) => {
    const node = document.createElement('span');
    node.textContent = String(value == null ? '' : value);
    return node.innerHTML;
  };
  const roleNames = { customer: 'عميل', seller: 'بائع شريك', rider: 'مندوب توصيل', admin: 'مشرف نَسَق' };
  const roleCopy = {
    seller: ['لوحة البائع', 'أدر متجرك ومنتجاتك وطلباتك', 'seller.html'],
    rider: ['لوحة المندوب', 'تابع التوصيلات والأرباح اليومية', 'rider.html'],
    admin: ['لوحة الإدارة', 'شغّل السوق وتابع الدعم والطلبات', 'admin.html'],
    customer: ['ابدأ البيع معنا', 'حوّل منتجاتك إلى متجر على نَسَق', 'become-seller.html']
  };
  function readSession() {
    try { return JSON.parse(localStorage.getItem('nasaq_session_v1') || 'null'); } catch (_) { return null; }
  }
  function roleLink(account) {
    const item = roleCopy[account.role] || roleCopy.customer;
    return '<a class="profile-role-link" href="' + item[2] + '"><span><strong>' + item[0] + '</strong><br><small>' + item[1] + '</small></span><span aria-hidden="true">←</span></a>';
  }
  function render(account) {
    if (!account) {
      root.innerHTML = '<section class="profile-card profile-login-card"><h1>حسابك في نَسَق</h1><p class="profile-card__sub">سجّل الدخول لمتابعة طلباتك ومفضلاتك وإدارة مساحتك.</p><a class="btn btn--accent btn--lg" href="auth.html">تسجيل الدخول</a><a class="btn btn--ghost btn--lg" href="auth.html?tab=signup">إنشاء حساب</a></section>';
      return;
    }
    const name = account.name || (account.email || '').split('@')[0] || 'عميل نَسَق';
    const initials = name.trim().slice(0, 1);
    const orders = window.Market && window.Market.orders ? window.Market.orders.list().filter((order) => !account.email || !order.customer || order.customer.email === account.email).slice(0, 5) : [];
    const orderMarkup = orders.length ? '<div class="profile-order-list">' + orders.map((order) => '<div class="profile-order"><span><strong dir="ltr">' + esc(order.number || order.id) + '</strong><small>' + esc(order.customer && order.customer.name || 'طلب نَسَق') + '</small></span><span><strong>' + esc(window.Store ? window.Store.money(order.totals && order.totals.total || order.total || 0) : '') + '</strong><small>' + esc(order.status || 'قيد المعالجة') + '</small></span></div>').join('') + '</div>' : '<div class="profile-orders__empty">لا توجد طلبات محفوظة بعد. <a href="shop.html">تصفّح المنتجات</a></div>';
    root.innerHTML = '<section class="profile-hero"><div class="profile-identity"><div class="profile-avatar" aria-hidden="true">' + esc(initials) + '</div><div><p class="profile-kicker">مرحباً بك في نَسَق</p><h1>' + esc(name) + '</h1><p class="profile-email">' + esc(account.email || '') + '</p></div></div><span class="profile-role">' + esc(roleNames[account.role] || roleNames.customer) + '</span></section>' +
      '<div class="profile-grid"><section class="profile-card"><h2>بيانات الحساب</h2><p class="profile-card__sub">عدّل بياناتك وستظهر في حسابك وكل طلباتك القادمة.</p><form class="profile-form" data-profile-form><div class="profile-fields"><div class="field"><label for="profile-name">الاسم</label><input class="input" id="profile-name" name="name" value="' + esc(name) + '" autocomplete="name" required></div><div class="field"><label for="profile-phone">رقم الهاتف</label><input class="input" id="profile-phone" name="phone" value="' + esc(account.phone || '') + '" autocomplete="tel" dir="ltr" required></div><div class="field"><label for="profile-email">البريد الإلكتروني</label><input class="input" id="profile-email" value="' + esc(account.email || '') + '" dir="ltr" readonly></div></div><p class="profile-form__message" data-profile-message role="status"></p><div class="profile-actions"><button class="btn btn--primary" type="submit">حفظ البيانات</button><a class="btn btn--ghost" href="shop.html?wishlist=1">المفضلة</a><a class="btn btn--ghost" href="cart.html">سلة التسوق</a><button class="btn btn--quiet" type="button" data-profile-logout>تسجيل الخروج</button></div></form></section>' +
      '<section class="profile-card"><h2>مساحتك في نَسَق</h2><p class="profile-card__sub">الوصول السريع للأدوات المناسبة لدورك.</p><div class="profile-role-nav">' + roleLink(account) + (account.role === 'customer' ? '<a class="profile-role-link" href="become-rider.html"><span><strong>انضم كمندوب توصيل</strong><br><small>قدّم طلبك وابدأ رحلتك مع نَسَق</small></span><span aria-hidden="true">←</span></a>' : '') + '</div></section>' +
      '<section class="profile-card profile-orders"><h2>طلباتك</h2><p class="profile-card__sub">آخر الطلبات المرتبطة بحسابك.</p>' + orderMarkup + '</section></div>';
    const form = root.querySelector('[data-profile-form]');
    if (form) form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const message = form.querySelector('[data-profile-message]');
      button.disabled = true;
      message.textContent = 'جارٍ حفظ البيانات…';
      try {
        const response = await window.NasaqCloud.request('/store/profile', {
          name: form.elements.name.value,
          phone: form.elements.phone.value
        }, 'PATCH');
        const next = Object.assign({}, account, response.profile || {});
        localStorage.setItem('nasaq_session_v1', JSON.stringify(next));
        render(next);
        const nextMessage = root.querySelector('[data-profile-message]');
        if (nextMessage) nextMessage.textContent = 'تم حفظ بياناتك بنجاح.';
      } catch (error) {
        message.textContent = error.message || 'تعذّر حفظ البيانات.';
        button.disabled = false;
      }
    });
    const logout = root.querySelector('[data-profile-logout]');
    if (logout) logout.addEventListener('click', () => {
      const done = () => { if (window.NasaqCloud) window.NasaqCloud.clearSession(); location.href = 'index.html'; };
      if (window.NasaqCloud) window.NasaqCloud.request('/auth/logout', null, 'POST').then(done).catch(done); else done();
    });
  }
  async function boot() {
    let account = readSession();
    try {
      if (window.NasaqCloud && account) {
        const response = await window.NasaqCloud.request('/store/profile', null, 'GET');
        if (response && response.profile) {
          account = Object.assign({}, account, response.profile, { userId: account.userId, email: account.email || response.profile.email });
          localStorage.setItem('nasaq_session_v1', JSON.stringify(account));
        }
      }
    } catch (_) {
      /* الصفحة تظل مفيدة بالجلسة المحلية إذا تعذر الاتصال مؤقتاً */
    }
    render(account);
  }
  boot();
})();