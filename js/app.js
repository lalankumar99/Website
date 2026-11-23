/* ==========================================================================
   फ़ाइल: js/app.js
   काम: पूरे ऐप को शुरू करना, JSON डेटा लोड करना, डार्क/लाइट थीम कंट्रोल करना,
         बॉटम नेविगेशन टैब बदलना, और PWA सर्विस वर्कर रजिस्टर करना।
   ========================================================================== */

const THEME_STORAGE_KEY = 'ph_theme_mode'; // थीम की पसंद सेव रखने की कुंजी

/* --------------------------------------------------------------------------
   1. ऐप स्टार्टअप (पेज लोड होते ही सबसे पहले यही चलेगा)
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  // चरण 1: सबसे पहले सेव की गई थीम (लाइट या डार्क) लागू करो
  initTheme();

  // चरण 2: बॉटम नेविगेशन और डिवाइस ID कॉपी बटन सेट करो
  initNavigation();
  initSettingsActions();

  // चरण 3: सभी ज़रूरी JSON फ़ाइलें एक साथ (समानांतर) लोड करो ताकि समय बचे
  const [configData, catalogData, usersData, noticesData] = await Promise.all([
    fetchJSON('data/app/config.json'),
    fetchJSON('data/courses/catalog.json'),
    fetchJSON('data/users/batch-2025.json'),
    fetchJSON('data/app/notices.json') // अगर यह फ़ाइल अभी नहीं बनी है, तो null आएगा
  ]);

  // लोड किए गए डेटा को ग्लोबल AppState में रखो
  AppState.config = configData || {};
  AppState.courses = catalogData?.courses || [];
  AppState.users = usersData?.users || [];

  // अगर ऐप मेंटेनेंस मोड में है, तो छात्रों को सूचना दिखाओ
  if (AppState.config.maintenanceMode) {
    document.body.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; font-family: sans-serif;">
        <h2>Polytechnic Hub</h2>
        <p style="margin-top: 12px; color: #475569;">
          ${AppState.config.maintenanceMessage || 'ऐप अपडेट हो रहा है, कृपया कुछ देर बाद खोलें।'}
        </p>
      </div>
    `;
    return;
  }

  // सेटिंग्स में ऐप का वर्ज़न नंबर अपडेट करो
  const versionEl = document.getElementById('admin-secret-trigger');
  if (versionEl && AppState.config.appVersion) {
    versionEl.textContent = `${AppState.config.appName || 'Polytechnic Hub'} • v${AppState.config.appVersion}`;
  }

  // होम स्क्रीन पर नोटिस दिखाओ
  renderHomeNotices(noticesData?.notices || []);

  // चरण 4: बाकी सभी मॉड्यूल्स (लॉगिन, कोर्स, पेमेंट, एडमिन) शुरू करो
  initCourses();
  initPayment();
  initAdmin();
  initAuth(); // लॉगिन चेक सबसे अंत में ताकि यूज़र्स और कोर्स डेटा पहले से तैयार रहे

  // अगर छात्र पहले से लॉगिन नहीं है, तब भी बैकग्राउंड में कोर्स रेंडर कर दो
  renderAllCourses();

  // चरण 5: PWA सर्विस वर्कर रजिस्टर करो
  registerServiceWorker();
});

/* --------------------------------------------------------------------------
   2. थीम सिस्टम (डिफ़ॉल्ट Pure White + इंस्टेंट डार्क मोड)
   -------------------------------------------------------------------------- */
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  applyTheme(savedTheme);

  // सेटिंग्स के अंदर डार्क मोड स्विच
  const darkToggle = document.getElementById('dark-mode-toggle');
  if (darkToggle) {
    darkToggle.checked = savedTheme === 'dark';
    darkToggle.addEventListener('change', (e) => {
      const nextTheme = e.target.checked ? 'dark' : 'light';
      applyTheme(nextTheme);
    });
  }

  // ऊपर हेडर में मौजूद क्विक थीम बटन
  const headerThemeBtn = document.getElementById('header-theme-btn');
  if (headerThemeBtn) {
    headerThemeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  // सेटिंग्स स्विच को भी थीम के साथ सिंक रखो
  const darkToggle = document.getElementById('dark-mode-toggle');
  if (darkToggle) {
    darkToggle.checked = theme === 'dark';
  }
}

/* --------------------------------------------------------------------------
   3. बॉटम नेविगेशन (बिना पेज रीलोड के टैब बदलना)
   -------------------------------------------------------------------------- */
function initNavigation() {
  const navButtons = document.querySelectorAll('.bottom-nav .nav-item');

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      if (targetTab) {
        switchTab(targetTab);
      }
    });
  });
}

function switchTab(tabName) {
  // सभी व्यू और नेविगेशन बटन से active क्लास हटाओ
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.bottom-nav .nav-item').forEach((b) => b.classList.remove('active'));

  // चुने गए टैब और उसके बटन को सक्रिय (active) करो
  const targetView = document.getElementById(`view-${tabName}`);
  const targetBtn = document.querySelector(`.bottom-nav .nav-item[data-tab="${tabName}"]`);

  if (targetView) targetView.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  // हर बार नया टैब खुलने पर स्क्रीन को सबसे ऊपर स्क्रॉल करो
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* --------------------------------------------------------------------------
   4. सेटिंग्स के अन्य बटन (डिवाइस ID कॉपी करना)
   -------------------------------------------------------------------------- */
function initSettingsActions() {
  const copyBtn = document.getElementById('copy-device-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (AppState.deviceId) {
        copyToClipboard(AppState.deviceId);
      }
    });
  }
}

/* --------------------------------------------------------------------------
   5. होम स्क्रीन पर नोटिस दिखाना
   -------------------------------------------------------------------------- */
function renderHomeNotices(notices) {
  const container = document.getElementById('home-notices');
  if (!container) return;

  if (!notices || notices.length === 0) {
    container.innerHTML = `
      <div class="card">
        <span class="badge badge-warning" style="margin-bottom: 6px;">सूचना</span>
        <p style="font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">
          Polytechnic Hub में आपका स्वागत है! सभी ब्रांच के नए नोट्स और PYQ जल्द अपडेट हो रहे हैं।
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = notices
    .slice(0, 2)
    .map(
      (n) => `
      <div class="card">
        <span class="badge badge-primary" style="margin-bottom: 6px;">${n.tag || 'अपडेट'}</span>
        <p style="font-size: 0.86rem; font-weight: 600;">${n.title}</p>
        <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">${n.date || ''}</p>
      </div>
    `
    )
    .join('');
}

/* --------------------------------------------------------------------------
   6. PWA सर्विस वर्कर रजिस्टर करना
   -------------------------------------------------------------------------- */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('Service Worker रजिस्टर नहीं हुआ:', err));
  }
}
