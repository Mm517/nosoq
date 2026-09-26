/* ==========================================================================
   js/buyer-location.js — موقع المشتري (window.BuyerLocation)

   يوفّر موقع المشتري (lat/lng) بشكل متزامن حتى يقدر js/products.js يستخدمه
   وهو بيبني الكتالوج (buildCatalog يشتغل بطلب XHR متزامن قبل أي رسم للصفحة).

   مصدر الموقع بالترتيب:
   1) لو المستخدم مسجّل دخول: يُقرأ latitude/longitude من صفّه في marketplace_users
      (نفس الموقع اللي اتحفظ عند التسجيل أو من صفحة "حسابي" — وليس localStorage،
      عشان يبقى نفس الموقع من أي جهاز يسجّل بيه دخول). بيتقرا بطلب متزامن خفيف
      (٢ عمودين بس) ويتخزّن مؤقتاً في localStorage كـ cache لتسريع الزيارات التالية
      لنفس الجلسة، لكن دايماً بيتراجع فعلياً من القاعدة عند كل تحميل صفحة.
   2) لو "زائر" بدون حساب: يُقرأ من localStorage (نتيجة ضغط المستخدم على
      «استخدم موقعي الحالي» في شريط التنبيه بأعلى الصفحة) — ده بس محلي بالمتصفح.

   لازم يتحمّل بعد js/nasaq-config.js وقبل js/products.js (بشكل متزامن، بدون defer).
   ========================================================================== */
(function () {
  'use strict';

  const CACHE_KEY = 'nasaq_buyer_loc_v1';
  const GUEST_KEY = 'nasaq_guest_loc_v1';
  const SESSION_KEY = 'nasaq_session_v1';

  function readJSON(k) {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; }
  }
  function writeJSON(k, v) {
    try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* تجاهل */ }
  }
  function getSession() { return readJSON(SESSION_KEY); }

  function valid(v) {
    return v && typeof v.lat === 'number' && typeof v.lng === 'number' && isFinite(v.lat) && isFinite(v.lng);
  }

  /* قراءة موقع المستخدم المسجَّل من marketplace_users — طلب متزامن خفيف (نفس أسلوب sbGet في products.js) */
  function fetchProfileLocation(userId) {
    try {
      const xhr = new XMLHttpRequest();
      const url = window.NASAQ_SUPABASE_URL + '/rest/v1/marketplace_users?select=latitude,longitude&external_id=eq.' +
        encodeURIComponent(userId) + '&limit=1';
      xhr.open('GET', url, false);
      xhr.setRequestHeader('apikey', window.NASAQ_SUPABASE_ANON_KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + window.NASAQ_SUPABASE_ANON_KEY);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        const rows = JSON.parse(xhr.responseText || '[]');
        const row = rows[0];
        if (row && row.latitude != null && row.longitude != null) {
          return { lat: Number(row.latitude), lng: Number(row.longitude) };
        }
      }
    } catch (err) {
      console.error('[nasaq] تعذّر قراءة موقع الحساب:', err);
    }
    return null;
  }

  /* الموقع الحالي (lat/lng) أو null لو غير معروف. متزامن — يُستدعى مرة عند تحميل الصفحة. */
  function get() {
    const session = getSession();
    if (session && session.userId) {
      const fromProfile = fetchProfileLocation(session.userId);
      if (valid(fromProfile)) {
        const v = Object.assign({ source: 'profile' }, fromProfile);
        writeJSON(CACHE_KEY, v);
        return v;
      }
      /* الحساب مسجَّل لكن ما حدّدش موقعه (حسابات قديمة قبل إلزامية الموقع) — لا نستخدم
         موقع "زائر" قديم قد يخص شخصاً آخر استخدم نفس الجهاز؛ نطلب تحديد الموقع بوضوح. */
      return null;
    }
    const guest = readJSON(GUEST_KEY);
    return valid(guest) ? Object.assign({ source: 'guest' }, guest) : null;
  }

  /* يُستدعى بعد نجاح GPS/بحث عنوان لزائر بدون حساب (من شريط التنبيه في shop/home) */
  function setGuestLocation(lat, lng) {
    const v = { lat: Number(lat), lng: Number(lng) };
    writeJSON(GUEST_KEY, v);
    writeJSON(CACHE_KEY, Object.assign({ source: 'guest' }, v));
    return v;
  }

  /* يطلب GPS المتصفح مباشرة (زر «استخدم موقعي الحالي» في شريط التنبيه) */
  function locateGuest() {
    if (!window.Geo) return Promise.reject(new Error('أداة تحديد الموقع غير متاحة الآن.'));
    return window.Geo.locate().then((p) => setGuestLocation(p.lat, p.lng));
  }

  function clearGuest() { writeJSON(GUEST_KEY, null); writeJSON(CACHE_KEY, null); }

  window.BuyerLocation = { get, setGuestLocation, locateGuest, clearGuest };
})();
