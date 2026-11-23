/* ==========================================================================
   FILE: js/courses.js
   KAAM: Catalog se Course Cards render karna (Home, All Courses, My Courses),
         Branch Filter chips chalana, aur Course kholne par Lazy Loading +
         Anti-Leak Watermark dikhana.
   ========================================================================== */

let activeBranchFilter = 'ALL'; // Default me sabhi branches ke courses dikhenge

/* --------------------------------------------------------------------------
   1. COURSES INITIALIZATION (BRANCH FILTER BUTTONS SET KARNA)
   -------------------------------------------------------------------------- */
function initCourses() {
  const filterContainer = document.getElementById('branch-filters');
  if (!filterContainer) return;

  // Har filter chip (All, EE, ME, CE, CSE) par click event lagana
  filterContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    // Purane active chip se class hatao aur naye par lagao
    filterContainer.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');

    // Selected branch save karo aur list refresh karo
    activeBranchFilter = chip.dataset.branch || 'ALL';
    renderFilteredCourses();
  });
}

/* --------------------------------------------------------------------------
   2. SAARE SECTIONS ME COURSES RENDER KARNA
   Login hone ke baad ya data load hone ke baad ye function call hoga.
   -------------------------------------------------------------------------- */
function renderAllCourses() {
  renderHomeCourses();
  renderFilteredCourses();
  renderMyCourses();
}

/* --------------------------------------------------------------------------
   3. HOME TAB: POPULAR COURSES (TOP 3 COURSES)
   Home screen halki aur fast rahe, isliye yahan sirf top 3 courses dikhayenge.
   -------------------------------------------------------------------------- */
function renderHomeCourses() {
  const container = document.getElementById('home-courses-list');
  if (!container) return;

  if (!AppState.courses || AppState.courses.length === 0) {
    container.innerHTML = `<div class="card"><p style="font-size: 0.85rem; color: var(--text-secondary);">Abhi koi course uplabdh nahi hai.</p></div>`;
    return;
  }

  // Sirf pehle 3 courses uthao
  const featured = AppState.courses.slice(0, 3);
  container.innerHTML = featured.map((course) => buildCourseCardHTML(course)).join('');
}

/* --------------------------------------------------------------------------
   4. COURSES TAB: BRANCH FILTER KE HISAB SE COURSES
   -------------------------------------------------------------------------- */
function renderFilteredCourses() {
  const container = document.getElementById('all-courses-list');
  if (!container) return;

  // Agar 'ALL' hai to saare dikhao, warna sirf selected branch wale
  const filtered =
    activeBranchFilter === 'ALL'
      ? AppState.courses
      : AppState.courses.filter((c) => c.branch === activeBranchFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 24px;">
        <p style="font-size: 0.9rem; font-weight: 600;">Is branch ka course jald aayega!</p>
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
          Abhi aap "All" par click karke baaki courses dekh sakte hain.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((course) => buildCourseCardHTML(course)).join('');
}

/* --------------------------------------------------------------------------
   5. MY COURSES TAB: SIRF UNLOCKED COURSES DIKHANA
   Jo courses student ne kharid liye hain (batch-2025.json me unlockedCourses),
   wo yahan alag se dikhenge.
   -------------------------------------------------------------------------- */
function renderMyCourses() {
  const container = document.getElementById('my-courses-list');
  if (!container) return;

  const unlockedIds = AppState.currentUser?.unlockedCourses || [];
  const myCourses = AppState.courses.filter((c) => unlockedIds.includes(c.id));

  if (myCourses.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 28px 16px;">
        <p style="font-size: 0.95rem; font-weight: 600;">Abhi koi course unlock nahi hai</p>
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 6px 0 14px 0;">
          Courses tab me jaakar apni branch ka pack chunein aur UPI se turant unlock karein.
        </p>
        <button class="btn btn-primary" style="width: auto;" onclick="switchTab('courses')">
          Explore Courses
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = myCourses.map((course) => buildCourseCardHTML(course)).join('');
}

/* --------------------------------------------------------------------------
   6. SINGLE COURSE CARD HTML BUILDER
   Check karega ki course unlocked hai ya nahi, aur usi hisab se
   "Open Course" (Green) ya "Buy Now" (Blue) button banayega.
   -------------------------------------------------------------------------- */
function buildCourseCardHTML(course) {
  const unlockedIds = AppState.currentUser?.unlockedCourses || [];
  const isUnlocked = unlockedIds.includes(course.id);

  // Status ke hisab se button aur badge decide karo
  const statusBadge = isUnlocked
    ? `<span class="badge badge-success">Unlocked</span>`
    : `<span class="badge badge-primary">${course.badge || course.branch}</span>`;

  const actionButton = isUnlocked
    ? `<button class="btn btn-success" style="width: auto; min-height: 38px; padding: 6px 16px;" onclick="openCourse('${course.id}')">
         Open Study Material
       </button>`
    : `<button class="btn btn-primary" style="width: auto; min-height: 38px; padding: 6px 16px;" onclick="openPaymentSheet('${course.id}')">
         Buy Now
       </button>`;

  // Agar thumbnail image abhi folder me nahi hai to clean fallback color dikhega
  return `
    <article class="course-card">
      <img
        src="${course.thumbnail}"
        alt="${course.title}"
        class="course-thumb"
        loading="lazy"
        onerror="this.style.display='none'"
      />
      <div class="course-body">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          ${statusBadge}
          <span style="font-size: 0.76rem; color: var(--text-muted); font-weight: 600;">
            ${course.branch} • Sem ${course.semester}
          </span>
        </div>

        <h4 class="course-title">${course.title}</h4>
        <p class="course-meta">${course.subtitle}</p>

        <div class="course-footer">
          <div>
            <span class="course-price">₹${course.price}</span>
            ${
              course.originalPrice
                ? `<span style="font-size: 0.8rem; color: var(--text-muted); text-decoration: line-through; margin-left: 6px;">₹${course.originalPrice}</span>`
                : ''
            }
          </div>
          ${actionButton}
        </div>
      </div>
    </article>
  `;
}

/* --------------------------------------------------------------------------
   7. UNLOCKED COURSE KHOLNA (LAZY LOADING + ANTI-LEAK WATERMARK)
   Jab student "Open Study Material" par click karega, tabhi us course ki
   detail JSON file load hogi aur screen par Anti-Leak Watermark ON hoga.
   -------------------------------------------------------------------------- */
async function openCourse(courseId) {
  const course = AppState.courses.find((c) => c.id === courseId);
  if (!course) return;

  // Paid content kholte hi Anti-Leak Watermark ON kar do
  const watermarkEl = document.getElementById('watermark-layer');
  if (watermarkEl && AppState.config?.security?.watermarkEnabled) {
    watermarkEl.style.display = 'flex';
  }

  showToast(`Loading ${course.title}...`);

  // Lazy Load: Ab sirf isi course ki detail JSON file fetch hogi
  const detailData = await fetchJSON(course.detailFile);

  if (!detailData) {
    showToast('Course content jald upload hoga!');
    return;
  }

  // Yahan aage chal kar hum Notes/PYQ/VVI viewer kholenge
  console.log('Loaded Course Details:', detailData);
  showToast(`${course.title} khul gaya!`);
}
