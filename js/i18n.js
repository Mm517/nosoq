/* ==========================================================================
   js/i18n.js — الترجمة بلغات كثيرة (window.I18n)

   الأسلوب: مترجم مواقع جوجل (Google Website Translator). واجهتنا الخاصة لاختيار اللغة، والترجمة
   الفعلية تتم بعد تحميل سكربت جوجل، فتشمل كل النصوص بما فيها المحتوى الذي يُنشأ ديناميكياً
   (المنتجات، لوحة البائع…). اللغة الأصلية للموقع: العربية.

   • عند اختيار لغة نضبط اتجاه الصفحة (RTL/LTR) فوراً وتُحفظ في localStorage.
   • الترجمة آلية: قد تختلف صياغة الأسماء والأوصاف. لما تحتاج نصوصاً مراجَعة بشرياً للغات معيّنة
     يمكن إضافة قاموس داخلي لاحقاً (الملف مصمم ليتحمل ذلك).
   • بدون اتصال بالإنترنت أو على file:// لن تعمل الترجمة (يحتاج الوصول لخوادم جوجل).
   ========================================================================== */
(function () {
  'use strict';

  const KEY = 'nasaq_lang_v1';
  const SOURCE = 'ar';
  /* [الكود عند جوجل، الاسم بلغته، اتجاه الكتابة] */
  const LANGS = [
    ['ar', 'العربية', 'rtl'], ['en', 'English']
    
  
  ];
  const by = (code) => LANGS.find((l) => l[0] === code) || LANGS[0];

  function current() {
    try { const c = localStorage.getItem(KEY); return LANGS.some((l) => l[0] === c) ? c : SOURCE; } catch (_) { return SOURCE; }
  }
  const dirOf = (code) => (by(code)[2] === 'rtl' ? 'rtl' : 'ltr');

  function applyDir(code) {
    const root = document.documentElement;
    root.setAttribute('dir', dirOf(code));
    root.setAttribute('lang', code === 'zh-CN' ? 'zh' : code);
  }

  /* كوكي googtrans يقرؤها مترجم جوجل: /اللغة الأصلية/اللغة الهدف */
  function setCookie(val) {
    const host = location.hostname;
    const exp = val ? '' : '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    const v = val || '';
    document.cookie = 'googtrans=' + v + '; path=/' + exp;
    if (host && host.indexOf('.') > -1) document.cookie = 'googtrans=' + v + '; path=/; domain=' + host + exp;
  }

  function set(code) {
    try { localStorage.setItem(KEY, code); } catch (_) { /* تجاهل */ }
    setCookie(code === SOURCE ? '' : '/' + SOURCE + '/' + code);
    location.reload();
  }

  function boot() {
    const code = current();
    applyDir(code);
    if (code === SOURCE) { setCookie(''); return; }
    setCookie('/' + SOURCE + '/' + code);
    if (document.getElementById('google_translate_element')) return;
    const holder = document.createElement('div');
    holder.id = 'google_translate_element';
    holder.setAttribute('aria-hidden', 'true');
    document.body.appendChild(holder);
    window.nqTranslateInit = function () {
      /* eslint-disable-next-line no-new */
      new window.google.translate.TranslateElement({
        pageLanguage: SOURCE, autoDisplay: false, layout: 0,
        includedLanguages: LANGS.map((l) => l[0]).filter((c) => c !== SOURCE).join(',')
      }, 'google_translate_element');
    };
    const sc = document.createElement('script');
    sc.async = true;
    sc.src = 'https://translate.google.com/translate_a/element.js?cb=nqTranslateInit';
    document.head.appendChild(sc);
  }

  /* ---------- الواجهة ---------- */
  function label() { return by(current())[1]; }
  function shortCode() { return current().split('-')[0].toUpperCase(); }

  function modalHTML(icon) {
    const cur = current();
    return '<div class="modal modal--lang" id="lang-modal" role="dialog" aria-modal="true" aria-labelledby="lang-title" aria-hidden="true">' +
      '<div class="modal__head"><h2 id="lang-title">اللغة / Language</h2>' +
        '<button type="button" class="icon-btn" data-panel-close aria-label="إغلاق">' + icon('close') + '</button></div>' +
      '<div class="modal__body">' +
        '<div class="lang-grid notranslate" translate="no" role="radiogroup" aria-label="اختر اللغة">' +
          LANGS.map((l) => '<button type="button" class="chip lang" role="radio" lang="' + l[0] + '" dir="' + (l[2] || 'ltr') + '" aria-checked="' + (l[0] === cur) + '" data-lang="' + l[0] + '">' + l[1] + '</button>').join('') +
        '</div>' +
        '<p class="lang-note">الترجمة آلية بواسطة Google Translate، وقد تختلف صياغة بعض الأسماء والأوصاف.</p>' +
      '</div></div>';
  }

  window.I18n = { LANGS, current, set, boot, label, shortCode, modalHTML, dirOf };
  /* نضبط الاتجاه مبكراً قدر الإمكان لتجنّب وميض الاتجاه الخاطئ */
  applyDir(current());
})();
