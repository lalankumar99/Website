/* ==========================================================================
   फ़ाइल: js/admin.js
   काम: 3-लेयर सिक्योर एडमिन लॉगिन (5-टैप ट्रिगर + SHA-256 पासवर्ड + GitHub टोकन)
         और सीधे GitHub API के ज़रिए छात्रों का कोर्स अनलॉक व डिवाइस लॉक अपडेट करना।
   ========================================================================== */

const ADMIN_TOKEN_KEY = 'ph_admin_session_token'; // टोकन सिर्फ़ सेशन स्टोरेज में रहेगा
let secretTapCount = 0;                           // वर्ज़न नंबर पर टैप गिनने के लिए
let secretTapTimer = null;                        // टैप रीसेट करने का टाइमर

/* --------------------------------------------------------------------------
   1. एडमिन पैनल की शुरुआत (लेयर 1: हिडन 5-टैप ट्रिगर)
   सेटिंग्स में सबसे नीचे लिखे वर्ज़न नंबर पर लगातार 5 बार टैप करने पर ही
   एडमिन लॉगिन का पैनल खुलेगा।
   -------------------------------------------------------------------------- */
function initAdmin() {
  const triggerEl = document.getElementById('admin-secret-trigger');

  if (triggerEl) {
    triggerEl.addEventListener('click', () => {
      secretTapCount++;

      // अगर 2 सेकंड के अंदर अगला टैप नहीं हुआ, तो गिनती फिर से 0 हो जाएगी
      clearTimeout(secretTapTimer);
      secretTapTimer = setTimeout(() => {
        secretTapCount = 0;
      }, 2000);

      // लगातार 5 टैप पूरे होते ही एडमिन शीट खोलो
      if (secretTapCount >= 5) {
        secretTapCount = 0;
        openAdminPanel();
      }
    });
  }

  // एडमिन लॉगिन बटन पर क्लिक इवेंट
  const adminLoginBtn = document.getElementById('admin-login-btn');
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', handleAdminLogin);
  }

  // छात्र का डेटा GitHub पर सेव करने वाले बटन पर क्लिक इवेंट
  const saveUserBtn = document.getElementById('admin-save-user-btn');
  if (saveUserBtn) {
    saveUserBtn.addEventListener('click', saveStudentToGitHub);
  }
}

/* --------------------------------------------------------------------------
   2. एडमिन शीट खोलना
   अगर इस सेशन में एडमिन पहले से लॉगिन है, तो सीधे डैशबोर्ड दिखेगा।
   -------------------------------------------------------------------------- */
function openAdminPanel() {
  const savedToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const loginBox = document.getElementById('admin-login-box');
  const dashboardBox = document.getElementById('admin-dashboard-box');

  if (savedToken) {
    loginBox.style.display = 'none';
    dashboardBox.style.display = 'block';
  } else {
    loginBox.style.display = 'block';
    dashboardBox.style.display = 'none';
  }

  openSheet('admin-sheet');
}

/* --------------------------------------------------------------------------
   3. लेयर 2 और लेयर 3: SHA-256 पासवर्ड + GitHub टोकन वेरिफिकेशन
   कोड में कहीं भी असली पासवर्ड या टोकन सेव नहीं किया जाता।
   -------------------------------------------------------------------------- */
async function handleAdminLogin() {
  const passInput = document.getElementById('admin-pass');
  const tokenInput = document.getElementById('admin-token');

  const password = passInput.value.trim();
  const token = tokenInput.value.trim();

  if (!password || !token) {
    showToast('कृपया एडमिन पासवर्ड और GitHub टोकन दोनों डालें।');
    return;
  }

  // डाले गए पासवर्ड का SHA-256 हैश निकालो और config.json के हैश से मिलाओ
  const enteredHash = await generateSHA256(password);
  const storedHash = AppState.config?.security?.adminPasswordHash;

  if (enteredHash !== storedHash) {
    showToast('गलत एडमिन पासवर्ड!');
    return;
  }

  // पासवर्ड सही होने पर टोकन को सिर्फ़ sessionStorage में रखो (ऐप बंद होते ही मिट जाएगा)
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);

  // इनपुट बॉक्स साफ़ करो और डैशबोर्ड दिखाओ
  passInput.value = '';
  tokenInput.value = '';
  document.getElementById('admin-login-box').style.display = 'none';
  document.getElementById('admin-dashboard-box').style.display = 'block';

  showToast('एडमिन पैनल अनलॉक हो गया!');
}

/* --------------------------------------------------------------------------
   4. GitHub API से सीधे 1-क्लिक में छात्र का कोर्स अनलॉक और डिवाइस लॉक करना
   यह फ़ंक्शन GitHub से मौजूदा batch-2025.json फ़ाइल लाता है, उसमें नया डेटा
   जोड़ता है और वापस GitHub पर सेव (Commit) कर देता है।
   -------------------------------------------------------------------------- */
async function saveStudentToGitHub() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const ghConfig = AppState.config?.github;

  if (!token || !ghConfig) {
    showToast('एडमिन सेशन या GitHub सेटिंग्स अधूरी हैं।');
    return;
  }

  // फ़ॉर्म से छात्र की जानकारी लो
  const mobile = document.getElementById('adm-stu-mobile').value.trim();
  const name = document.getElementById('adm-stu-name').value.trim();
  const deviceId = document.getElementById('adm-stu-device').value.trim();
  const courseId = document.getElementById('adm-stu-course').value.trim();

  if (!/^[6-9]\d{9}$/.test(mobile) || !courseId) {
    showToast('सही 10-अंकों का मोबाइल नंबर और कोर्स ID ज़रूरी है।');
    return;
  }

  const saveBtn = document.getElementById('admin-save-user-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'GitHub पर सेव हो रहा है...';

  const filePath = 'data/users/batch-2025.json';
  const apiUrl = `https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${filePath}`;

  try {
    // चरण 1: GitHub से मौजूदा users फ़ाइल और उसका SHA कोड मँगाओ
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!getRes.ok) {
      throw new Error('GitHub से फ़ाइल नहीं मिल सकी। अपना टोकन जाँचें।');
    }

    const fileData = await getRes.json();
    const fileSha = fileData.sha; // अपडेट करने के लिए यह SHA ज़रूरी होता है

    // Base64 डेटा को वापस सामान्य JSON में बदलो
    const decodedText = decodeURIComponent(escape(atob(fileData.content)));
    const usersJson = JSON.parse(decodedText);

    // चरण 2: चेक करो कि यह छात्र पहले से लिस्ट में है या नया है
    const existingIndex = usersJson.users.findIndex((u) => u.mobile === mobile);

    if (existingIndex !== -1) {
      // पुराना छात्र: उसका डिवाइस ID अपडेट करो और नया कोर्स जोड़ो
      const userObj = usersJson.users[existingIndex];
      if (name) userObj.name = name;
      if (deviceId) userObj.deviceId = deviceId;
      if (!userObj.unlockedCourses.includes(courseId)) {
        userObj.unlockedCourses.push(courseId);
      }
      userObj.active = true;
    } else {
      // नया छात्र: लिस्ट में नई एंट्री जोड़ो
      usersJson.users.push({
        mobile: mobile,
        name: name || 'Polytechnic Student',
        branch: 'EE',
        semester: 3,
        deviceId: deviceId || '',
        unlockedCourses: [courseId],
        active: true,
        joinedDate: new Date().toISOString().split('T')[0]
      });
    }

    // चरण 3: अपडेटेड JSON को वापस Base64 में बदलकर GitHub पर सेव (PUT) करो
    const updatedString = JSON.stringify(usersJson, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(updatedString)));

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Unlock ${courseId} for ${mobile}`,
        content: encodedContent,
        sha: fileSha,
        branch: ghConfig.branch || 'main'
      })
    });

    if (!putRes.ok) {
      throw new Error('GitHub पर सेव नहीं हो पाया। टोकन की परमिशन जाँचें।');
    }

    // लोकल AppState को भी तुरंत अपडेट कर दो
    AppState.users = usersJson.users;

    // फ़ॉर्म साफ़ करो
    document.getElementById('adm-stu-mobile').value = '';
    document.getElementById('adm-stu-name').value = '';
    document.getElementById('adm-stu-device').value = '';
    document.getElementById('adm-stu-course').value = '';

    showToast('कोर्स सफलतापूर्वक अनलॉक और सेव हो गया!');
    closeSheet('admin-sheet');
  } catch (error) {
    console.error('Admin GitHub Error:', error);
    showToast(error.message || 'कुछ गड़बड़ हो गई।', 3500);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save & Unlock on GitHub';
  }
}
