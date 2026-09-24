/* ==========================================================================
   js/store-page.js — صفحة المتجر العامة للبائع: store.html?s=slug
   المتجر ومنتجاته يُقرآن من Supabase مباشرة (متجر حقيقي مفعّل من الإدارة).
   ========================================================================== */
(function () {
  'use strict';
  const root = document.getElementById('store-root');
  if (!root) return;
  const esc = window.Store.esc;
  const slug = new URLSearchParams(location.search).get('s') || '';

  function sbGet(path) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', window.NASAQ_SUPABASE_URL + '/rest/v1/' + path, false);
      xhr.setRequestHeader('apikey', window.NASAQ_SUPABASE_ANON_KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + window.NASAQ_SUPABASE_ANON_KEY);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) return JSON.parse(xhr.responseText || '[]');
    } catch (_) { /* يظهر "لم نعثر على هذا المتجر" بدل كسر الصفحة */ }
    return [];
  }

  const rows = slug ? sbGet('stores?select=*&slug=eq.' + encodeURIComponent(slug) + '&status=eq.active&limit=1') : [];
  const s = rows[0] || null;

  if (!s) {
    root.innerHTML = UI.emptyHTML({ icon: 'store', title: 'لم نعثر على هذا المتجر', text: 'ربما تغيّر رابط المتجر أو لم يعد متاحاً.', actions: [{ label: 'تصفّح المتجر', href: 'shop.html', primary: true }] });
    return;
  }
  document.title = s.name + ' | ' + window.Store.config.name;
  const list = Products.all().filter((p) => p.storeId === s.id);
  const a = s.address || {};
  root.innerHTML =
    '<section class="storehead">' +
      '<span class="storehead__logo">' + (s.logo_url ? '<img src="' + esc(s.logo_url) + '" alt="">' : UI.icon('store')) + '</span>' +
      '<div><h1>' + esc(s.name) + '</h1>' +
        '<p class="storehead__meta">' + (a.city ? UI.icon('pin') + esc([a.area, a.city].filter(Boolean).join('، ')) + ' · ' : '') + list.length + ' منتج · الإرجاع خلال 14 يوماً</p>' +
        (s.description ? '<p class="storehead__desc">' + esc(s.description) + '</p>' : '') + '</div>' +
    '</section>' +
    (list.length ? '<div class="grid grid--4">' + UI.cards(list) + '</div>'
      : UI.emptyHTML({ icon: 'box', title: 'لا توجد منتجات منشورة بعد', text: 'سيظهر هنا كل ما ينشره هذا المتجر.', actions: [{ label: 'تصفّح كل المنتجات', href: 'shop.html', primary: true }] }));
})();
