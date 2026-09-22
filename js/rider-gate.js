/* ==========================================================================
   js/rider-gate.js — يبدأ فحص حالة حساب المندوب (قيد المراجعة / مفعّل / مرفوض)
   فور تحميل الصفحة، بالتوازي مع باقي السكربتات. js/rider.js ينتظر هذا الفحص
   قبل عرض لوحة المندوب، فلا تظهر مهام توصيل حقيقية إلا بعد اعتماد الإدمن.
   ========================================================================== */
window.NasaqRiderGateReady = (async function () {
  const TOKEN_KEY = 'nasaq_access_token_v1';
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return { status: 'signed-out' };
    const response = await fetch('/api/rider/me', {
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + token }
    });
    if (response.status === 403) return { status: 'signed-out' };
    if (!response.ok) return { status: 'error' };
    const data = await response.json();
    if (!data || !data.rider) return { status: 'no-rider' };
    return { status: data.rider.status || 'pending', rider: data.rider };
  } catch (_) {
    return { status: 'offline' };
  }
})();
