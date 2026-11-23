/* ==========================================================================
   FILE: js/auth.js
   KAAM: Student Login, 1-Device Lock Verification, Auto-Login (Session),
         Logout, aur Paid Notes ke liye Anti-Leak Watermark set karna.
   ========================================================================== */

const USER_SESSION_KEY = 'ph_logged_in_user';

/* --------------------------------------------------------------------------
   1. AUTH INITIALIZATION (APP KHULTE HI CHALEGA)
   Pehle phone ka Device ID dikhayega, phir check karega ki student pehle se
   login hai ya nahi.
   -------------------------------------------------------------------------- */
function initAuth() {
  // 1. Phone ka unique Device ID nikalo ya naya banao
  const myDeviceId = getOrCreateDeviceId();

  // Login screen aur Settings screen dono par Device ID dikhao
  const authDeviceEl = document.getElementById('auth-device-id');
  const settingsDeviceEl = document.getElementById('settings-device-id');
  if (authDeviceEl) authDeviceEl.textContent = myDeviceId;
  if (settingsDeviceEl) settingsDeviceEl.textContent = myDeviceId;

  // 2. Check karo ki kya student pehle se login hai (localStorage me)
  const savedSession = localStorage.getItem(USER_SESSION_KEY);
  if (savedSession) {
    try {
      const parsedUser = JSON.parse(savedSession);
      // Taza JSON data (AppState.users) ke sath dobara verify karo
      // Taaki agar Admin ne student ko block kiya ho ya naya course unlock kiya ho,
      // to turant update mil jaye!
      verifyAndLogin(parsedUser.mobile, parsedUser.name, true);
    } catch (e) {
      localStorage.removeItem(USER_SESSION_KEY);
    }
  }

  // 3. Login Form submit hone par kya hoga
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault(); // Page reload hone se rokna
      const mobile = document.getElementById('login-mobile').value.trim();
      const name = document.getElementById('login-name').value.trim();
      verifyAndLogin(mobile, name, false);
    });
  }

  // 4. Logout Button click hone par
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutUser);
  }
}

/* --------------------------------------------------------------------------
   2. MAIN LOGIN & 1-DEVICE LOCK VERIFICATION LOGIC
   isAutoLogin = true (jab app khud purana session check kare)
   isAutoLogin = false (jab student khud Login button dabaye)
   -------------------------------------------------------------------------- */
function verifyAndLogin(mobile, inputName, isAutoLogin = false) {
  const errorEl = document.getElementById('login-error');
  if (errorEl) errorEl.style.display = 'none';

  // Step A: 10-digit valid mobile number check
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    showLoginError('Kripya sahi 10-digit mobile number dalein.');
    return;
  }

  // Step B: Hamare JSON data (batch-2025.json) me student ko dhoondo
  const registeredUser = AppState.users.find((u) => u.mobile === mobile);
  const deviceLockOn = AppState.config?.security?.deviceLockEnabled ?? true;

  let finalUser = null;

  if (registeredUser) {
    // --- CASE 1: REGISTERED / PAID STUDENT ---

    // Check 1: Kya Admin ne is student ko block (active: false) kar rakha hai?
    if (registeredUser.active === false) {
      localStorage.removeItem(USER_SESSION_KEY);
      showLoginError('Aapka account block kar diya gaya hai. Admin se sampark karein.');
      return;
    }

    // Check 2: 1-DEVICE LOCK VERIFICATION
    // Agar JSON me Device ID save hai aur is phone ke ID se match nahi karta -> BLOCK!
    if (deviceLockOn && registeredUser.deviceId && registeredUser.deviceId !== AppState.deviceId) {
      localStorage.removeItem(USER_SESSION_KEY);
      showLoginError(
        `Ye ID pehle se kisi doosre mobile me login hai. Naye phone ke liye apna Device ID (${AppState.deviceId}) Admin ko bhejein.`
      );
      return;
    }

    // Sab kuch sahi hai! Student ka taza data (unlockedCourses ke sath) set karo
    finalUser = {
      mobile: registeredUser.mobile,
      name: registeredUser.name || inputName || 'Polytechnic Student',
      branch: registeredUser.branch || 'EE',
      semester: registeredUser.semester || 3,
      deviceId: AppState.deviceId,
      unlockedCourses: registeredUser.unlockedCourses || []
    };
  } else {
    // --- CASE 2: NAYA STUDENT (JISNE ABHI COURSE NAHI KHARIDA) ---
    // Inhe bhi app kholne denge taaki wo courses aur free demo dekh sakein
    // aur UPI QR se course kharid sakein.
    if (!inputName && !isAutoLogin) {
      showLoginError('Naye student hain to kripya apna naam bhi likhein.');
      return;
    }

    finalUser = {
      mobile: mobile,
      name: inputName || 'Student',
      branch: 'EE',
      semester: 3,
      deviceId: AppState.deviceId,
      unlockedCourses: [] // Abhi koi paid course unlock nahi hai
    };
  }

  // Step C: Session save karo aur App dikhao
  AppState.currentUser = finalUser;
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(finalUser));

  completeLoginUI(finalUser);

  if (!isAutoLogin) {
    showToast(`Welcome, ${finalUser.name}!`);
  }
}

/* --------------------------------------------------------------------------
   3. LOGIN SUCCESS KE BAAD UI UPDATE KARNA
   Login screen hatana, profile info bharna, aur Watermark set karna.
   -------------------------------------------------------------------------- */
function completeLoginUI(user) {
  // Login screen ko chhipa do
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.add('hidden');

  // Home aur Settings par student ka naam, mobile aur branch dikhao
  const homeName = document.getElementById('home-user-name');
  const headerBadge = document.getElementById('header-branch-badge');
  const settingsName = document.getElementById('settings-name');
  const settingsMobile = document.getElementById('settings-mobile');

  if (homeName) homeName.textContent = user.name;
  if (headerBadge) headerBadge.textContent = `${user.branch} • Sem ${user.semester}`;
  if (settingsName) settingsName.textContent = user.name;
  if (settingsMobile) settingsMobile.textContent = `+91 ${user.mobile}`;

  // Anti-Leak Watermark tayar karo (Paid notes kholne par ye dikhega)
  const watermarkEl = document.getElementById('watermark-layer');
  if (watermarkEl && AppState.config?.security?.watermarkEnabled) {
    watermarkEl.innerHTML = `${user.name}<br>${user.mobile}<br>${user.deviceId}`;
  }

  // Agar courses.js load ho chuka hai, to turant courses refresh karo
  // taaki student ke unlocked courses "Open" dikhein
  if (typeof renderAllCourses === 'function') {
    renderAllCourses();
  }
}

/* --------------------------------------------------------------------------
   4. LOGIN ERROR MESSAGE DIKHANA
   -------------------------------------------------------------------------- */
function showLoginError(msg) {
  const errorEl = document.getElementById('login-error');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
  showToast(msg, 3500);
}

/* --------------------------------------------------------------------------
   5. LOGOUT FUNCTION
   Session clear karega aur wapas Login screen par le aayega.
   (Note: Device ID localStorage me hi rahega, wo delete nahi hoga!)
   -------------------------------------------------------------------------- */
function logoutUser() {
  localStorage.removeItem(USER_SESSION_KEY);
  AppState.currentUser = null;

  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.remove('hidden');

  // Watermark chhipa do
  const watermarkEl = document.getElementById('watermark-layer');
  if (watermarkEl) watermarkEl.style.display = 'none';

  showToast('Aap logout ho gaye hain.');
}
