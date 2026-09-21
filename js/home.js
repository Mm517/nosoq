/* ==========================================================================
   js/home.js — الرئيسية: شريط اللافتات، بطاقات البلاطات، الكاروسيل، وصل حديثاً، الكوبونات، النشرة
   كل الأرقام (نسب الخصم، عدد المنتجات، الميزانيات) تُحسب من بيانات المنتجات، لا أرقام ثابتة.
   ========================================================================== */
(function () {
  'use strict';
  if (document.body.dataset.page !== 'home') return;

  const esc = window.Store.esc;
  const money = window.Store.money;
  const CFG = window.Store.config;
  const all = Products.all();
  const $ = (id) => document.getElementById(id);

  const inStock = (p) => !Products.isSoldOut(p);
  const byFeatured = (a, b) => b.rating * Math.log(b.reviews + 1) - a.rating * Math.log(a.reviews + 1);
  const pctOf = Products.discountPct;
  const spIds = window.Market ? window.Market.ads.sponsoredIds() : new Set();
  const sponsoredFirst = (a, b) => (spIds.has(b.id) ? 1 : 0) - (spIds.has(a.id) ? 1 : 0);
  const discounted = all.filter((p) => pctOf(p) > 0 && inStock(p)).sort((a, b) => pctOf(b) - pctOf(a));
  const maxDiscount = discounted.length ? pctOf(discounted[0]) : 0;
  const newest = all.filter((p) => p.isNew && inStock(p)).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  const count = (n) => (n === 1 ? 'منتج واحد' : n === 2 ? 'منتجان' : n <= 10 ? n + ' منتجات' : n + ' منتجاً');
  const img = (p, i, size) => Products.imgAttrs(p, i || 0, 0, size || 'sm');
  const byIds = (ids) => ids.map((id) => Products.byId(id)).filter(Boolean);

  /* ---------- 1) شريط اللافتات ---------- */
  function art(list) {
    return '<div class="promo-card__art" aria-hidden="true">' +
      list.slice(0, 2).map((p) => '<img' + img(p, 0, 'md') + ' alt="" width="480" height="600" loading="lazy" decoding="async">').join('') + '</div>';
  }
  function slide(o) {
    return '<article class="promo-card promo-card--' + o.tone + '">' +
      '<h3>' + esc(o.title) + '</h3><p>' + esc(o.text) + '</p>' +
      '<a class="btn ' + (o.btn || 'btn--light') + ' btn--sm promo-card__cta" href="' + o.href + '">' + esc(o.cta) + '</a>' +
      art(o.products) + '</article>';
  }

  function heroSlides() {
    const perk = (ic, t) => '<div class="perk"><span class="perk__ic">' + UI.icon(ic) + '</span>' + t + '</div>';
    const brand = '<article class="promo-card promo-card--accent">' +
      '<h3>أناقة هادئة،<br>لكل يوم</h3>' +
      '<p>قطع مختارة بخامات تدوم موسماً بعد موسم.</p>' +
      '<div class="perk-grid">' +
        perk('truck', 'شحن مجاني<small>فوق ' + money(CFG.freeShippingFrom) + '</small>') +
        perk('refresh', 'إرجاع مجاني<small>خلال ' + CFG.returnDays + ' يوماً</small>') +
        perk('cash', 'الدفع عند<small>الاستلام</small>') +
        perk('shield', 'دفع آمن<small>لبياناتك</small>') +
      '</div>' +
      '<a class="btn btn--light btn--sm promo-card__cta" href="shop.html">تسوّق المجموعة</a></article>';

    /* لافتات المعلنين (حملات «لافتة الصفحة الرئيسية») تظهر بعد لافتة المتجر مباشرة */
    const adCards = window.Market ? window.Market.ads.active('hero').map((c) => { window.Market.ads.impression(c.id); return UI.adSlide(c); }) : [];
    const cards = [brand].concat(adCards);
    if (newest.length) cards.push(slide({ tone: 'soft', title: 'وصل حديثاً', text: 'قطع جديدة هذا الأسبوع بخامات وتصاميم هادئة.', cta: 'تسوّق الجديد', href: 'shop.html?sort=new', products: newest, btn: 'btn--primary' }));
    if (discounted.length) cards.push(slide({ tone: 'ink', title: 'عروض لفترة محدودة', text: 'خصم حتى ' + maxDiscount + '% على قطع مختارة.', cta: 'شاهد العروض', href: 'shop.html?sale=1', products: discounted }));
    cards.push(slide({ tone: 'mid', title: 'حقائب ومحافظ جلد', text: 'جلد طبيعي يزداد جمالاً مع الاستخدام.', cta: 'تسوّق الحقائب', href: 'shop.html?cat=bags', products: byIds([6, 12]), btn: 'btn--primary' }));
    cards.push(slide({ tone: 'plain', title: 'إكسسوارات تكمل إطلالتك', text: 'ساعات ونظارات وأوشحة بلمسة بسيطة.', cta: 'تسوّق الإكسسوارات', href: 'shop.html?cat=accessories', products: byIds([8, 11]), btn: 'btn--primary' }));
    cards.push(slide({ tone: 'deep', title: 'ملابس لكل يوم', text: 'هودي وجاكيت وتيشيرتات بقصّات مريحة.', cta: 'تسوّق الملابس', href: 'shop.html?cat=clothes', products: byIds([2, 3]) }));
    return cards;
  }

  const railRoot = $('hero-rail-root');
  if (railRoot) {
    railRoot.innerHTML = UI.carousel({ id: 'hero-rail', rail: true, title: 'لافتات وعروض المتجر', items: heroSlides() });
  }

  /* ---------- 2) بطاقات البلاطات: الصف الأول ---------- */
  const row1 = [];

  row1.push(UI.tileCard({
    id: 'tc-cats', title: 'تسوّق حسب الفئة', href: 'shop.html',
    tiles: Products.categories.map((c) => {
      const list = all.filter((p) => p.category === c.id);
      const cover = list.find(inStock) || list[0];
      return UI.tile({ href: 'shop.html?cat=' + c.id, img: img(cover), label: esc(c.name), sub: count(list.length) });
    })
  }));

  if (discounted.length) {
    const dealTones = ['', 'deep', 'mid', 'ink'];
    const tiles = [UI.tile({ href: 'shop.html?sale=1', big: 'حتى ' + maxDiscount + '%', small: 'خصم', label: 'كل العروض', tone: dealTones[0] })];
    Products.categories.forEach((c) => {
      const d = discounted.filter((p) => p.category === c.id);
      if (d.length && tiles.length < 4) {
        tiles.push(UI.tile({ href: 'shop.html?cat=' + c.id + '&sale=1', big: 'حتى ' + pctOf(d[0]) + '%', small: 'خصم', label: esc(c.name), tone: dealTones[tiles.length] }));
      }
    });
    row1.push(UI.tileCard({ id: 'tc-deals', title: 'خصومات حسب الفئة', href: 'shop.html?sale=1', tiles: tiles }));
  }

  row1.push(UI.tileCard({
    id: 'tc-join', cls: 'tcard--join', title: 'تسوّق بثقة من نَسَق',
    body: '<p>أنشئ حسابك لإدارة طلباتك ومشترياتك في مكان واحد.</p>' +
      '<a class="btn btn--light btn--sm" href="auth.html?tab=signup">أنشئ حسابك</a>' +
      '<div class="mini-perks">' +
        '<span class="mini-perk">' + UI.icon('truck') + 'شحن مجاني فوق ' + money(CFG.freeShippingFrom) + '</span>' +
        '<span class="mini-perk">' + UI.icon('refresh') + 'إرجاع خلال ' + CFG.returnDays + ' يوماً</span>' +
        '<span class="mini-perk">' + UI.icon('cash') + 'الدفع عند الاستلام</span>' +
        '<span class="mini-perk">' + UI.icon('shield') + 'دفع آمن</span>' +
      '</div>'
  }));

  if (discounted.length) {
    row1.push(UI.tileCard({
      id: 'tc-today', title: 'عروض اليوم', href: 'shop.html?sale=1',
      tiles: discounted.slice(0, 4).map((p) => UI.tile({
        href: 'product.html?id=' + p.id, img: img(p), label: esc(p.name),
        sub: '<span class="pill-sale">−' + pctOf(p) + '%</span> ينتهي خلال ' + UI.countdownHTML()
      }))
    }));
  }
  const t1 = $('tiles-1');
  if (t1) t1.innerHTML = row1.join('');

  /* ---------- 3) الصف الثاني ---------- */
  const row2 = [];
  const budgetTones = ['', 'mid', 'deep', 'ink'];
  const budgets = [200, 400, 700, 1000].filter((m) => all.some((p) => p.price <= m));
  row2.push(UI.tileCard({
    id: 'tc-budget', title: 'تسوّق حسب الميزانية', href: 'shop.html',
    tiles: budgets.map((m, i) => UI.tile({
      href: 'shop.html?max=' + m, big: m, small: 'ر.س فأقل', tone: budgetTones[i], label: 'أقل من ' + m + ' ر.س', sub: count(all.filter((p) => p.price <= m).length)
    }))
  }));

  row2.push(UI.tileCard({
    id: 'tc-top', title: 'الأعلى تقييماً', href: 'shop.html?sort=rating',
    tiles: all.filter(inStock).sort((a, b) => (b.rating - a.rating) || (b.reviews - a.reviews)).slice(0, 4).map((p) => UI.tile({
      href: 'product.html?id=' + p.id, img: img(p), label: esc(p.name), sub: '★ ' + p.rating.toFixed(1) + ' (' + p.reviews + ' تقييم)'
    }))
  }));

  const couponRows = Object.keys(Cart.coupons).map((code) =>
    '<div class="coupon-row"><span><span class="coupon-row__code" dir="ltr">' + esc(code) + '</span><span class="coupon-row__desc">' + esc(Cart.coupons[code].label) + '</span></span>' +
    '<button type="button" class="coupon-row__copy" data-code="' + esc(code) + '" aria-label="انسخ كود الخصم ' + esc(code) + '">' + UI.icon('copy') + '</button></div>').join('');
  row2.push(UI.tileCard({
    id: 'coupons', cls: 'tcard--ink tcard--wide', title: 'أكواد الخصم',
    body: '<p>انسخ الكود واستخدمه عند إتمام الطلب. أكواد الخصم تُطبَّق فوق أسعار العروض.</p><div class="coupon-list">' + couponRows + '</div>'
  }));
  const t2 = $('tiles-2');
  if (t2) t2.innerHTML = row2.join('');

  /* ---------- 4) كاروسيلات المنتجات ---------- */
  const moreRoot = $('more-root');
  if (moreRoot) {
    moreRoot.innerHTML = UI.carousel({ id: 'car-more', title: 'منتجات قد تهمّك', href: 'shop.html', items: all.slice().sort(byFeatured).sort(sponsoredFirst).map(UI.pcard) });
  }
  const dealsRoot = $('deals-root');
  if (dealsRoot && discounted.length) {
    dealsRoot.innerHTML = UI.carousel({ id: 'car-deals', title: 'عروض لفترة محدودة', href: 'shop.html?sale=1', more: 'عرض الكل', items: discounted.map(UI.pcard) });
  }
  const recentRoot = $('recent-root');
  const seen = UI.recent.list();
  if (recentRoot && seen.length) {
    recentRoot.hidden = false;
    recentRoot.innerHTML = UI.carousel({ id: 'car-recent', title: 'شاهدتها مؤخراً', items: seen.map(UI.pcard) });
  }
  UI.initCarousels();

  /* ---------- 5) وصل حديثاً (شبكة) ---------- */
  const newGrid = $('new-grid');
  if (newGrid) {
    UI.load(newGrid, {
      count: 4,
      render: () => UI.cards(all.filter((p) => p.isNew).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)).slice(0, 4))
    });
  }

  /* ---------- 6) نسخ أكواد الخصم ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-code]');
    if (!b) return;
    const code = b.dataset.code;
    const done = () => UI.toast('تم نسخ الكود ' + code, { duration: 2600 });
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, done);
    else done();
  });

  /* ---------- 7) النشرة البريدية ---------- */
  const form = $('newsletter-form');
  if (form) {
    const input = form.querySelector('input');
    const err = form.querySelector('.field__error');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
      if (!ok) {
        err.textContent = 'أدخل بريداً إلكترونياً صحيحاً، مثل name@example.com';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      err.textContent = '';
      input.removeAttribute('aria-invalid');
      input.value = '';
      UI.toast('تم اشتراكك بنجاح، سنراسلك بأحدث القطع');
      /* اربط هذا الجزء بخدمة البريد (Mailchimp/Resend…) عند الإطلاق */
    });
  }
})();
