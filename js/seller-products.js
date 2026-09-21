/* ==========================================================================
   js/seller-products.js — لوحة البائع: المنتجات (قائمة + نموذج إضافة/تعديل) والطلبات
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Seller;
  if (!S) return;
  const { M, U, esc, money, fmt, ic, $, $$, dateAr, dateTimeAr, pill, pimg, empty, card, pageHead, armed, csv, fld } = S;
  const CFG = window.Store.config, P = window.Products;

  const toLatin = (v) => String(v == null ? '' : v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const numOf = (v) => { const n = Number(toLatin(v).replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; };
  const PRESETS = { clothes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], shoes: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'], bags: [], accessories: [] };
  const catName = (id) => P.categoryName(id) || id;
  const prodFor = (id) => M.products.get(id) || P.byId(id) || { id, name: 'منتج #' + id };

  /* =====================================================================
     المنتجات: القائمة
     ===================================================================== */
  function list(q) {
    const all = M.products.list();
    const text = (q.get('q') || '').trim().toLowerCase(), f = q.get('f') || 'all';
    const stat = {};
    M.stats.byProduct(30).forEach((r) => { stat[r.id] = r; });
    const counts = { all: all.length, active: all.filter((p) => p.status === 'active').length, paused: all.filter((p) => p.status !== 'active').length, low: all.filter((p) => p.stock <= 3).length };
    const rows = all.filter((p) => (!text || (p.name + ' ' + (p.sku || '')).toLowerCase().includes(text)) &&
      (f === 'all' || (f === 'active' && p.status === 'active') || (f === 'paused' && p.status !== 'active') || (f === 'low' && p.stock <= 3)));
    const tabs = [['all', 'الكل'], ['active', 'نشط'], ['paused', 'متوقف'], ['low', 'مخزون منخفض']];

    const html =
      pageHead('المنتجات', counts.all + ' منتج' + (M.demo.on() && !counts.all ? ' · البيانات التجريبية لا تحتوي منتجات فعلية' : ''),
        '<button type="button" class="btn btn--ghost btn--sm" data-act="prod-export">' + ic('download') + 'تصدير CSV</button>' +
        '<a class="btn btn--primary btn--sm" href="#/products/new">' + ic('plus') + 'إضافة منتج</a>') +
      '<nav class="dtabs" aria-label="تصفية المنتجات">' + tabs.map((t) => '<a href="#/products?f=' + t[0] + (text ? '&q=' + encodeURIComponent(text) : '') + '"' + (f === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + ' <span>' + counts[t[0]] + '</span></a>').join('') + '</nav>' +
      card('', rows.length
        ? '<div class="dtable-wrap"><table class="dtable"><thead><tr><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>مشاهدات 30ي</th><th>مبيعات 30ي</th><th>الحالة</th><th><span class="sr-only">إجراءات</span></th></tr></thead><tbody>' +
          rows.map((p) => {
            const st = stat[p.id] || { views: 0, sold: 0 };
            return '<tr><td><div class="pcell">' + pimg(p) + '<span><a href="#/products/edit/' + p.id + '">' + esc(p.name) + '</a><small dir="ltr">' + esc(p.sku || ('SL-' + p.id)) + '</small></span></div></td>' +
              '<td>' + esc(catName(p.category)) + '</td>' +
              '<td>' + money(p.price) + (p.oldPrice ? '<small class="was">' + money(p.oldPrice) + '</small>' : '') + '</td>' +
              '<td>' + (p.stock <= 0 ? '<strong class="txt-bad">نفد</strong>' : p.stock <= 3 ? '<strong class="txt-warn">' + p.stock + '</strong>' : p.stock) + '</td>' +
              '<td>' + fmt(st.views) + '</td><td>' + fmt(st.sold) + '</td>' +
              '<td>' + pill(p.status === 'active' ? 'completed' : 'cancelled', p.status === 'active' ? 'نشط' : 'متوقف') + '</td>' +
              '<td class="acts"><a class="icon-btn" href="#/products/edit/' + p.id + '" aria-label="تعديل ' + esc(p.name) + '">' + ic('edit') + '</a>' +
                '<button type="button" class="icon-btn" data-act="prod-toggle" data-id="' + p.id + '" aria-label="' + (p.status === 'active' ? 'إيقاف' : 'تفعيل') + ' ' + esc(p.name) + '">' + ic(p.status === 'active' ? 'pause' : 'play') + '</button>' +
                '<button type="button" class="icon-btn icon-btn--bad" data-act="prod-delete" data-id="' + p.id + '" aria-label="حذف ' + esc(p.name) + '">' + ic('trash') + '</button></td></tr>';
          }).join('') + '</tbody></table></div>'
        : empty({ icon: 'box', title: all.length ? 'لا توجد نتائج مطابقة' : 'لم تضف أي منتج بعد', text: all.length ? 'غيّر البحث أو الفلتر.' : 'أضف منتجك الأول بصوره وسعره ومخزونه ليظهر في المتجر فوراً.', action: all.length ? null : { href: '#/products/new', label: 'أضف أول منتج' } }));
    return { html };
  }

  S.actions['prod-toggle'] = (b) => {
    const p = M.products.get(b.dataset.id); if (!p) return;
    M.products.setStatus(p.id, p.status === 'active' ? 'paused' : 'active');
    S.toast(p.status === 'active' ? 'تم تفعيل المنتج وسيظهر في المتجر' : 'تم إيقاف المنتج وأُخفي من المتجر');
    S.rerender();
  };
  S.actions['prod-delete'] = (b) => {
    if (!armed(b, 'تأكيد')) return;
    M.products.remove(b.dataset.id); S.toast('تم حذف المنتج'); S.rerender();
  };
  S.actions['prod-export'] = () => {
    csv([['الرقم', 'الاسم', 'التصنيف', 'السعر', 'السعر قبل الخصم', 'المخزون', 'الحالة']].concat(M.products.list().map((p) => [p.id, p.name, catName(p.category), p.price, p.oldPrice || '', p.stock, p.status])), 'products.csv');
  };

  /* =====================================================================
     المنتجات: نموذج الإضافة والتعديل
     ===================================================================== */
  function form(p) {
    const edit = !!p;
    const seller = M.seller.get();
    const d = p ? JSON.parse(JSON.stringify(p)) : { id: null, name: '', category: seller.category || 'clothes', price: '', oldPrice: '', stock: 10, sizes: [], colors: [], description: '', details: [], photos: [], status: 'active' };
    d.photos = d.photos || []; d.colors = d.colors || []; d.sizes = d.sizes || []; d.details = d.details || [];

    const html =
      pageHead(edit ? 'تعديل المنتج' : 'إضافة منتج جديد', '<a href="#/products">→ العودة إلى المنتجات</a>') +
      '<div class="dgrid dgrid--form">' +
        '<form class="dcard dform" id="prod-form" novalidate>' +
          fld('p-name', 'اسم المنتج *', '<input class="input" id="p-name" maxlength="90" value="' + esc(d.name) + '" autocomplete="off">', 'اكتب اسماً واضحاً يذكر النوع والخامة، مثل «حقيبة جلد طبيعي بحزام»') +
          '<div class="dform__row">' +
            fld('p-cat', 'التصنيف *', '<select class="select" id="p-cat">' + P.categories.map((c) => '<option value="' + c.id + '"' + (c.id === d.category ? ' selected' : '') + '>' + c.name + '</option>').join('') + '</select>') +
            fld('p-status', 'الحالة', '<select class="select" id="p-status"><option value="active"' + (d.status === 'active' ? ' selected' : '') + '>نشط (ظاهر في المتجر)</option><option value="paused"' + (d.status !== 'active' ? ' selected' : '') + '>متوقف (مسودة)</option></select>') +
          '</div>' +
          '<div class="dform__row dform__row--3">' +
            fld('p-price', 'السعر (' + CFG.currency + ') *', '<input class="input" id="p-price" inputmode="decimal" dir="ltr" value="' + esc(d.price) + '">') +
            fld('p-old', 'السعر قبل الخصم', '<input class="input" id="p-old" inputmode="decimal" dir="ltr" value="' + esc(d.oldPrice || '') + '">', 'اتركه فارغاً لو لا يوجد خصم') +
            fld('p-stock', 'الكمية المتوفرة *', '<input class="input" id="p-stock" inputmode="numeric" dir="ltr" value="' + esc(d.stock) + '">') +
          '</div>' +
          '<div class="calc" id="calc" aria-live="polite"></div>' +
          '<div class="field" id="sizes-box"></div>' +
          '<div class="field"><span class="label" id="col-l">الألوان المتاحة</span><div class="colors" id="colors-box" aria-labelledby="col-l"></div>' +
            '<div class="color-add"><input class="input" id="c-name" placeholder="اسم اللون (مثل: أسود)" maxlength="20"><input type="color" id="c-hex" value="#2f45d4" aria-label="درجة اللون"><button type="button" class="btn btn--ghost btn--sm" data-act="color-add">' + ic('plus') + 'إضافة لون</button></div></div>' +
          fld('p-desc', 'وصف المنتج', '<textarea class="textarea" id="p-desc" rows="4" maxlength="600">' + esc(d.description) + '</textarea>', '60 حرفاً على الأقل لرفع جودة القائمة') +
          fld('p-details', 'المواصفات (سطر لكل مواصفة)', '<textarea class="textarea" id="p-details" rows="4" placeholder="خامة قطنية 100%&#10;غسيل بالماء البارد&#10;صناعة مصرية">' + esc(d.details.join('\n')) + '</textarea>') +
          '<div class="field"><span class="label" id="img-l">صور المنتج (حتى 8، الأولى هي الغلاف)</span>' +
            '<div class="dropzone" id="dropzone" tabindex="-1">' + ic('upload') + '<p>اسحب الصور هنا أو</p><label class="btn btn--ghost btn--sm">اختر من جهازك<input type="file" id="p-files" accept="image/png,image/jpeg,image/webp" multiple hidden></label><small>PNG أو JPG أو WebP، تُضغط تلقائياً</small></div>' +
            '<ul class="uploader" id="uploader" aria-labelledby="img-l"></ul></div>' +
          '<p class="field__error" id="prod-error" role="alert"></p>' +
          '<div class="dform__foot"><button class="btn btn--primary" type="submit">' + (edit ? 'حفظ التعديلات' : 'نشر المنتج') + '</button><a class="btn btn--ghost" href="#/products">إلغاء</a></div>' +
        '</form>' +
        '<aside class="dcol">' + card('جودة القائمة', '<div id="qbox"></div>') + card('نصائح لمبيعات أعلى', '<ul class="tips"><li>أضف 3 صور أو أكثر من زوايا مختلفة.</li><li>اذكر الخامة والمقاسات في الوصف.</li><li>أسعار العروض تزيد التحويل: استخدم «السعر قبل الخصم».</li><li>حافظ على مخزون لا يقل عن 3 قطع.</li></ul>') + '</aside>' +
      '</div>';

    function mount(root) {
      const g = (id) => $('#' + id, root);
      const refresh = () => { d.name = g('p-name').value; d.price = numOf(g('p-price').value); d.oldPrice = numOf(g('p-old').value) || null; d.stock = Math.max(0, Math.floor(numOf(g('p-stock').value))); d.description = g('p-desc').value; d.details = g('p-details').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 10); d.category = g('p-cat').value; renderCalc(); renderQ(); };
      function renderCalc() {
        const c = Math.round(CFG.commission * 100), fee = d.price * CFG.commission;
        g('calc').innerHTML = d.price > 0
          ? '<div><span>عمولة المنصة (' + c + '%)</span><strong>' + money(fee) + '</strong></div><div><span>صافي ربحك من كل قطعة</span><strong class="txt-good">' + money(d.price - fee) + '</strong></div>' + (d.oldPrice && d.oldPrice > d.price ? '<div><span>نسبة الخصم المعروضة</span><strong>' + Math.round((1 - d.price / d.oldPrice) * 100) + '%</strong></div>' : '')
          : '<p>أدخل السعر لتعرف صافي ربحك بعد عمولة المنصة.</p>';
      }
      function renderQ() {
        const q = M.products.quality(d);
        g('qbox').innerHTML = '<div class="score score--lg"><div class="score__bar"><span style="width:' + q.score + '%"></span></div><strong>' + q.score + '/100</strong></div><ul class="qlist">' +
          [].concat(q.errors.map((c) => ['bad', 'close', c.text]), q.warns.map((c) => ['warn', 'alert', c.text])).map((x) => '<li class="q--' + x[0] + '">' + ic(x[1] === 'close' ? 'close' : 'alert') + esc(x[2]) + '</li>').join('') +
          (q.errors.length + q.warns.length ? '' : '<li class="q--ok">' + ic('check') + 'قائمتك ممتازة، لا توجد ملاحظات.</li>') + '</ul>';
      }
      function renderSizes() {
        const list = PRESETS[g('p-cat').value] || [];
        d.sizes = d.sizes.filter((s) => list.includes(s));
        g('sizes-box').innerHTML = list.length
          ? '<span class="label" id="sz-l">المقاسات المتاحة</span><div class="chips" role="group" aria-labelledby="sz-l">' + list.map((s) => '<button type="button" class="chip" aria-pressed="' + d.sizes.includes(s) + '" data-size="' + s + '">' + s + '</button>').join('') + '</div>'
          : '<p class="hint">هذا التصنيف لا يحتاج مقاسات.</p>';
      }
      function renderColors() {
        g('colors-box').innerHTML = d.colors.length ? d.colors.map((c, i) => '<span class="colortag"><i style="background:' + esc(c.hex) + '"></i>' + esc(c.name) + '<button type="button" data-act="color-del" data-i="' + i + '" aria-label="حذف اللون ' + esc(c.name) + '">' + ic('close') + '</button></span>').join('') : '<p class="hint">لم تضف ألواناً (سيُعرض «أساسي»).</p>';
      }
      function renderPhotos() {
        g('uploader').innerHTML = d.photos.map((u, i) => '<li class="uploader__item"><img src="' + esc(u) + '" alt="صورة المنتج ' + (i + 1) + '">' + (i === 0 ? '<span class="uploader__cover">الغلاف</span>' : '') +
          '<div class="uploader__acts">' + (i ? '<button type="button" data-act="photo-cover" data-i="' + i + '" aria-label="اجعلها الغلاف">' + ic('check') + '</button>' : '') + '<button type="button" data-act="photo-del" data-i="' + i + '" aria-label="حذف الصورة ' + (i + 1) + '">' + ic('trash') + '</button></div></li>').join('');
        renderQ();
      }
      async function addFiles(files) {
        const room = 8 - d.photos.length;
        if (room <= 0) { S.toast('الحد الأقصى 8 صور', 'error'); return; }
        for (const f of Array.from(files).slice(0, room)) {
          try { d.photos.push(await M.image(f, { max: 900, q: 0.78 })); renderPhotos(); } catch (e) { S.toast(e.message, 'error'); }
        }
      }
      root.addEventListener('input', (e) => { if (e.target.closest('#prod-form') && !e.target.matches('#c-name,#c-hex,#p-files')) refresh(); });
      g('p-cat').addEventListener('change', () => { renderSizes(); refresh(); });
      g('p-files').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
      const dz = g('dropzone');
      ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('is-over'); }));
      dz.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-size],[data-act]'); if (!b || !root.contains(b)) return;
        if (b.dataset.size) { const s = b.dataset.size, i = d.sizes.indexOf(s); if (i >= 0) d.sizes.splice(i, 1); else d.sizes.push(s); renderSizes(); renderQ(); return; }
        const a = b.dataset.act, i = Number(b.dataset.i);
        if (a === 'color-add') {
          const name = g('c-name').value.trim();
          if (!name) { g('c-name').focus(); return; }
          if (d.colors.length >= 8) { S.toast('الحد الأقصى 8 ألوان', 'error'); return; }
          d.colors.push({ name, hex: g('c-hex').value }); g('c-name').value = ''; renderColors(); renderQ();
        } else if (a === 'color-del') { d.colors.splice(i, 1); renderColors(); renderQ(); }
        else if (a === 'photo-del') { d.photos.splice(i, 1); renderPhotos(); }
        else if (a === 'photo-cover') { d.photos.unshift(d.photos.splice(i, 1)[0]); renderPhotos(); }
      });
      g('prod-form').addEventListener('submit', (e) => {
        e.preventDefault(); refresh();
        const err = g('prod-error');
        const bad = d.name.trim().length < 3 ? 'اسم المنتج 3 أحرف على الأقل' : !(d.price > 0) ? 'أدخل سعراً أكبر من صفر' : (d.oldPrice && d.oldPrice <= d.price) ? 'السعر قبل الخصم يجب أن يكون أكبر من السعر الحالي' : '';
        if (bad) { err.textContent = bad; return; }
        err.textContent = '';
        const rec = Object.assign({}, d, {
          id: edit ? p.id : M.products.nextId(), name: d.name.trim(), status: g('p-status').value, sellerId: seller.id,
          addedAt: edit ? p.addedAt : new Date().toISOString(), sku: edit ? p.sku : 'SL-' + M.products.nextId()
        });
        if (!M.products.save(rec)) { err.textContent = 'مساحة التخزين ممتلئة. احذف بعض الصور أو المنتجات القديمة.'; return; }
        S.toast(edit ? 'تم حفظ التعديلات' : 'تم نشر منتجك، سيظهر في المتجر عند تحديث الصفحة');
        location.hash = '#/products';
      });
      renderSizes(); renderColors(); renderPhotos(); renderCalc(); renderQ();
    }
    return { html, mount, title: edit ? 'تعديل المنتج' : 'إضافة منتج' };
  }

  S.views.products = (args, q) => {
    if (args[0] === 'new') return form(null);
    if (args[0] === 'edit') { const p = M.products.get(args[1]); return p ? form(p) : { html: pageHead('المنتج غير موجود') + empty({ icon: 'box', title: 'لم نعثر على هذا المنتج', action: { href: '#/products', label: 'العودة للمنتجات' } }) }; }
    return list(q);
  };

  /* =====================================================================
     الطلبات
     ===================================================================== */
  const NEXT_LABEL = { new: 'قبول وبدء التجهيز', processing: 'تم الشحن', shipped: 'تم التسليم' };
  const PAY = { cod: 'عند الاستلام', card: 'بطاقة' };
  const PER = 15;

  function ordersList(q) {
    const tab = q.get('tab') || 'all', text = (q.get('q') || '').trim().toLowerCase(), page = Math.max(1, Number(q.get('page')) || 1);
    const counts = M.orders.counts();
    const all = M.orders.list().filter((o) => (tab === 'all' || o.status === tab) && (!text || (o.id + ' ' + (o.customer.name || '') + ' ' + (o.customer.city || '')).toLowerCase().includes(text)));
    const pages = Math.max(1, Math.ceil(all.length / PER)), cur = Math.min(page, pages), rows = all.slice((cur - 1) * PER, cur * PER);
    const tabs = [['all', 'الكل'], ['new', 'جديدة'], ['processing', 'قيد التجهيز'], ['shipped', 'تم الشحن'], ['completed', 'مكتملة'], ['cancelled', 'ملغاة']];
    const link = (t, pg) => '#/orders?tab=' + t + (text ? '&q=' + encodeURIComponent(text) : '') + (pg > 1 ? '&page=' + pg : '');
    const html =
      pageHead('الطلبات', 'الطلبات الواردة والمكتملة على منتجاتك', '<button type="button" class="btn btn--ghost btn--sm" data-act="ord-export" data-tab="' + tab + '">' + ic('download') + 'تصدير CSV</button>') +
      '<nav class="dtabs" aria-label="حالات الطلبات">' + tabs.map((t) => '<a href="' + link(t[0], 1) + '"' + (tab === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + ' <span>' + counts[t[0]] + '</span></a>').join('') + '</nav>' +
      card('', rows.length
        ? '<div class="dtable-wrap"><table class="dtable"><thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>العميل</th><th>المنتجات</th><th>المبلغ</th><th>الدفع</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>' +
          rows.map((o) => '<tr><td><a href="#/orders/' + esc(o.id) + '" dir="ltr">' + esc(o.id) + '</a>' + (o.demo ? ' <em class="tag-demo">تجريبي</em>' : '') + '</td><td>' + dateAr(o.createdAt) + '</td>' +
            '<td>' + esc(o.customer.name || '—') + '<small>' + esc(o.customer.city || '') + '</small></td><td>' + o.lines.reduce((n, l) => n + l.qty, 0) + ' قطعة</td><td>' + money(o.gross) + '</td><td>' + (PAY[o.payment] || '—') + '</td><td>' + pill(o.status) + '</td>' +
            '<td class="acts">' + (M.NEXT[o.status] ? '<button type="button" class="btn btn--primary btn--sm" data-act="ord-next" data-id="' + esc(o.id) + '">' + NEXT_LABEL[o.status] + '</button>' : '<a class="btn btn--ghost btn--sm" href="#/orders/' + esc(o.id) + '">عرض</a>') + '</td></tr>').join('') + '</tbody></table></div>' +
          (pages > 1 ? '<nav class="pager" aria-label="الصفحات">' + (cur > 1 ? '<a class="btn btn--ghost btn--sm" href="' + link(tab, cur - 1) + '">السابق</a>' : '') + '<span>صفحة ' + cur + ' من ' + pages + '</span>' + (cur < pages ? '<a class="btn btn--ghost btn--sm" href="' + link(tab, cur + 1) + '">التالي</a>' : '') + '</nav>' : '')
        : empty({ icon: 'list', title: 'لا توجد طلبات هنا', text: 'عندما يشتري عميل أحد منتجاتك سيظهر الطلب هنا فوراً وتصلك إشعارات.' }));
    return { html };
  }

  function orderDetail(id) {
    const o = M.orders.get(id);
    if (!o) return { html: pageHead('الطلب غير موجود') + empty({ icon: 'list', title: 'لم نعثر على هذا الطلب', action: { href: '#/orders', label: 'العودة للطلبات' } }) };
    const steps = ['new', 'processing', 'shipped', 'completed'], idx = steps.indexOf(o.status);
    const c = o.customer || {};
    const addr = [c.address, c.city].filter(Boolean).join('، ');
    const html =
      pageHead('طلب ' + o.id, dateTimeAr(o.createdAt) + ' · ' + (PAY[o.payment] || ''), '<a class="btn btn--ghost btn--sm" href="#/orders">→ كل الطلبات</a>') +
      '<div class="dgrid dgrid--main"><div class="dcol">' +
        card('حالة الطلب', o.status === 'cancelled' ? '<p class="txt-bad">' + ic('close') + ' هذا الطلب ملغي.</p>'
          : '<ol class="steps">' + steps.map((s, i) => '<li class="' + (i < idx ? 'is-done' : i === idx ? 'is-cur' : '') + '"><span>' + (i < idx ? ic('check') : i + 1) + '</span>' + M.STATUS[s] + '</li>').join('') + '</ol>' +
            '<div class="dform__foot">' + (M.NEXT[o.status] ? '<button type="button" class="btn btn--primary" data-act="ord-next" data-id="' + esc(o.id) + '" data-back="1">' + NEXT_LABEL[o.status] + '</button>' : '') +
            (o.status === 'new' || o.status === 'processing' ? '<button type="button" class="btn btn--ghost" data-act="ord-cancel" data-id="' + esc(o.id) + '">إلغاء الطلب</button>' : '') + '</div>') +
        card('المنتجات', '<div class="dtable-wrap"><table class="dtable"><thead><tr><th>المنتج</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th></tr></thead><tbody>' +
          o.lines.map((l) => '<tr><td><div class="pcell">' + pimg(prodFor(l.productId)) + '<span>' + esc(l.name) + '<small>' + [l.size ? 'المقاس ' + l.size : '', l.color].filter(Boolean).map(esc).join(' · ') + '</small></span></div></td><td>' + money(l.price) + '</td><td>' + l.qty + '</td><td>' + money(l.price * l.qty) + '</td></tr>').join('') + '</tbody></table></div>' +
          '<dl class="totals"><div><dt>إجمالي المنتجات</dt><dd>' + money(o.gross) + '</dd></div><div><dt>عمولة المنصة (' + Math.round(CFG.commission * 100) + '%)</dt><dd>−' + money(o.commission) + '</dd></div><div class="totals__net"><dt>صافي ربحك</dt><dd>' + money(o.net) + '</dd></div></dl>') +
      '</div><div class="dcol">' +
        card('بيانات العميل', '<dl class="kv"><div><dt>الاسم</dt><dd>' + esc(c.name || '—') + '</dd></div>' +
          '<div><dt>الجوال</dt><dd dir="ltr">' + (c.phone ? '<a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a>' : '—') + '</dd></div>' +
          '<div><dt>العنوان</dt><dd>' + esc(addr || '—') + '</dd></div></dl>' +
          (addr && !o.demo ? '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr) + '">' + ic('pin') + 'افتح العنوان في خرائط جوجل</a>' : '')) +
      '</div></div>';
    return { html, title: 'طلب ' + o.id };
  }

  S.views.orders = (args, q) => (args[0] ? orderDetail(decodeURIComponent(args[0])) : ordersList(q));

  const setStatus = (id, st, msg) => { M.orders.setStatus(id, st); S.toast(msg); S.rerender(); };
  S.actions['ord-next'] = (b) => { const o = M.orders.get(b.dataset.id); if (!o || !M.NEXT[o.status]) return; setStatus(o.id, M.NEXT[o.status], 'تم تحديث الحالة إلى «' + M.STATUS[M.NEXT[o.status]] + '»'); };
  S.actions['ord-cancel'] = (b) => { if (!armed(b, 'تأكيد الإلغاء')) return; setStatus(b.dataset.id, 'cancelled', 'تم إلغاء الطلب'); };
  S.actions['ord-export'] = (b) => {
    const tab = b.dataset.tab;
    csv([['رقم الطلب', 'التاريخ', 'العميل', 'المدينة', 'الجوال', 'القطع', 'إجمالي المنتجات', 'العمولة', 'الصافي', 'الدفع', 'الحالة']].concat(
      M.orders.list().filter((o) => tab === 'all' || o.status === tab).map((o) => [o.id, o.createdAt.slice(0, 10), o.customer.name, o.customer.city, o.customer.phone, o.lines.reduce((n, l) => n + l.qty, 0), o.gross, o.commission, o.net, PAY[o.payment] || '', M.STATUS[o.status]])), 'orders.csv');
  };
})();
