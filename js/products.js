/* ==========================================================================
   js/products.js — إعدادات المتجر + بيانات 12 منتجاً + مولّد صور SVG مؤقتة
   الصور: عشوائية من photoHost لكل منتج (مربوطة بـ id المنتج واللون). لو فشل تحميل صورة تظهر رسمة SVG بدلاً منها.
   لاستبدالها بصور حقيقية أضف photos: ['img/a.jpg', ...] داخل المنتج.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- إعدادات المتجر (غيّرها من هنا) ---------- */
  const STORE = {
    name: 'نَسَق',
    currency: 'ر.س',
    currencyCode: 'SAR',          // لاستخدامه في schema.org
    freeShippingFrom: 500,
    shipping: { standard: 35, express: 75 },
    returnDays: 14,
    email: 'hello@nasaq.example',
    cities: ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا', 'الزقازيق', 'أسيوط', 'الأقصر'],
    /* صور عشوائية مؤقتة، كل منتج له صوره الثابتة (نفس المنتج = نفس الصور دائماً).
       لاستخدام صور حقيقية أضف photos: ['img/a.jpg', ...] داخل المنتج */
    photoHost: 'https://picsum.photos/seed/',
    photoCount: 8,

    /* ---- منصة البائعين ---- */
    commission: 0.10,                       // عمولة المنصة على مبيعات كل بائع (10%)
    minPayout: 100,                         // أقل مبلغ يمكن سحبه
    supportEmail: 'sellers@nasaq.example',
    /* مفتاح Google Maps (Maps JavaScript API + Geocoding API). اتركه فارغاً وسيعمل تحديد الموقع
       بالـ GPS مع معاينة خريطة جوجل، وعند وضع المفتاح تصبح الخريطة تفاعلية (تحريك الدبوس والبحث). */
    googleMapsKey: '',
    /* أسعار الإعلانات بالريال لليوم الواحد + خصم على المدد الطويلة */
    adPlacements: {
      hero:     { name: 'لافتة الصفحة الرئيسية', desc: 'تظهر ضمن شريط اللافتات في أول الرئيسية، أعلى ظهور في المتجر.', perDay: 150, ratio: '4:5 (مثال 800×1000)' },
      category: { name: 'لافتة أعلى صفحة المنتجات', desc: 'شريط عريض أعلى نتائج التصفح، يمكن تخصيصه لفئة معيّنة أو كل الفئات.', perDay: 90, ratio: '4:1 (مثال 1600×400)' },
      product:  { name: 'منتج مموَّل', desc: 'يظهر منتجك أولاً في القوائم والكاروسيل بشارة «مموّل».', perDay: 40, ratio: null }
    },
    adDiscounts: [{ days: 30, off: 0.2 }, { days: 14, off: 0.15 }, { days: 7, off: 0.1 }]
  };

  const CATEGORIES = [
    { id: 'clothes', name: 'ملابس' },
    { id: 'bags', name: 'حقائب' },
    { id: 'shoes', name: 'أحذية' },
    { id: 'accessories', name: 'إكسسوارات' }
  ];

  /* ---------- أدوات صغيرة مشتركة ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const money = (n) => {
    const r = Math.round(n * 100) / 100;
    return r.toLocaleString('en-US', { minimumFractionDigits: r % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }) + ' ' + STORE.currency;
  };

  /* توحيد النص العربي للبحث: إزالة التشكيل وتوحيد الألف والياء والتاء المربوطة */
  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .trim();

  /* ---------- مولّد الصور: أشكال SVG بسيطة لكل نوع منتج ---------- */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* f = تعبئة الجسم (تدرّج)، d = لون داكن للتفاصيل */
  const SHAPES = {
    tee: (f, d) =>
      `<path d="M140 92 L96 112 L56 176 L98 200 L125 168 L125 402 L275 402 L275 168 L302 200 L344 176 L304 112 L260 92 Q200 136 140 92 Z" fill="${f}"/>
       <path d="M140 92 Q200 136 260 92" fill="none" stroke="${d}" stroke-width="7" opacity=".45"/>`,
    hoodie: (f, d) =>
      `<path d="M138 104 L84 134 L58 336 L104 346 L126 214 L126 412 L274 412 L274 214 L296 346 L342 336 L316 134 L262 104 Q200 156 138 104 Z" fill="${f}"/>
       <path d="M148 100 Q160 44 200 44 Q240 44 252 100 Q200 150 148 100 Z" fill="${f}"/>
       <path d="M164 102 Q200 138 236 102 Q228 66 200 64 Q172 66 164 102 Z" fill="${d}" opacity=".5"/>
       <path d="M150 330 H250 L266 380 H134 Z" fill="${d}" opacity=".25"/>
       <path d="M188 140 V190 M212 140 V190" stroke="${d}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`,
    jacket: (f, d) =>
      `<path d="M140 96 L88 122 L60 350 L108 358 L128 220 L128 410 L272 410 L272 220 L292 358 L340 350 L312 122 L260 96 L228 122 L200 100 L172 122 Z" fill="${f}"/>
       <path d="M172 122 L200 100 L228 122 L214 152 L200 138 L186 152 Z" fill="${d}" opacity=".4"/>
       <path d="M200 138 V410" stroke="${d}" stroke-width="4" opacity=".5"/>
       <rect x="146" y="236" width="44" height="40" rx="4" fill="none" stroke="${d}" stroke-width="3" opacity=".55"/>
       <rect x="210" y="236" width="44" height="40" rx="4" fill="none" stroke="${d}" stroke-width="3" opacity=".55"/>
       <path d="M128 380 H272" stroke="${d}" stroke-width="5" opacity=".4"/>`,
    dress: (f, d) =>
      `<path d="M154 126 Q200 152 246 126 L250 196 L322 446 H78 L150 196 Z" fill="${f}"/>
       <path d="M182 92 L193 132 M218 92 L207 132" stroke="${d}" stroke-width="8" stroke-linecap="round" fill="none"/>
       <path d="M150 196 H250" stroke="${d}" stroke-width="6" opacity=".4"/>
       <path d="M200 206 L192 446 M200 206 L226 446 M200 206 L174 446" stroke="${d}" stroke-width="2" opacity=".2"/>`,
    pants: (f, d) =>
      `<path d="M138 78 H262 L290 444 H218 L200 214 L182 444 H110 Z" fill="${f}"/>
       <path d="M138 78 H262 V104 H138 Z" fill="${d}" opacity=".4"/>
       <path d="M200 104 V214" stroke="${d}" stroke-width="3" opacity=".5"/>
       <path d="M150 130 Q170 160 180 150" stroke="${d}" stroke-width="3" fill="none" opacity=".5"/>`,
    bag: (f, d) =>
      `<path d="M142 204 V158 Q142 92 200 92 Q258 92 258 158 V204" fill="none" stroke="${d}" stroke-width="12" stroke-linecap="round"/>
       <path d="M92 204 H308 L334 424 Q335 434 325 434 H75 Q65 434 66 424 Z" fill="${f}"/>
       <path d="M92 204 H308 L312 244 Q200 276 88 244 Z" fill="${d}" opacity=".3"/>
       <circle cx="200" cy="262" r="10" fill="${d}" opacity=".75"/>`,
    shoe: (f, d) =>
      `<path d="M58 322 Q58 254 112 244 L168 238 Q196 190 244 212 L304 252 Q352 262 352 314 V346 H58 Z" fill="${f}"/>
       <path d="M52 342 H358 V366 Q358 380 344 380 H66 Q52 380 52 366 Z" fill="#ffffff" stroke="${d}" stroke-width="2" opacity=".92"/>
       <path d="M168 238 L190 262 M198 226 L216 250 M228 220 L244 244" stroke="${d}" stroke-width="4" stroke-linecap="round" opacity=".55"/>
       <path d="M58 322 Q120 300 176 318" stroke="${d}" stroke-width="4" fill="none" opacity=".35"/>`,
    watch: (f, d) =>
      `<rect x="160" y="40" width="80" height="150" rx="16" fill="${d}"/>
       <rect x="160" y="310" width="80" height="150" rx="16" fill="${d}"/>
       <circle cx="200" cy="250" r="92" fill="${f}"/>
       <circle cx="200" cy="250" r="72" fill="#ffffff" opacity=".93"/>
       <path d="M200 186v8M200 306v-8M136 250h8M264 250h-8" stroke="#15171c" stroke-width="3" stroke-linecap="round"/>
       <path d="M200 250 V204 M200 250 L230 266" stroke="#15171c" stroke-width="5" stroke-linecap="round"/>
       <circle cx="200" cy="250" r="6" fill="#15171c"/>`,
    cap: (f, d) =>
      `<path d="M86 312 Q84 178 200 166 Q316 178 314 312 Z" fill="${f}"/>
       <path d="M200 166 V312 M200 166 Q150 200 146 312 M200 166 Q250 200 254 312" stroke="${d}" stroke-width="3" fill="none" opacity=".4"/>
       <path d="M300 300 Q392 296 392 330 Q330 346 286 322 Z" fill="${d}"/>
       <circle cx="200" cy="168" r="9" fill="${d}"/>
       <rect x="86" y="306" width="228" height="18" rx="6" fill="${d}" opacity=".45"/>`,
    scarf: (f, d) =>
      `<path d="M110 92 Q200 60 290 92 Q312 150 280 196 Q200 228 120 196 Q88 150 110 92 Z" fill="${f}"/>
       <ellipse cx="200" cy="146" rx="52" ry="26" fill="${d}" opacity=".3"/>
       <path d="M150 190 L128 424 H214 L232 200 Z" fill="${f}"/>
       <path d="M226 194 L250 380 H318 L282 190 Z" fill="${f}"/>
       <path d="M131 386 H213 M133 366 H214 M254 346 H316 M252 326 H310" stroke="${d}" stroke-width="4" opacity=".4"/>
       <path d="M134 424v20M148 424v20M162 424v20M176 424v20M190 424v20M204 424v20M256 380v18M270 380v18M284 380v18M298 380v18M312 380v18" stroke="${d}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
    glasses: (f, d) =>
      `<path d="M64 224 Q64 208 84 208 H170 Q196 208 196 236 Q196 296 140 296 Q64 296 64 236 Z" fill="${f}"/>
       <path d="M204 236 Q204 208 230 208 H316 Q336 208 336 224 V236 Q336 296 260 296 Q204 296 204 236 Z" fill="${f}"/>
       <path d="M196 226 Q200 216 204 226" stroke="${d}" stroke-width="6" fill="none"/>
       <path d="M64 222 L40 200 M336 222 L360 200" stroke="${d}" stroke-width="8" stroke-linecap="round"/>
       <path d="M84 224 Q110 214 150 220" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35" fill="none"/>`,
    wallet: (f, d) =>
      `<rect x="86" y="170" width="228" height="170" rx="18" fill="${f}"/>
       <path d="M86 210 H314" stroke="${d}" stroke-width="4" opacity=".45"/>
       <rect x="238" y="236" width="88" height="56" rx="12" fill="${d}" opacity=".65"/>
       <circle cx="268" cy="264" r="8" fill="#fff" opacity=".85"/>
       <path d="M104 186 H296" stroke="#fff" stroke-width="2" stroke-dasharray="6 6" opacity=".5"/>`
  };
  const FLOOR = { tee: 404, hoodie: 414, jacket: 412, dress: 448, pants: 446, bag: 436, shoe: 382, watch: 462, cap: 346, scarf: 444, glasses: 300, wallet: 342 };
  const DY = { shoe: -32, bag: -12, hoodie: 18, pants: -8, wallet: -5 };

  const artCache = new Map();
  function art(kind, color, variant, seed) {
    const key = kind + color + variant + seed;
    if (artCache.has(key)) return artCache.get(key);

    const dark = shade(color, -0.34), light = shade(color, 0.28);
    const lum = (parseInt(color.slice(1, 3), 16) * 0.299 + parseInt(color.slice(3, 5), 16) * 0.587 + parseInt(color.slice(5, 7), 16) * 0.114) / 255;
    const palettes = lum > 0.78
      ? [['#dfe3e8', '#cdd3db'], ['#d8e0df', '#c6d1d0'], ['#e3dcd4', '#d2c8bd'], ['#d9dcec', '#c7cce3']]
      : [['#f1f3f6', '#e1e5ea'], ['#eaefef', '#d9e1e0'], ['#f2eeea', '#e3dcd4'], ['#eceef6', '#dbe0ee']];
    const [b1, b2] = palettes[(seed + variant) % 4];
    const dy = DY[kind] || 0;
    const floor = (FLOOR[kind] || 440) + dy;

    let view = '', extra = '', shadow = '';
    if (variant === 1) view = 'translate(200 250) rotate(-6) scale(1.04) translate(-200 -250)';
    if (variant === 2) view = 'translate(200 250) scale(1.5) translate(-200 -250)';
    if (variant === 3) {
      view = 'translate(200 250) scale(.8) translate(-200 -250)';
      extra = '<circle cx="200" cy="250" r="168" fill="#fff" opacity=".5"/><circle cx="200" cy="250" r="118" fill="#fff" opacity=".4"/>';
    }
    if (variant !== 2) {
      shadow = `<ellipse cx="200" cy="${floor + 10}" rx="${kind === 'watch' || kind === 'glasses' ? 70 : 120}" ry="10" fill="#15171c" opacity=".14" filter="url(#s)"/>`;
    }

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">` +
      `<defs>` +
      `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient>` +
      `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient>` +
      `<filter id="s" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="8"/></filter>` +
      `</defs><rect width="400" height="500" fill="url(#bg)"/>${extra}` +
      `<g transform="${view}">${shadow}<g transform="translate(0 ${dy})">${SHAPES[kind]('url(#g)', dark)}</g></g></svg>`;

    const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    artCache.set(key, uri);
    return uri;
  }

  /* ---------- بيانات المنتجات ---------- */
  const S = ['S', 'M', 'L', 'XL'];
  const SH = ['40', '41', '42', '43', '44', '45'];

  const PRODUCTS = [
    {
      id: 1, name: 'تيشيرت قطن عضوي', category: 'clothes',
      price: 189, oldPrice: null, isNew: true, rating: 4.6, reviews: 128, stock: 24,
      sizes: S, soldOutSizes: [], art: 'tee', sku: 'NQ-TS-001', addedAt: '2026-09-10',
      colors: [{ name: 'أبيض', hex: '#f1eee7' }, { name: 'أسود', hex: '#1d1d1b' }, { name: 'رملي', hex: '#c9b79c' }],
      description: 'تيشيرت بقصّة مريحة من القطن العضوي بملمس ناعم يحافظ على شكله بعد الغسيل. تصميم بلا شعارات يناسب كل يوم.',
      details: ['قطن عضوي 100%', 'قصّة عادية مريحة', 'يُغسل في الغسالة على 30 درجة', 'خياطة مزدوجة عند الرقبة']
    },
    {
      id: 2, name: 'هودي أوفر سايز', category: 'clothes',
      price: 449, oldPrice: 599, isNew: false, rating: 4.8, reviews: 342, stock: 12,
      sizes: S, soldOutSizes: [], art: 'hoodie', sku: 'NQ-HD-002', addedAt: '2026-07-02',
      colors: [{ name: 'رمادي', hex: '#8e908f' }, { name: 'زيتوني', hex: '#5b6248' }, { name: 'أسود', hex: '#1d1d1b' }],
      description: 'هودي بقصّة واسعة من قطن فرنسي ثقيل مبطّن من الداخل بنعومة. جيب أمامي عميق وقبعة بحبل قابل للتعديل.',
      details: ['قطن فرنسي 380 غرام', 'بطانة داخلية ناعمة', 'جيب كنغر أمامي', 'قصّة أوفر سايز، اطلب مقاسك المعتاد']
    },
    {
      id: 3, name: 'جاكيت دنيم كلاسيكي', category: 'clothes',
      price: 699, oldPrice: null, isNew: true, rating: 4.5, reviews: 76, stock: 8,
      sizes: S, soldOutSizes: ['S'], art: 'jacket', sku: 'NQ-JK-003', addedAt: '2026-09-14',
      colors: [{ name: 'أزرق دنيم', hex: '#3f5b7e' }, { name: 'أسود', hex: '#222220' }],
      description: 'جاكيت دنيم بقصّة كلاسيكية وغسلة ناعمة. أزرار معدنية وجيوب أمامية تجمع بين الأناقة والعملية.',
      details: ['دنيم قطني 12 أونصة', 'أزرار معدنية مطفّية', 'جيبان أماميان وجيب داخلي', 'يُغسل مقلوباً بالماء البارد']
    },
    {
      id: 4, name: 'فستان كتان صيفي', category: 'clothes',
      price: 549, oldPrice: 690, isNew: false, rating: 4.7, reviews: 211, stock: 0,
      sizes: S, soldOutSizes: [], art: 'dress', sku: 'NQ-DR-004', addedAt: '2026-05-20',
      colors: [{ name: 'أخضر مريمي', hex: '#8fa08a' }, { name: 'كريمي', hex: '#e9dfcb' }, { name: 'أزرق سماوي', hex: '#8fa9c4' }],
      description: 'فستان من الكتان الطبيعي بقصّة واسعة تنساب مع الحركة وتمنح الجسم تهوية مثالية في الأيام الحارة.',
      details: ['كتان طبيعي 100%', 'بدون بطانة، خفيف الوزن', 'الطول حتى منتصف الساق', 'يُكوى على حرارة متوسطة']
    },
    {
      id: 5, name: 'بنطلون شينو مريح', category: 'clothes',
      price: 379, oldPrice: null, isNew: false, rating: 4.3, reviews: 95, stock: 30,
      sizes: S, soldOutSizes: ['XL'], art: 'pants', sku: 'NQ-PN-005', addedAt: '2026-06-11',
      colors: [{ name: 'كاكي', hex: '#b5a27e' }, { name: 'كحلي', hex: '#26324a' }],
      description: 'بنطلون شينو بقصّة مستقيمة وقماش قطني مرن يمنحك راحة طوال اليوم من الدوام حتى السهرة.',
      details: ['قطن مع 2% إيلاستان', 'قصّة مستقيمة', 'خصر مريح بجيوب جانبية', 'يحتفظ بلونه بعد الغسيل']
    },
    {
      id: 6, name: 'حقيبة جلد طبيعي', category: 'bags',
      price: 899, oldPrice: 1199, isNew: false, rating: 4.9, reviews: 187, stock: 6,
      sizes: [], soldOutSizes: [], art: 'bag', sku: 'NQ-BG-006', addedAt: '2026-04-03',
      colors: [{ name: 'بني', hex: '#7a4e2d' }, { name: 'أسود', hex: '#1d1d1b' }, { name: 'جملي', hex: '#b98555' }],
      description: 'حقيبة يد من الجلد الطبيعي المدبوغ نباتياً، بتصميم واسع يتّسع للابتوب الصغير ويزداد جمالاً مع الاستخدام.',
      details: ['جلد بقري مدبوغ نباتياً', 'بطانة قطنية وجيب بسحّاب', 'حزام كتف قابل للفك', 'الأبعاد 32 × 26 × 12 سم']
    },
    {
      id: 7, name: 'حذاء سنيكرز أبيض', category: 'shoes',
      price: 649, oldPrice: null, isNew: true, rating: 4.7, reviews: 264, stock: 15,
      sizes: SH, soldOutSizes: ['40'], art: 'shoe', sku: 'NQ-SN-007', addedAt: '2026-09-12',
      colors: [{ name: 'أبيض', hex: '#f4f4f2' }, { name: 'رمادي فاتح', hex: '#cfd0cc' }],
      description: 'سنيكرز جلدي بخطوط نظيفة ونعل مطاطي خفيف. يتماشى مع الجينز والبدلة على حدّ سواء.',
      details: ['جلد صناعي عالي الجودة', 'نعل مطاطي مضاد للانزلاق', 'بطانة داخلية قابلة للسحب', 'المقاسات أوروبية']
    },
    {
      id: 8, name: 'ساعة مينيمال', category: 'accessories',
      price: 1299, oldPrice: 1599, isNew: false, rating: 4.8, reviews: 143, stock: 5,
      sizes: [], soldOutSizes: [], art: 'watch', sku: 'NQ-WT-008', addedAt: '2026-03-15',
      colors: [{ name: 'فضي', hex: '#c9cbce' }, { name: 'ذهبي', hex: '#c7a54a' }, { name: 'أسود', hex: '#1d1d1b' }],
      description: 'ساعة بمينا نظيف وعقارب دقيقة وسوار من الستانلس ستيل. مقاومة للماء حتى 50 متراً.',
      details: ['حركة كوارتز يابانية', 'قطر العلبة 38 مم', 'زجاج ياقوت مقاوم للخدش', 'ضمان سنتين']
    },
    {
      id: 9, name: 'كاب قطني', category: 'accessories',
      price: 129, oldPrice: null, isNew: false, rating: 4.2, reviews: 61, stock: 40,
      sizes: [], soldOutSizes: [], art: 'cap', sku: 'NQ-CP-009', addedAt: '2026-05-02',
      colors: [{ name: 'أسود', hex: '#1d1d1b' }, { name: 'بيج', hex: '#cdbb9a' }, { name: 'كحلي', hex: '#26324a' }],
      description: 'كاب من القطن المغسول بحافة منحنية وإبزيم معدني خلفي لتعديل المقاس بسهولة.',
      details: ['قطن مغسول 100%', 'مقاس واحد قابل للتعديل', 'فتحات تهوية مطرّزة', 'حافة منحنية']
    },
    {
      id: 10, name: 'وشاح صوف ناعم', category: 'accessories',
      price: 259, oldPrice: null, isNew: true, rating: 4.6, reviews: 52, stock: 18,
      sizes: [], soldOutSizes: [], art: 'scarf', sku: 'NQ-SC-010', addedAt: '2026-09-08',
      colors: [{ name: 'رمادي', hex: '#9a9c9f' }, { name: 'نيلي', hex: '#3d4a8a' }, { name: 'عنابي', hex: '#7b2f3f' }],
      description: 'وشاح من مزيج الصوف والأكريليك بملمس دافئ لا يسبّب الحكّة، بأطراف مهدّبة وحجم يكفي للف مزدوج.',
      details: ['صوف 60% أكريليك 40%', 'الأبعاد 180 × 70 سم', 'يُغسل يدوياً', 'أطراف مهدّبة']
    },
    {
      id: 11, name: 'نظارة شمسية', category: 'accessories',
      price: 349, oldPrice: 449, isNew: false, rating: 4.4, reviews: 88, stock: 10,
      sizes: [], soldOutSizes: [], art: 'glasses', sku: 'NQ-SG-011', addedAt: '2026-05-28',
      colors: [{ name: 'أسود', hex: '#1d1d1b' }, { name: 'سلحفاة', hex: '#7b5334' }],
      description: 'نظارة بإطار خفيف وعدسات مستقطبة تحجب 100% من الأشعة فوق البنفسجية، مع علبة صلبة وقطعة تنظيف.',
      details: ['عدسات مستقطبة UV400', 'إطار أسيتات خفيف', 'مفصّلات معدنية', 'تشمل علبة صلبة']
    },
    {
      id: 12, name: 'محفظة جلدية رفيعة', category: 'bags',
      price: 229, oldPrice: null, isNew: false, rating: 4.5, reviews: 119, stock: 22,
      sizes: [], soldOutSizes: [], art: 'wallet', sku: 'NQ-WL-012', addedAt: '2026-06-24',
      colors: [{ name: 'بني', hex: '#7a4e2d' }, { name: 'أسود', hex: '#1d1d1b' }, { name: 'كحلي', hex: '#26324a' }],
      description: 'محفظة نحيفة تتّسع لـ 8 بطاقات وأوراق نقدية دون أن تنتفخ في الجيب. حماية RFID مدمجة.',
      details: ['جلد بقري ناعم', '8 فتحات بطاقات وجيب للنقود', 'حماية RFID', 'سماكة 7 مم فقط']
    }
  ];

  /* ---------- منتجات البائعين: تُقرأ من التخزين المحلي وتنضم للكتالوج ----------
     (نموذج تجريبي بلا خادم. عند الإطلاق تأتي هذه المنتجات من قاعدة البيانات) */
  const ART_BY_CAT = { clothes: 'tee', bags: 'bag', shoes: 'shoe', accessories: 'watch' };
  function readLS(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } }
  const SELLER = readLS('nasaq_seller_v1', null);
  if (SELLER) {
    const sellerRef = { id: SELLER.id, name: SELLER.name, slug: SELLER.slug };
    readLS('nasaq_sprod_v1', []).filter((x) => x && x.status === 'active').forEach((x) => {
      PRODUCTS.push(Object.assign({
        art: ART_BY_CAT[x.category] || 'tee', soldOutSizes: [], sizes: [], details: [], rating: 0, reviews: 0,
        colors: [{ name: 'أساسي', hex: '#c5cad3' }], sku: 'SL-' + x.id, oldPrice: null
      }, x, {
        colors: x.colors && x.colors.length ? x.colors : [{ name: 'أساسي', hex: '#c5cad3' }],
        isNew: Date.now() - new Date(x.addedAt).getTime() < 14 * 864e5,
        sellerId: SELLER.id, seller: sellerRef
      }));
    });
  }

  /* ---------- الصور: عشوائية مربوطة بالمنتج + رسمة احتياطية ---------- */
  const PHOTO_SIZES = { xs: [160, 200], sm: [320, 400], md: [480, 600], lg: [900, 1125] };

  function photoURL(p, i, colorIdx, size) {
    if (p.photos && p.photos.length) return p.photos[i % p.photos.length];
    const wh = PHOTO_SIZES[size] || PHOTO_SIZES.md;
    return STORE.photoHost + 'nq' + p.id + 'c' + (colorIdx || 0) + 'i' + (i % STORE.photoCount) + '/' + wh[0] + '/' + wh[1];
  }
  function photoCount(p) { return p.photos && p.photos.length ? p.photos.length : STORE.photoCount; }
  function gallery(p, colorIdx, size) {
    return Array.from({ length: photoCount(p) }, (_, i) => photoURL(p, i, colorIdx, size || 'md'));
  }
  function artFor(id, i, colorIdx) {
    const p = PRODUCTS.find((x) => x.id === Number(id));
    const c = p.colors[colorIdx || 0] || p.colors[0];
    return art(p.art, c.hex, (i || 0) % 4, p.id);
  }
  /* سمات img جاهزة: المصدر + مفتاح الرسمة الاحتياطية */
  function imgAttrs(p, i, colorIdx, size) {
    return ' src="' + photoURL(p, i, colorIdx, size) + '" data-art="' + p.id + '.' + i + '.' + (colorIdx || 0) + '"';
  }
  function setImg(img, p, i, colorIdx, size) {
    delete img.dataset.artDone;
    img.dataset.art = p.id + '.' + i + '.' + (colorIdx || 0);
    img.src = photoURL(p, i, colorIdx, size);
  }
  /* أي صورة تفشل (بلا إنترنت مثلاً) تُستبدل بالرسمة تلقائياً */
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.dataset || !img.dataset.art || img.dataset.artDone) return;
    img.dataset.artDone = '1';
    const a = img.dataset.art.split('.').map(Number);
    img.src = artFor(a[0], a[1], a[2]);
  }, true);

  PRODUCTS.forEach((p) => { p.images = gallery(p, 0); });

  /* ---------- الأكثر مبيعاً: الأعلى تقييمات داخل كل فئة ---------- */
  const bestIds = new Set();
  CATEGORIES.forEach((c) => {
    const top = PRODUCTS.filter((p) => p.category === c.id && p.stock > 0).sort((a, b) => b.reviews - a.reviews)[0];
    if (top) bestIds.add(top.id);
  });

  /* ---------- التوصيل: من سياسة المتجر (3 إلى 5 أيام عادي، 1 إلى 2 سريع) ---------- */
  const F_DAY = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric' });
  const F_MONTH = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long' });
  const F_FULL = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
  const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  function rangeText(a, b) {
    const d1 = F_DAY.format(a), d2 = F_DAY.format(b), m1 = F_MONTH.format(a), m2 = F_MONTH.format(b);
    return m1 === m2 ? d1 + ' و' + d2 + ' ' + m1 : d1 + ' ' + m1 + ' و' + d2 + ' ' + m2;
  }
  const delivery = {
    standard: () => 'بين ' + rangeText(inDays(3), inDays(5)),
    express: () => 'بين ' + rangeText(inDays(1), inDays(2)),
    fullDate: (n) => F_FULL.format(inDays(n))
  };
  const shipNote = (p) => (p.price >= STORE.freeShippingFrom ? 'شحن مجاني' : 'شحن مجاني فوق ' + money(STORE.freeShippingFrom));

  /* ---------- عدّاد العروض: ينتهي عند منتصف الليل (يتجدد يومياً) ---------- */
  function msToMidnight() {
    const n = new Date(), m = new Date(n);
    m.setHours(24, 0, 0, 0);
    return m - n;
  }
  function clock(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const two = (x) => String(x).padStart(2, '0');
    return two(Math.floor(t / 3600)) + ':' + two(Math.floor((t % 3600) / 60)) + ':' + two(t % 60);
  }

  const Products = {
    categories: CATEGORIES,
    all: () => PRODUCTS.slice(),
    byId: (id) => PRODUCTS.find((p) => p.id === Number(id)),
    categoryName: (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || '',
    discountPct: (p) => (p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0),
    isSoldOut: (p) => p.stock <= 0,
    sizeSoldOut: (p, s) => (p.soldOutSizes || []).includes(s),
    gallery, photoURL, photoCount, imgAttrs, setImg, artFor,
    normalize,
    isBestSeller: (p) => bestIds.has(p.id),
    sellerOf: (p) => p.seller || { id: 'official', name: STORE.name, slug: '' },
    delivery, shipNote, msToMidnight, clock,
    related(p, n) {
      const same = PRODUCTS.filter((x) => x.id !== p.id && x.category === p.category);
      const rest = PRODUCTS.filter((x) => x.id !== p.id && x.category !== p.category).sort((a, b) => b.rating - a.rating);
      return same.concat(rest).slice(0, n || 4);
    }
  };

  window.Store = { config: STORE, esc, money };
  window.Products = Products;
})();
