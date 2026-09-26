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

  /* المتجر لا يظهر للمشتري إلا لو كان يبعد عنه (بالإحداثيات الفعلية، مش المحافظة)
     50 كم أو أقل — حتى لو دخل برابط مباشر. لو موقع المشتري غير معروف، أو المتجر
     نفسه بلا إحداثيات، أو النطاق لا يشمله: لا نعرض منتجاته إطلاقاً. */
  const buyerLoc = window.BuyerLocation ? window.BuyerLocation.get() : null;
  const radiusKm = window.Products ? window.Products.radiusKm : 50;
  let distanceM = null;
  if (buyerLoc && s.latitude != null && s.longitude != null && window.Distance) {
    distanceM = window.Distance.meters(buyerLoc.lat, buyerLoc.lng, s.latitude, s.longitude);
  }
  const inRange = distanceM != null && distanceM <= radiusKm * 1000;

  if (!buyerLoc) {
    document.title = s.name + ' | ' + window.Store.config.name;
    root.innerHTML = '<div class="container">' + UI.locationBannerHTML() + '</div>';
    UI.bindLocationBanner(root);
    return;
  }
  if (!inRange) {
    root.innerHTML = UI.emptyHTML({
      icon: 'pin', title: 'هذا المتجر خارج نطاق التوصيل عندك',
      text: 'نعرض فقط المتاجر التي تبعد عنك ' + radiusKm + ' كم أو أقل، وهذا المتجر أبعد من ذلك.',
      actions: [{ label: 'تصفّح المتاجر القريبة منك', href: 'shop.html', primary: true }]
    });
    return;
  }

  document.title = s.name + ' | ' + window.Store.config.name;
  const list = Products.all().filter((p) => p.storeId === s.id);
  const a = s.address || {};
  const distText = distanceM != null && window.Distance ? window.Distance.format(distanceM) : '';
  root.innerHTML =
    '<section class="storehead">' +
      '<span class="storehead__logo">' + (s.logo_url ? '<img src="' + esc(s.logo_url) + '" alt="">' : UI.icon('store')) + '</span>' +
      '<div><h1>' + esc(s.name) + '</h1>' +
        '<p class="storehead__meta">' + (a.city ? UI.icon('pin') + esc([a.area, a.city].filter(Boolean).join('، ')) + ' · ' : '') + list.length + ' منتج · الإرجاع خلال 14 يوماً' +
          (distText ? ' · يبعد عنك ' + distText : '') + '</p>' +
        (s.description ? '<p class="storehead__desc">' + esc(s.description) + '</p>' : '') + '</div>' +
    '</section>' +
    (list.length ? '<div class="grid grid--4">' + UI.cards(list) + '</div>'
      : UI.emptyHTML({ icon: 'box', title: 'لا توجد منتجات منشورة بعد', text: 'سيظهر هنا كل ما ينشره هذا المتجر.', actions: [{ label: 'تصفّح كل المنتجات', href: 'shop.html', primary: true }] }));
})();
