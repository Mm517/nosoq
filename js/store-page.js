/* ==========================================================================
   js/store-page.js — صفحة المتجر العامة للبائع: store.html?s=slug
   ========================================================================== */
(function () {
  'use strict';
  const root = document.getElementById('store-root');
  if (!root) return;
  const esc = window.Store.esc;
  const slug = new URLSearchParams(location.search).get('s') || '';
  const s = window.Market.seller.get();

  if (!s || s.slug !== slug) {
    root.innerHTML = UI.emptyHTML({ icon: 'store', title: 'لم نعثر على هذا المتجر', text: 'ربما تغيّر رابط المتجر أو لم يعد متاحاً.', actions: [{ label: 'تصفّح المتجر', href: 'shop.html', primary: true }] });
    return;
  }
  document.title = s.name + ' | ' + window.Store.config.name;
  const list = Products.all().filter((p) => p.sellerId === s.id);
  const a = s.address || {};
  root.innerHTML =
    '<section class="storehead">' +
      '<span class="storehead__logo">' + (s.logo ? '<img src="' + esc(s.logo) + '" alt="">' : UI.icon('store')) + '</span>' +
      '<div><h1>' + esc(s.name) + '</h1>' +
        '<p class="storehead__meta">' + (a.city ? UI.icon('pin') + esc([a.area, a.city].filter(Boolean).join('، ')) + ' · ' : '') + list.length + ' منتج · الإرجاع خلال ' + esc(s.returnDays) + ' يوماً</p>' +
        (s.description ? '<p class="storehead__desc">' + esc(s.description) + '</p>' : '') + '</div>' +
    '</section>' +
    (list.length ? '<div class="grid grid--4">' + UI.cards(list) + '</div>'
      : UI.emptyHTML({ icon: 'box', title: 'لا توجد منتجات منشورة بعد', text: 'سيظهر هنا كل ما ينشره هذا المتجر.', actions: [{ label: 'تصفّح كل المنتجات', href: 'shop.html', primary: true }] }));
})();
