/* ==========================================================================
   FILE: js/utils.js
   KAAM: Poore app ke common helper functions (Device ID, Toast, Bottom Sheet,
         SHA-256 Hash, aur Fast JSON Fetch) ko ek jagah rakhna.
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. GLOBAL APP STATE (POORE APP KA SHARED DATA)
   Config, Users, Courses, aur abhi login kiye hue student ka data yahan
   store rahega taaki har JS file ise aasani se access kar sake.
   -------------------------------------------------------------------------- */
const AppState = {
  config: null,         // data/app/config.json ka data
  courses: [],          // data/courses/catalog.json ke saare courses
  users: [],            // data/users/batch-2025.json ke saare students
  currentUser: null,    // Abhi jo student login hai uski details
  deviceId: null        // Is phone ka permanent unique Device ID
};

/* --------------------------------------------------------------------------
   2. UNIQUE DEVICE ID GENERATOR (1-DEVICE LOCK KE LIYE)
   Jab student pehli baar app kholega, ye function ek unique code (jaise
   DEV-7X92K) banakar phone ke localStorage me hamesha ke liye save kar dega.
   -------------------------------------------------------------------------- */
function getOrCreateDeviceId() {
  const STORAGE_KEY = 'ph_device_id';
  let savedId = localStorage.getItem(STORAGE_KEY);

  // Agar is phone me pehle se Device ID nahi bana hai, to naya banao
  if (!savedId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Confusing letters (0,O,1,I) hataye hain
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    savedId = `DEV-${randomPart}`;
    localStorage.setItem(STORAGE_KEY, savedId);
  }

  AppState.deviceId = savedId;
  return savedId;
}

/* --------------------------------------------------------------------------
   3. TOAST NOTIFICATION (NEECHE AANE WALA CHHOTA MESSAGE)
   Use: showToast("Device ID Copied!");
   -------------------------------------------------------------------------- */
let toastTimer = null;

function showToast(message, duration = 2500) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;

  toastEl.textContent = message;
  toastEl.classList.add('show');

  // Agar pehle se koi toast chal raha ho to uska timer reset karo
  if (toastTimer) clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

/* --------------------------------------------------------------------------
   4. ANDROID BOTTOM SHEET CONTROLS (OPEN / CLOSE)
   Payment QR sheet aur Admin sheet dono ko kholne-band karne ke liye.
   -------------------------------------------------------------------------- */
function openSheet(sheetId) {
  const sheet = document.getElementById(sheetId);
  if (sheet) {
    sheet.classList.add('open');
    // Sheet khulne par peeche ka page scroll na ho
    document.body.style.overflow = 'hidden';
  }
}

function closeSheet(sheetId) {
  const sheet = document.getElementById(sheetId);
  if (sheet) {
    sheet.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Agar user sheet ke bahar (dark area par) click kare to sheet band ho jaye
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('sheet-backdrop')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

/* --------------------------------------------------------------------------
   5. FRESH JSON FETCH HELPER (NO STALE CACHE)
   GitHub Pages kabhi-kabhi purani JSON file cache kar leta hai. URL ke aage
   '?t=timestamp' lagane se hamesha bilkul taza (fresh) data load hota hai.
   -------------------------------------------------------------------------- */
async function fetchJSON(path) {
  try {
    const freshUrl = `${path}?t=${Date.now()}`;
    const response = await fetch(freshUrl);
    if (!response.ok) {
      throw new Error(`File load nahi hui: ${path}`);
    }
    return await response.json();
  } catch (error) {
    console.error('JSON Fetch Error:', error);
    return null;
  }
}

/* --------------------------------------------------------------------------
   6. SHA-256 HASH GENERATOR (ADMIN PASSWORD SECURITY KE LIYE)
   Ye browser ke built-in Web Crypto API se kisi bhi text ko secure SHA-256
   hash me badal deta hai. Bina kisi external library ke 100% fast chalta hai.
   -------------------------------------------------------------------------- */
async function generateSHA256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Bytes ko hex string me convert karna
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* --------------------------------------------------------------------------
   7. CLIPBOARD COPY HELPER (DEVICE ID COPY KARNE KE LIYE)
   -------------------------------------------------------------------------- */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copy ho gaya: ' + text);
  } catch (err) {
    // Purane mobile browsers ke liye fallback तरीका
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast('Copy ho gaya: ' + text);
  }
}
