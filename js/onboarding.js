/* ==========================================================================
   js/onboarding.js — سلوك مشترك لصفحات: auth, become-seller, become-rider,
   application-status. لا يُحمَّل إلا في هذه الصفحات الأربع.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- تابات auth.html ---------- */
  function initAuthTabs() {
    const tabs = $$('.tab[data-tab]');
    if (!tabs.length) return;

    function activate(name) {
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
      $$('.auth-panel').forEach((p) => { p.hidden = p.id !== 'panel-' + name; });
    }

    tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.tab)));
    $$('[data-switch-tab]').forEach((b) => b.addEventListener('click', () => activate(b.dataset.switchTab)));

    /* الرابط auth.html?tab=signup يفتح تبويب إنشاء الحساب مباشرة (من قائمة الحساب في الهيدر) */
    const wanted = new URLSearchParams(location.search).get('tab');
    if (wanted && tabs.some((t) => t.dataset.tab === wanted)) activate(wanted);
  }

  /* ---------- مناطق رفع الملفات ---------- */
  function initDropzones() {
    $$('.dropzone').forEach((zone) => {
      const input = $('input[type="file"]', zone);
      const label = $('[data-dz-label]', zone);
      if (!input) return;
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        zone.classList.toggle('has-file', !!file);
        if (label) label.textContent = file ? file.name : label.dataset.default;
      });
    });
  }

  /* ---------- تأكيد كلمة المرور ---------- */
  function passwordsMatch(form) {
    const pass = $('[data-pass]', form);
    const confirm = $('[data-pass-confirm]', form);
    if (!pass || !confirm) return true;
    const ok = pass.value === confirm.value;
    confirm.setAttribute('aria-invalid', String(!ok));
    const err = $('#err-' + confirm.id, form);
    if (err) err.textContent = ok ? '' : 'كلمتا المرور غير متطابقتين';
    return ok;
  }

  /* ---------- إرسال نموذج التاجر / المندوب ---------- */
  function initApplicationForm(formId, accountType) {
    const form = $('#' + formId);
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!passwordsMatch(form)) { $('[data-pass-confirm]', form).focus(); return; }
      const terms = $('#f-terms', form);
      if (terms && !terms.checked) { terms.focus(); return; }

      const name = ($('[data-field-name]', form) || {}).value || '';
      const phone = ($('[data-field-phone]', form) || {}).value || '';
      const requestId = 'NSQ-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

      sessionStorage.setItem('nasaqApplication', JSON.stringify({
        requestId, accountType, name, phone, submittedAt: Date.now()
      }));
      if (window.NasaqCloud) {
        window.NasaqCloud.submitApplication({
          requestId, accountType, name, phone, email: ($('[data-field-email]', form) || {}).value || ''
        });
        window.NasaqCloud.syncUser({ name, phone, role: accountType === 'مندوب توصيل' ? 'rider' : 'seller' });
      }
      location.href = 'application-status.html';
    });
  }

  /* ---------- صفحة application-status ---------- */
  function initStatusPage() {
    const root = $('#request-details');
    if (!root) return;

    let data;
    try { data = JSON.parse(sessionStorage.getItem('nasaqApplication')); } catch (e) { data = null; }
    if (!data) data = { requestId: 'NSQ-' + new Date().getFullYear() + '-0000', accountType: 'حساب جديد', name: '', phone: '—', submittedAt: Date.now() };

    const minsAgo = Math.max(0, Math.round((Date.now() - data.submittedAt) / 60000));
    $('[data-d-id]').textContent = '#' + data.requestId;
    $('[data-d-type]').textContent = data.accountType;
    $('[data-d-phone]').textContent = data.phone || '—';
    $('[data-d-time]').textContent = minsAgo <= 1 ? 'الآن' : ('منذ ' + minsAgo + ' دقيقة');

    /* أرقام OTP */
    const boxes = $$('.otp input');
    boxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g, '').slice(0, 1);
        box.classList.toggle('is-filled', !!box.value);
        if (box.value && boxes[i + 1]) boxes[i + 1].focus();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && boxes[i - 1]) boxes[i - 1].focus();
      });
    });

    /* عداد إعادة الإرسال */
    const timerEl = $('#otp-timer');
    const resendBtn = $('#resend-btn');
    let seconds = 42;
    const tick = setInterval(() => {
      seconds -= 1;
      if (seconds <= 0) {
        clearInterval(tick);
        resendBtn.removeAttribute('disabled');
        resendBtn.textContent = 'إرسال الرمز عبر واتساب';
        return;
      }
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      timerEl.textContent = m + ':' + s;
    }, 1000);

    resendBtn.addEventListener('click', () => {
      if (resendBtn.hasAttribute('disabled')) return;
      UI.toast('تم إرسال رمز جديد عبر واتساب');
      seconds = 42;
      resendBtn.setAttribute('disabled', '');
    });

    /* تأكيد الرمز */
    const confirmBtn = $('#confirm-otp-btn');
    confirmBtn.addEventListener('click', () => {
      const code = boxes.map((b) => b.value).join('');
      if (code.length < boxes.length) {
        UI.toast('من فضلك أدخل الرمز كاملاً', { type: 'error' });
        boxes.find((b) => !b.value).focus();
        return;
      }
      $('.status-hero').hidden = true;
      $('.status-list').hidden = true;
      $('.status-details').hidden = true;
      $('.otp-section').hidden = true;
      $('.status-actions').hidden = true;
      $('.status-success').classList.add('is-visible');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initAuthTabs();
    initDropzones();
    initApplicationForm('seller-form', 'تاجر / صاحب متجر');
    initApplicationForm('rider-form', 'مندوب توصيل');
    initStatusPage();
  });
})();
