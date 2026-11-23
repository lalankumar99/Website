/* ==========================================================================
   फ़ाइल: sw.js
   काम: PWA सर्विस वर्कर - ऐप की मुख्य फ़ाइलों (HTML/CSS/JS) को कैश करके
         सुपर-फास्ट लोडिंग देना, जबकि JSON डेटा को हमेशा नेटवर्क से ताज़ा लाना।
   ========================================================================== */

const CACHE_NAME = 'polytechnic-hub-v1';

// ऐप की मुख्य स्थिर फ़ाइलें जिन्हें फ़ोन में कैश किया जाएगा
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/theme.css',
  './css/layout.css',
  './css/components.css',
  './css/animations.css',
  './js/utils.js',
  './js/auth.js',
  './js/courses.js',
  './js/payment.js',
  './js/admin.js',
  './js/app.js'
];

/* --------------------------------------------------------------------------
   1. इंस्टॉल इवेंट: ऐप की मुख्य फ़ाइलों को कैश में सेव करना
   -------------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* --------------------------------------------------------------------------
   2. एक्टिवेट इवेंट: पुराने वर्ज़न का कैश साफ़ करना
   -------------------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

/* --------------------------------------------------------------------------
   3. फ़ेच इवेंट: JSON हमेशा इंटरनेट से ताज़ा, बाकी फ़ाइलें कैश से तुरंत
   -------------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // JSON फ़ाइलों और GitHub API को कभी कैश से न दें (हमेशा ताज़ा डेटा लाएँ)
  if (url.includes('.json') || url.includes('api.github.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // HTML, CSS, JS के लिए: पहले कैश चेक करो, न मिले तो इंटरनेट से लाओ
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
