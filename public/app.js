async function api(path, opts = {}) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
  const baseHeaders = { 'Content-Type': 'application/json' };
  if (token) baseHeaders['x-auth-token'] = token;
  const res = await fetch(path, Object.assign({ headers: baseHeaders }, opts));
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = { text }; }
  if (!res.ok) {
    const e = new Error(body && body.error ? body.error : `Request failed: ${res.status}`);
    e.status = res.status;
    e.body = body;
    throw e;
  }
  return body;
}

function ensureToastContainer() {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  return c;
}

function showToast(message, type = 'success', timeout = 5000) {
  const container = ensureToastContainer();
  const t = document.createElement('div'); t.className = 'toast ' + (type === 'error' ? 'error' : 'success');
  const row = document.createElement('div'); row.className = 'row';
  const icon = document.createElement('div'); icon.className = 'icon ' + (type === 'error' ? 'error' : 'success');
  icon.textContent = type === 'error' ? '❌' : '✅';
  const msg = document.createElement('div'); msg.className = 'msg'; msg.textContent = message;
  row.appendChild(icon); row.appendChild(msg);
  const progress = document.createElement('div'); progress.className = 'progress';
  const bar = document.createElement('div'); bar.className = 'bar ' + (type === 'error' ? 'error' : 'success');
  progress.appendChild(bar);
  t.appendChild(row); t.appendChild(progress); container.appendChild(t);
  requestAnimationFrame(() => { bar.style.transition = `width ${timeout}ms linear`; bar.style.width = '0%'; });
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, timeout);
}


const foldersEl = document.getElementById('folders');
const folderForm = document.getElementById('folderForm');
const folderName = document.getElementById('folderName');
const newFolderToggle = document.getElementById('newFolderToggle');
const cancelFolderCreate = document.getElementById('cancelFolderCreate');
const linkForm = document.getElementById('linkForm');
const linkUrl = document.getElementById('linkUrl');
const linkNote = document.getElementById('linkNote');
const linkFolder = document.getElementById('linkFolder');
const folderMultiSelect = document.getElementById('folderMultiSelect');
const folderMultiSelected = document.getElementById('folderMultiSelected');
const folderMultiPanel = document.getElementById('folderMultiPanel');
const linksEl = document.getElementById('links');
const linksHeading = document.getElementById('linksHeading');
const linksHelper = document.getElementById('linksHelper');
const addLinkNavBtn = document.getElementById('addLinkNavBtn');
const dashboardTab = document.getElementById('dashboardTab');
const dashboardSection = document.getElementById('dashboardSection');
const addLinkSection = document.getElementById('addLinkSection');
const addLinkClose = document.getElementById('addLinkClose');
const linksSection = document.getElementById('linksSection');
const dashboardGameBtn = document.getElementById('dashboardGameBtn');
const gameSection = document.getElementById('gameSection');
const gameRoot = document.getElementById('gameRoot');
const gameTimerOverlay = document.getElementById('gameTimerOverlay');
const gameExitOverlayBtn = document.getElementById('gameExitOverlayBtn');
const sidebarToggle = document.getElementById('sidebarToggle');
const themeToggle = document.getElementById('themeToggle');
const notificationsBtn = document.getElementById('notificationsBtn');
const logoutBtn = document.getElementById('logoutBtn');
const helpTourBtn = document.getElementById('helpTourBtn');
const imagePreviewOverlay = document.getElementById('imagePreviewOverlay');
const imagePreviewImg = document.getElementById('imagePreviewImg');
const imagePreviewClose = document.getElementById('imagePreviewClose');
const videoPreviewOverlay = document.getElementById('videoPreviewOverlay');
const videoPreviewClose = document.getElementById('videoPreviewClose');
const videoPreviewContent = document.getElementById('videoPreviewContent');
const loginScreen = document.getElementById('loginScreen');
const appContainer = document.querySelector('.container');
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const sidebarAvatarImg = document.getElementById('sidebarAvatarImg');
const sidebarAvatarFallback = document.getElementById('sidebarAvatarFallback');
const sidebarProfileName = document.getElementById('sidebarProfileName');
const avatarFileInput = document.getElementById('avatarFileInput');
const sidebarProfileAvatar = document.querySelector('.sidebar-profile-avatar');
const mobileFooterNav = document.getElementById('mobileFooterNav');
const mobileNavButtons = document.querySelectorAll('[data-mobile-nav]');
const mobileNavAvatar = document.querySelector('.mobile-nav-avatar');
const bulkLinksModal = document.getElementById('bulkLinksModal');
const bulkLinksTextarea = document.getElementById('bulkLinksTextarea');
const bulkLinksFolderLabel = document.getElementById('bulkLinksFolderLabel');
const bulkLinksCancel = document.getElementById('bulkLinksCancel');
const bulkLinksSave = document.getElementById('bulkLinksSave');
let bulkTargetFolderId = null;

// in-app guided tour elements (dashboard help)
const tourOverlay = document.getElementById('tourOverlay');
const tourHighlight = document.getElementById('tourHighlight');
const tourTooltip = document.getElementById('tourTooltip');
const tourTitleEl = document.getElementById('tourTitle');
const tourBodyEl = document.getElementById('tourBody');
const tourStepCountEl = document.getElementById('tourStepCount');
const tourNextBtn = document.getElementById('tourNext');
const tourSkipBtn = document.getElementById('tourSkip');
const tourPrompt = document.getElementById('tourPrompt');
const tourPromptStart = document.getElementById('tourPromptStart');
const tourPromptClose = document.getElementById('tourPromptClose');

// simple in-memory notification center state
const notificationsPanel = document.getElementById('notificationsPanel');
const notificationsList = document.getElementById('notificationsList');
const notificationsBadge = document.getElementById('notificationsBadge');
const notificationsClear = document.getElementById('notificationsClear');
let notifications = [];
let notificationsPollId = null;
let currentUser = null;
let lastLeaderboardRank = null;
let confettiTimeout = null;
let gameStatus = [];
let gameTimerId = null;
let gameRemaining = 0;

// state for the contextual dashboard tour
let tourSteps = [];
let currentTourStepIndex = 0;

// sidebar menu elements
const sidebarMenuGroups = document.querySelectorAll('[data-menu-group]');
const sidebarMenuToggles = document.querySelectorAll('[data-menu-toggle]');
const sidebarNavTargets = document.querySelectorAll('[data-nav-target]');

function setMobileNavActive(key) {
  if (!mobileNavButtons || !mobileNavButtons.length) return;
  mobileNavButtons.forEach((btn) => {
    const k = btn.getAttribute('data-mobile-nav');
    if (k === key) btn.classList.add('is-active');
    else btn.classList.remove('is-active');
  });
}

function showDashboard() {
  if (dashboardTab) dashboardTab.classList.add('active');
  if (addLinkNavBtn) addLinkNavBtn.classList.remove('active');
  dashboardSection.style.display = 'block';
  addLinkSection.style.display = 'none';
  linksSection.style.display = 'none';
  if (gameSection) gameSection.style.display = 'none';
  if (gameTimerId) { clearInterval(gameTimerId); gameTimerId = null; }
  if (gameTimerOverlay) gameTimerOverlay.textContent = '';
  loadDashboardStats();
  setMobileNavActive('dashboard');
}
function showLinksView() {
  if (dashboardTab) dashboardTab.classList.remove('active');
  if (addLinkNavBtn) addLinkNavBtn.classList.add('active');
  dashboardSection.style.display = 'none';
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const shouldShowAddForm = !isMobile && currentFolder === null;
  if (addLinkSection) addLinkSection.style.display = shouldShowAddForm ? 'block' : 'none';
  linksSection.style.display = 'block';
  if (gameSection) gameSection.style.display = 'none';
}

function openAddLinkOverlay() {
  if (!addLinkSection) return;
  currentFolder = null;
  showLinksView();
  updateLinksHeading();
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  if (isMobile && document && document.body) {
    document.body.classList.add('mobile-add-open');
  }
  addLinkSection.style.display = 'block';
  if (linkUrl) {
    setTimeout(() => {
      try { linkUrl.focus(); } catch (_e) {}
    }, 150);
  }
}

function closeAddLinkOverlay() {
  if (!addLinkSection) return;
  if (document && document.body) {
    document.body.classList.remove('mobile-add-open');
  }
  addLinkSection.style.display = 'none';
}
if (dashboardTab) {
  dashboardTab.onclick = showDashboard;
}

if (addLinkNavBtn) {
  addLinkNavBtn.addEventListener('click', () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMobile) {
      openAddLinkOverlay();
    } else {
      currentFolder = null;
      showLinksView();
      updateLinksHeading();
      if (addLinkSection && typeof addLinkSection.scrollIntoView === 'function') {
        addLinkSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    setMobileNavActive('add');
  });
}

// handle primary sidebar navigation (dashboard/links)
if (sidebarNavTargets && sidebarNavTargets.length) {
  sidebarNavTargets.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav-target');
      if (target === 'dashboard') {
        showDashboard();
      } else if (target === 'links-all' || target === 'links-add') {
        showLinksView();
        if (target === 'links-add' && linkUrl) {
          setTimeout(() => {
            linkUrl.focus();
          }, 0);
        }
      }
    });
  });
}

if (mobileFooterNav && mobileNavButtons && mobileNavButtons.length) {
  mobileNavButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = btn.getAttribute('data-mobile-nav');
      if (!target) return;
      if (target === 'folders') {
        if (typeof window !== 'undefined' && window.innerWidth <= 768 && document && document.body) {
          const nowHidden = document.body.classList.toggle('mobile-folders-hidden');
          if (!nowHidden) {
            const foldersSection = document.querySelector('.sidebar-section-folders') || foldersEl;
            if (foldersSection && typeof foldersSection.scrollIntoView === 'function') {
              foldersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        } else {
          const foldersSection = document.querySelector('.sidebar-section-folders') || foldersEl;
          if (foldersSection && typeof foldersSection.scrollIntoView === 'function') {
            foldersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      } else if (target === 'dashboard') {
        showDashboard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (target === 'add') {
        openAddLinkOverlay();
      } else if (target === 'search') {
        currentFolder = null;
        showLinksView();
        loadLinks();
        renderFolders();
        updateLinksHeading();
        if (linksSection && typeof linksSection.scrollIntoView === 'function') {
          linksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (target === 'profile') {
        if (sidebarProfileAvatar && typeof sidebarProfileAvatar.scrollIntoView === 'function') {
          sidebarProfileAvatar.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setTimeout(() => {
          if (typeof openAvatarMenu === 'function') openAvatarMenu();
        }, 180);
      }
      setMobileNavActive(target);
    });
  });
}

if (addLinkClose) {
  addLinkClose.addEventListener('click', () => {
    closeAddLinkOverlay();
  });
}

// accordion behavior for sidebar menu groups
if (sidebarMenuToggles && sidebarMenuToggles.length) {
  sidebarMenuToggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-menu-toggle');
      if (!key) return;
      const group = document.querySelector(`[data-menu-group="${key}"]`);
      if (!group) return;
      const isOpen = group.classList.contains('is-open');
      sidebarMenuGroups.forEach((g) => {
        if (g !== group) g.classList.remove('is-open');
      });
      if (!isOpen) group.classList.add('is-open');
      else group.classList.remove('is-open');
    });
  });
}

function showLoginScreen() {
  if (loginScreen) loginScreen.style.display = 'flex';
  if (appContainer) appContainer.style.display = 'none';
}

function enterApp() {
  if (loginScreen) loginScreen.style.display = 'none';
  if (appContainer) appContainer.style.display = 'flex';
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  if (isMobile) {
    currentFolder = null;
    showLinksView();
    setMobileNavActive('search');
    if (document && document.body) {
      document.body.classList.add('mobile-folders-hidden');
    }
  } else {
    showDashboard();
  }
  // Initial data load after successful login; if it fails
  // (e.g. DB connection issue), show a toast instead of
  // leaving an unhandled promise rejection.
  loadFolders().then(loadLinks).catch((err) => {
    console.error('Failed to load folders/links after login', err);
    try {
      showToast('Failed to load folders: ' + (err && err.message ? err.message : 'Unknown error'), 'error');
    } catch (_e) {}
  });
  // start polling for cross-user notifications
  if (notificationsPollId) {
    clearInterval(notificationsPollId);
    notificationsPollId = null;
  }
  fetchNotificationsFromServer();
  notificationsPollId = setInterval(fetchNotificationsFromServer, 25000);
  // after a successful login, gently suggest the guided tour
  if (typeof openTourPrompt === 'function') {
    setTimeout(() => {
      openTourPrompt();
    }, 600);
  }
}

// expose for api 401 handlers if needed
window.showLoginScreen = showLoginScreen;

function openImagePreview(src) {
  if (!imagePreviewOverlay || !imagePreviewImg) return;
  imagePreviewImg.src = src;
  imagePreviewOverlay.classList.add('active');
}

function closeImagePreview() {
  if (!imagePreviewOverlay || !imagePreviewImg) return;
  imagePreviewOverlay.classList.remove('active');
  imagePreviewImg.src = '';
}

function openVideoPreview(kind, src, poster) {
  if (!videoPreviewOverlay || !videoPreviewContent) return;
  videoPreviewContent.innerHTML = '';
  if (kind === 'youtube') {
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.allow = 'autoplay; encrypted-media';
    iframe.allowFullscreen = true;
    videoPreviewContent.appendChild(iframe);
  } else {
    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    if (poster) video.poster = poster;
    const source = document.createElement('source');
    source.src = src;
    video.appendChild(source);
    videoPreviewContent.appendChild(video);
  }
  videoPreviewOverlay.classList.add('active');
}

function closeVideoPreview() {
  if (!videoPreviewOverlay || !videoPreviewContent) return;
  videoPreviewOverlay.classList.remove('active');
  videoPreviewContent.innerHTML = '';
}

if (imagePreviewOverlay) {
  imagePreviewOverlay.addEventListener('click', (e) => {
    if (e.target === imagePreviewOverlay) closeImagePreview();
  });
}

if (imagePreviewClose) {
  imagePreviewClose.addEventListener('click', () => closeImagePreview());
}

if (videoPreviewOverlay) {
  videoPreviewOverlay.addEventListener('click', (e) => {
    if (e.target === videoPreviewOverlay) closeVideoPreview();
  });
}

if (videoPreviewClose) {
  videoPreviewClose.addEventListener('click', () => closeVideoPreview());
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeImagePreview();
    closeVideoPreview();
  }
});

// --- Dashboard guided tour (help question-mark icon) ---
function getDashboardTourSteps() {
  const steps = [];
  if (dashboardGameBtn) {
    steps.push({
      title: 'Link Smart Quiz',
      body: 'Test your knowledge about organizing and sharing links. Great for onboarding or a quick refresher.',
      getTarget: () => dashboardGameBtn
    });
  }
  if (themeToggle) {
    steps.push({
      title: 'Theme toggle',
      body: 'Switch between light and dark mode so the dashboard matches your workspace and lighting.',
      getTarget: () => themeToggle
    });
  }
  if (notificationsBtn) {
    steps.push({
      title: 'Notifications',
      body: 'Stay on top of bulk imports, new links, and other key updates here.',
      getTarget: () => notificationsBtn
    });
  }
  if (sidebarProfileAvatar) {
    steps.push({
      title: 'Profile photo',
      body: 'Click your avatar to upload or remove your profile photo. It appears in the sidebar, on link cards, and in the user leaderboard.',
      getTarget: () => sidebarProfileAvatar
    });
  }
  if (newFolderToggle) {
    steps.push({
      title: 'Create folders',
      body: 'Click “New” to create folders or subfolders. Use folders to group links by project, team, or topic.',
      getTarget: () => newFolderToggle
    });
  }
  if (foldersEl) {
    steps.push({
      title: 'Folder list & drag',
      body: 'Drag root folders up or down to reorder them. Use the chevron to expand nested folders.',
      getTarget: () => foldersEl
    });
  }
  const foldersHeaderActions = document.querySelector('.sidebar-section-folders .sidebar-section-header');
  if (foldersHeaderActions && foldersEl) {
    const sampleThreeDots = foldersEl.querySelector('.folder-actions');
    if (sampleThreeDots) {
      steps.push({
        title: 'Folder menu (⋮)',
        body: 'Use the three dots on a folder to rename, add subfolders, duplicate the folder tree, pin it, add bulk links, or delete.',
        getTarget: () => sampleThreeDots
      });
    }
  }
  if (addLinkNavBtn) {
    steps.push({
      title: 'Add links to folders',
      body: 'Click the "Add Link" button in the sidebar to open the link form. Paste a URL, add an optional note, choose one or more folders, then click "Add Link" to save it.',
      getTarget: () => addLinkNavBtn
    });
  }
  const statsEl = document.getElementById('dashboardStats');
  if (statsEl) {
    steps.push({
      title: 'Key metrics',
      body: 'At-a-glance stats for total links, folders, and recent activity help you see usage instantly.',
      getTarget: () => statsEl
    });
  }
  const chartsEl = document.getElementById('dashboardCharts');
  if (chartsEl) {
    steps.push({
      title: 'Analytics',
      body: 'Charts show how links are added and used across folders and users over time.',
      getTarget: () => chartsEl
    });
  }
  return steps;
}

function openTourOverlay() {
  if (!tourOverlay) return;
  tourOverlay.style.display = 'block';
  document.body.classList.add('tour-open');
}

function closeTourOverlay() {
  if (!tourOverlay) return;
  tourOverlay.style.display = 'none';
  document.body.classList.remove('tour-open');
  if (tourHighlight) {
    tourHighlight.style.display = 'none';
  }
}

function positionTourUI(step) {
  if (!step || !tourHighlight || !tourTooltip) return;
  const target = step.getTarget && step.getTarget();
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const padding = 8;
  const maxWidth = Math.max(260, Math.min(320, window.innerWidth - 32));

  const highlightTop = Math.max(rect.top - padding, 8);
  const highlightLeft = Math.max(rect.left - padding, 8);
  const highlightWidth = Math.min(rect.width + padding * 2, window.innerWidth - 16);
  const highlightHeight = Math.min(rect.height + padding * 2, window.innerHeight - 16);

  tourHighlight.style.display = 'block';
  tourHighlight.style.top = highlightTop + 'px';
  tourHighlight.style.left = highlightLeft + 'px';
  tourHighlight.style.width = highlightWidth + 'px';
  tourHighlight.style.height = highlightHeight + 'px';
  const isAddLinkStep = step.title === 'Add links to folders';

  let top;
  let left;

  if (isAddLinkStep) {
    // For the Add Link step, always place the tooltip to the side
    // of the sidebar button so it doesn't appear above it.
    top = Math.max(rect.top - 10, 16);
    left = rect.right + 20;
  } else {
    top = highlightTop + highlightHeight + 16;
    const estimatedHeight = 180;
    if (top + estimatedHeight > window.innerHeight - 16) {
      top = highlightTop - estimatedHeight - 16;
    }
    if (top < 16) top = 16;

    left = highlightLeft;
  }

  if (left + maxWidth + 16 > window.innerWidth) {
    left = window.innerWidth - maxWidth - 16;
  }
  if (left < 16) left = 16;

  tourTooltip.style.maxWidth = maxWidth + 'px';
  tourTooltip.style.top = top + 'px';
  tourTooltip.style.left = left + 'px';
}

function showTourStep(index) {
  if (!tourSteps.length) return;
  if (index < 0 || index >= tourSteps.length) {
    closeTourOverlay();
    return;
  }
  currentTourStepIndex = index;
  const step = tourSteps[index];
  if (tourTitleEl) tourTitleEl.textContent = step.title;
  if (tourBodyEl) tourBodyEl.textContent = step.body;
  if (tourStepCountEl) tourStepCountEl.textContent = (index + 1) + ' of ' + tourSteps.length;
  if (tourNextBtn) tourNextBtn.textContent = index === tourSteps.length - 1 ? 'Done' : 'Next';

  const target = step.getTarget && step.getTarget();
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    positionTourUI(step);
  }, 350);
}
function openTourPrompt() {
  if (!tourPrompt || !helpTourBtn) return;
  const card = tourPrompt.querySelector('.tour-prompt-card');
  if (card) {
    const rect = helpTourBtn.getBoundingClientRect();
    const offsetTop = rect.bottom + 10;
    const offsetRight = Math.max(16, window.innerWidth - rect.right);
    card.style.top = offsetTop + 'px';
    card.style.right = offsetRight + 'px';
  }
  tourPrompt.style.display = 'block';
  tourPrompt.setAttribute('aria-hidden', 'false');
}

function closeTourPrompt() {
  if (!tourPrompt) return;
  tourPrompt.style.display = 'none';
  tourPrompt.setAttribute('aria-hidden', 'true');
}

if (helpTourBtn) {
  helpTourBtn.addEventListener('click', () => {
    openTourPrompt();
  });
}

if (tourNextBtn) {
  tourNextBtn.addEventListener('click', () => {
    if (currentTourStepIndex >= tourSteps.length - 1) {
      closeTourOverlay();
    } else {
      showTourStep(currentTourStepIndex + 1);
    }
  });
}

if (tourSkipBtn) {
  tourSkipBtn.addEventListener('click', () => {
    closeTourOverlay();
  });
}

if (tourOverlay) {
  tourOverlay.addEventListener('click', (e) => {
    if (e.target === tourOverlay) {
      closeTourOverlay();
    }
  });
}

if (tourPromptStart) {
  tourPromptStart.addEventListener('click', () => {
    closeTourPrompt();
    tourSteps = getDashboardTourSteps();
    if (!tourSteps.length) return;
    openTourOverlay();
    showTourStep(0);
  });
}

if (tourPromptClose) {
  tourPromptClose.addEventListener('click', () => {
    closeTourPrompt();
  });
}

if (tourPrompt) {
  tourPrompt.addEventListener('click', (e) => {
    if (e.target === tourPrompt) {
      closeTourPrompt();
    }
  });
}

window.addEventListener('resize', () => {
  if (!tourOverlay || tourOverlay.style.display === 'none' || !tourSteps.length) return;
  positionTourUI(tourSteps[currentTourStepIndex]);
});

// Login form handling
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) return;
    try {
      const resp = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      if (resp && resp.token) {
        localStorage.setItem('authToken', resp.token);
        enterApp();
        loadCurrentUserProfile();
        showToast('Logged in successfully', 'success', 3000);
      } else {
        showToast('Login failed', 'error', 3000);
      }
    } catch (err) {
      if (err.status === 401) {
        showToast('Invalid username or password', 'error', 3000);
      } else {
        showToast('There was a problem logging in. Please try again.', 'error', 3000);
      }
    }
  });
}

async function loadCurrentUserProfile() {
  try {
    const me = await api('/api/me');
    if (me) {
      currentUser = me;
    }
    if (me && me.username) {
      const prettyName = me.username.charAt(0).toUpperCase() + me.username.slice(1);
      const headerTitle = document.querySelector('.main-header-title');
      if (sidebarProfileName) {
        sidebarProfileName.textContent = prettyName;
      }
      if (headerTitle) {
        headerTitle.textContent = `Hello ${prettyName}! 👋`;
      }
      if (sidebarAvatarFallback) {
        sidebarAvatarFallback.textContent = prettyName.charAt(0);
      }
    }
    if (sidebarAvatarImg) {
      if (me && me.avatar_url) {
        sidebarAvatarImg.src = me.avatar_url;
        sidebarAvatarImg.style.display = 'block';
        if (sidebarAvatarFallback) sidebarAvatarFallback.style.display = 'none';
      } else {
        sidebarAvatarImg.src = '';
        sidebarAvatarImg.style.display = 'none';
        if (sidebarAvatarFallback) sidebarAvatarFallback.style.display = 'flex';
      }
    }
    if (mobileNavAvatar) {
      const prettyName = me && me.username ? (me.username.charAt(0).toUpperCase() + me.username.slice(1)) : null;
      mobileNavAvatar.innerHTML = '';
      mobileNavAvatar.style.backgroundImage = '';
      mobileNavAvatar.style.backgroundSize = '';
      mobileNavAvatar.style.backgroundPosition = '';
      if (me && me.avatar_url) {
        const img = document.createElement('img');
        img.src = me.avatar_url;
        img.alt = prettyName || 'Profile';
        mobileNavAvatar.appendChild(img);
      } else if (prettyName) {
        mobileNavAvatar.textContent = prettyName.charAt(0);
      } else if (sidebarAvatarFallback && sidebarAvatarFallback.textContent) {
        mobileNavAvatar.textContent = sidebarAvatarFallback.textContent;
      }
    }
    // once we know the current user, recompute per-folder unread counts
    refreshFolderUnreadCounts();
  } catch (e) {
    // ignore profile errors; user might not have one yet
  }
}

// Sidebar collapse toggle
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
  });
}

// Simple learning game (employee quiz)
const employeeQuizQuestions = [
  {
    q: 'What is the correct way to create a new folder in Link Storer?',
    options: [
      'Type the folder name in the link note field',
      'Click New in the Folders panel on the left',
      'Right-click anywhere on the dashboard background',
      'You cannot create folders in this app'
    ],
    correct: 1,
    info: 'Use the New button in the Folders section of the sidebar, give the folder a clear name, then save it.'
  },
  {
    q: 'How do you add a new link to Link Storer?',
    options: [
      'Paste URLs directly into the browser address bar',
      'Upload a PDF with all links inside',
      'Click Add Link in the sidebar, paste the URL, pick folders, and click Add Link',
      'Send the link to the admin on WhatsApp'
    ],
    correct: 2,
    info: 'Use the Add Link button, paste your URL, optionally add a note, select one or more folders, and then click Add Link.'
  },
  {
    q: 'Can a single link belong to more than one folder?',
    options: [
      'No, each link can only live in one folder',
      'Yes, you can select multiple folders from the multi-select when saving the link',
      'Only admins can do that',
      'Only if you duplicate the link manually for each folder'
    ],
    correct: 1,
    info: 'When adding a link you can choose multiple folders from the multi-select so the same link appears in several places.'
  },
  {
    q: 'How can you share a saved link directly on WhatsApp from the app?',
    options: [
      'Copy the URL from the browser address bar only',
      'Click the WhatsApp icon/button on the link card',
      'Share the whole dashboard screenshot',
      'You cannot share links to WhatsApp'
    ],
    correct: 1,
    info: 'Each link card has a WhatsApp share button that opens WhatsApp with the link pre-filled so you can send it in one tap.'
  },
  {
    q: 'Where can you see who added a link inside Link Storer?',
    options: [
      'In the browser history only',
      'At the very bottom of the dashboard page',
      'On each link card under Added by with their initial or avatar',
      'You cannot see who added links'
    ],
    correct: 2,
    info: 'Every link card shows an Added by label with the persons name and avatar so ownership is always clear.'
  },
  {
    q: 'What does the User Leaderboard (This Month) on the dashboard show?',
    options: [
      'Who has logged in the most times',
      'Who has created the most folders overall',
      'Which users added the most links this month, with their avatars',
      'Random users from your company'
    ],
    correct: 2,
    info: 'The leaderboard highlights the teammates adding the most links this month and uses their avatar so you can see them at a glance.'
  }
];

let gameCurrentIndex = 0;
let gameScore = 0;
let gameInProgress = false;

function renderGameProgress() {
  const wrap = document.createElement('div');
  wrap.className = 'game-progress';
  const total = employeeQuizQuestions.length;
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'game-progress-item';
    dot.dataset.idx = String(i);
    dot.textContent = String(i + 1);
    const status = gameStatus && gameStatus[i];
    if (status === 'done') dot.classList.add('done');
    else if (status === 'timeout') dot.classList.add('timeout');
    wrap.appendChild(dot);
  }
  return wrap;
}

function showGameView() {
  if (!gameSection || !gameRoot) return;
  dashboardSection.style.display = 'none';
  addLinkSection.style.display = 'none';
  linksSection.style.display = 'none';
  gameSection.style.display = 'flex';
  if (!gameInProgress) {
    renderGameIntro();
  }
}

function renderGameIntro() {
  gameInProgress = false;
  if (!gameStatus || gameStatus.length !== employeeQuizQuestions.length) {
    gameStatus = new Array(employeeQuizQuestions.length).fill('pending');
  }
  gameRoot.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'game-card';
  const title = document.createElement('h3');
  title.className = 'game-title';
  title.textContent = 'Link Storer Quick Quiz';
  const desc = document.createElement('p');
  desc.className = 'game-description';
  desc.textContent = 'Learn the main features of Link Storer1ike folders, adding links, WhatsApp sharing, and the leaderboardein a few quick questions.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'game-primary-btn';
  btn.textContent = 'Start quiz';
  btn.onclick = startGame;
  const layout = document.createElement('div');
  layout.className = 'game-layout';
  const progress = renderGameProgress();
  const main = document.createElement('div');
  main.className = 'game-main';
  main.appendChild(title);
  main.appendChild(desc);
  main.appendChild(btn);
  layout.appendChild(progress);
  layout.appendChild(main);
  card.appendChild(layout);
  gameRoot.appendChild(card);
}

function startGame() {
  gameCurrentIndex = 0;
  gameScore = 0;
  gameInProgress = true;
  gameStatus = new Array(employeeQuizQuestions.length).fill('pending');
  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  if (!gameRoot) return;
  if (gameCurrentIndex >= employeeQuizQuestions.length) {
    renderGameSummary();
    return;
  }
  const data = employeeQuizQuestions[gameCurrentIndex];
  gameRoot.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'game-card';
  const meta = document.createElement('div');
  meta.className = 'game-meta';
  meta.textContent = `Question ${gameCurrentIndex + 1} of ${employeeQuizQuestions.length}`;
  const headerRow = document.createElement('div');
  headerRow.className = 'game-header-row';
  headerRow.appendChild(meta);
  const q = document.createElement('div');
  q.className = 'game-question';
  q.textContent = data.q;
  const opts = document.createElement('div');
  opts.className = 'game-options';
  const feedback = document.createElement('div');
  feedback.className = 'game-feedback';
  let answered = false;
  gameRemaining = 45;
  if (gameTimerOverlay) gameTimerOverlay.textContent = `${gameRemaining}s`;
  if (gameTimerId) { clearInterval(gameTimerId); gameTimerId = null; }
  gameTimerId = setInterval(() => {
    gameRemaining -= 1;
    if (gameRemaining <= 0) {
      gameRemaining = 0;
      if (gameTimerOverlay) gameTimerOverlay.textContent = '0s';
      clearInterval(gameTimerId);
      gameTimerId = null;
      if (!answered) {
        answered = true;
        const all = opts.querySelectorAll('button');
        all.forEach(btn => btn.disabled = true);
        gameStatus[gameCurrentIndex] = 'timeout';
        const progItem = document.querySelector(`.game-progress-item[data-idx="${gameCurrentIndex}"]`);
        if (progItem) {
          progItem.classList.remove('done');
          progItem.classList.add('timeout');
        }
        feedback.textContent = 'Time is up. ' + data.info;
        nextBtn.disabled = false;
        nextBtn.focus();
      }
    } else {
      if (gameTimerOverlay) gameTimerOverlay.textContent = `${gameRemaining}s`;
    }
  }, 1000);
  data.options.forEach((text, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.onclick = () => {
      if (answered) return;
      answered = true;
      const all = opts.querySelectorAll('button');
      all.forEach(btn => btn.disabled = true);
      if (gameTimerId) { clearInterval(gameTimerId); gameTimerId = null; }
      if (idx === data.correct) {
        b.classList.add('correct');
        gameScore++;
        gameStatus[gameCurrentIndex] = 'done';
        feedback.textContent = 'Correct! ' + data.info;
      } else {
        b.classList.add('incorrect');
        const correctBtn = all[data.correct];
        if (correctBtn) correctBtn.classList.add('correct');
        gameStatus[gameCurrentIndex] = 'done';
        feedback.textContent = 'Nice try. ' + data.info;
      }
      const progItem = document.querySelector(`.game-progress-item[data-idx="${gameCurrentIndex}"]`);
      if (progItem) {
        progItem.classList.remove('timeout');
        progItem.classList.add('done');
      }
      nextBtn.disabled = false;
      nextBtn.focus();
    };
    opts.appendChild(b);
  });
  const actions = document.createElement('div');
  actions.className = 'game-actions';
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'game-secondary-btn';
  nextBtn.textContent = gameCurrentIndex === employeeQuizQuestions.length - 1 ? 'See results' : 'Next question';
  nextBtn.disabled = true;
  nextBtn.onclick = () => {
    if (!answered) return;
    gameCurrentIndex++;
    renderCurrentQuestion();
  };
  actions.appendChild(nextBtn);
  const layout = document.createElement('div');
  layout.className = 'game-layout';
  const progress = renderGameProgress();
  const main = document.createElement('div');
  main.className = 'game-main';
  main.appendChild(headerRow);
  main.appendChild(q);
  main.appendChild(opts);
  main.appendChild(feedback);
  main.appendChild(actions);
  layout.appendChild(progress);
  layout.appendChild(main);
  card.appendChild(layout);
  gameRoot.appendChild(card);
}

function renderGameSummary() {
  gameInProgress = false;
  if (!gameRoot) return;
  gameRoot.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'game-card';
  const title = document.createElement('h3');
  title.className = 'game-title';
  title.textContent = 'Nice work!';
  const summary = document.createElement('p');
  summary.className = 'game-description';
  summary.textContent = 'Here is how you did in this round.';
  const result = document.createElement('div');
  result.className = 'game-result';
  const total = employeeQuizQuestions.length;
  result.textContent = `Result: ${gameScore} / ${total}`;
  const emojiRow = document.createElement('div');
  emojiRow.className = 'game-emoji-row';
  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'game-emoji';
  const emojiText = document.createElement('span');
  emojiText.className = 'game-emoji-text';
  const ratio = total ? gameScore / total : 0;
  if (total && gameScore === total) {
    emojiSpan.textContent = '🏆';
    emojiText.textContent = 'Perfect score – you are a link pro!';
  } else if (ratio >= 0.7) {
    emojiSpan.textContent = '😄';
    emojiText.textContent = 'Great job – strong, healthy link habits.';
  } else if (ratio >= 0.4) {
    emojiSpan.textContent = '🙂';
    emojiText.textContent = 'Nice start – review the tips and try again.';
  } else {
    emojiSpan.textContent = '😅';
    emojiText.textContent = 'Plenty of room to grow – give it another go!';
  }
  emojiRow.appendChild(emojiSpan);
  emojiRow.appendChild(emojiText);
  const row = document.createElement('div');
  row.className = 'game-actions';
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'game-primary-btn';
  replay.textContent = 'Play again';
  replay.onclick = () => {
    startGame();
  };
  row.appendChild(replay);
  const layout = document.createElement('div');
  layout.className = 'game-layout';
  const progress = renderGameProgress();
  const main = document.createElement('div');
  main.className = 'game-main';
  main.appendChild(title);
  main.appendChild(summary);
  main.appendChild(result);
  main.appendChild(emojiRow);
  main.appendChild(row);
  layout.appendChild(progress);
  layout.appendChild(main);
  card.appendChild(layout);
  gameRoot.appendChild(card);
}
if (dashboardGameBtn) {
	dashboardGameBtn.addEventListener('click', showGameView);
}

if (gameExitOverlayBtn) {
	gameExitOverlayBtn.addEventListener('click', showDashboard);
}

// Simple theme toggle (light/dark)
function applyStoredTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.body.classList.add('theme-dark');
  }
}
applyStoredTheme();

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('theme-dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
}

// Placeholder handlers for notifications and logout
if (notificationsBtn && notificationsPanel) {
  notificationsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = notificationsPanel.style.display === 'block';
    const nextIsOpen = !isOpen;
    notificationsPanel.style.display = nextIsOpen ? 'block' : 'none';
    notificationsPanel.setAttribute('aria-hidden', nextIsOpen ? 'false' : 'true');
    if (nextIsOpen) {
      // Mark all current notifications as seen when the panel is opened.
      markAllNotificationsSeen();
    }
  });

  document.addEventListener('click', (e) => {
    if (!notificationsPanel.contains(e.target) && e.target !== notificationsBtn) {
      notificationsPanel.style.display = 'none';
      notificationsPanel.setAttribute('aria-hidden', 'true');
    }
  });
}

if (notificationsClear && notificationsList && notificationsBadge) {
  notificationsClear.addEventListener('click', () => {
    notifications = [];
    renderNotifications();
    markAllNotificationsSeen();
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    openLogoutConfirmModal();
  });
}

function openLogoutConfirmModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay logout-modal';
  overlay.setAttribute('aria-hidden', 'false');

  const card = document.createElement('div');
  card.className = 'modal-card logout-card';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const title = document.createElement('h2');
  title.textContent = 'Log out?';
  const subtitle = document.createElement('p');
  subtitle.className = 'modal-subtitle';
  subtitle.textContent = 'You can log back in anytime using your username and password.';
  header.appendChild(title);
  header.appendChild(subtitle);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary';
  cancelBtn.textContent = 'Cancel';
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn-primary';
  confirmBtn.textContent = 'Log out';
  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);

  card.appendChild(header);
  card.appendChild(footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() {
    overlay.setAttribute('aria-hidden', 'true');
    document.body.removeChild(overlay);
  }

  cancelBtn.onclick = () => close();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  confirmBtn.onclick = () => {
    localStorage.removeItem('authToken');
    close();
    showLoginScreen();
  };
}

let avatarMenuEl = null;

  function closeAvatarMenu() {
    if (avatarMenuEl && avatarMenuEl.parentNode) {
      avatarMenuEl.parentNode.removeChild(avatarMenuEl);
    }
    avatarMenuEl = null;
    document.removeEventListener('click', onAvatarMenuDocClick, true);
  }

  function onAvatarMenuDocClick(e) {
    if (avatarMenuEl && !avatarMenuEl.contains(e.target) && !sidebarProfileAvatar.contains(e.target)) {
      closeAvatarMenu();
    }
  }

  function openAvatarMenu() {
    if (!sidebarProfileAvatar) return;
    if (avatarMenuEl) {
      closeAvatarMenu();
      return;
    }
    avatarMenuEl = document.createElement('div');
    avatarMenuEl.className = 'avatar-menu';
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'avatar-menu-item';
    uploadBtn.textContent = 'Upload new photo';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'avatar-menu-item';
    removeBtn.textContent = 'Remove photo';
    uploadBtn.onclick = () => {
      if (avatarFileInput) avatarFileInput.click();
      closeAvatarMenu();
    };
    removeBtn.onclick = async () => {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
      try {
        const res = await fetch('/api/profile/avatar', {
          method: 'DELETE',
          headers: token ? { 'x-auth-token': token } : {}
        });
        if (!res.ok) {
          showToast('Failed to remove avatar', 'error', 3000);
        } else {
          await loadCurrentUserProfile();
          if (dashboardSection && dashboardSection.style.display === 'block') {
            loadDashboardStats();
          }
          showToast('Profile picture removed');
        }
      } catch (e) {
        showToast('Failed to remove avatar', 'error', 3000);
      }
      closeAvatarMenu();
    };
    avatarMenuEl.appendChild(uploadBtn);
    avatarMenuEl.appendChild(removeBtn);
    avatarMenuEl.style.visibility = 'hidden';
    document.body.appendChild(avatarMenuEl);
    const rect = sidebarProfileAvatar.getBoundingClientRect();
    const menuHeight = avatarMenuEl.offsetHeight;
    const menuWidth = avatarMenuEl.offsetWidth;
    const top = rect.top + window.scrollY - menuHeight - 6; // position above avatar
    const left = rect.right + window.scrollX - menuWidth; // right-align with avatar
    avatarMenuEl.style.top = `${Math.max(8, top)}px`;
    avatarMenuEl.style.left = `${Math.max(8, left)}px`;
    avatarMenuEl.style.visibility = 'visible';
    setTimeout(() => {
      document.addEventListener('click', onAvatarMenuDocClick, true);
    }, 0);
  }

  if (sidebarProfileAvatar) {
    sidebarProfileAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      openAvatarMenu();
    });
  }

  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', async () => {
      const file = avatarFileInput.files && avatarFileInput.files[0];
      if (!file) return;
      // Open simple cropper before uploading avatar
      try {
        const croppedBlob = await openAvatarCropper(file);
        if (!croppedBlob) {
          avatarFileInput.value = '';
          return;
        }
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
        const formData = new FormData();
        formData.append('avatar', croppedBlob, 'avatar.png');
        const res = await fetch('/api/profile/avatar', {
          method: 'POST',
          headers: token ? { 'x-auth-token': token } : {},
          body: formData
        });
        if (!res.ok) {
          showToast('Failed to upload avatar', 'error', 3000);
          return;
        }
        await res.json();
        await loadCurrentUserProfile();
        if (dashboardSection && dashboardSection.style.display === 'block') {
          loadDashboardStats();
        }
        showToast('Profile picture updated');
      } catch (e) {
        showToast('Failed to upload avatar', 'error', 3000);
      } finally {
        avatarFileInput.value = '';
      }
    });
  }
// Simple centered square avatar cropper with zoom
async function openAvatarCropper(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const overlay = document.createElement('div');
      overlay.className = 'avatar-crop-overlay';

      const card = document.createElement('div');
      card.className = 'avatar-crop-card';

      const title = document.createElement('h3');
      title.className = 'avatar-crop-title';
      title.textContent = 'Adjust your profile photo';

      const previewWrap = document.createElement('div');
      previewWrap.className = 'avatar-crop-preview-wrap';

      const img = document.createElement('img');
      img.className = 'avatar-crop-image';
      img.src = reader.result;

      const mask = document.createElement('div');
      mask.className = 'avatar-crop-mask';

      previewWrap.appendChild(img);
      previewWrap.appendChild(mask);

      const controls = document.createElement('div');
      controls.className = 'avatar-crop-controls';
      const zoomLabel = document.createElement('span');
      zoomLabel.textContent = 'Zoom';
      const zoomInput = document.createElement('input');
      zoomInput.type = 'range';
      zoomInput.min = '1';
      zoomInput.max = '3';
      zoomInput.step = '0.05';
      zoomInput.value = '1';
      controls.appendChild(zoomLabel);
      controls.appendChild(zoomInput);

      const actions = document.createElement('div');
      actions.className = 'avatar-crop-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn-secondary';
      cancelBtn.textContent = 'Cancel';
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn-primary';
      saveBtn.textContent = 'Save';
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);

      card.appendChild(title);
      card.appendChild(previewWrap);
      card.appendChild(controls);
      card.appendChild(actions);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      function cleanup() {
        document.body.removeChild(overlay);
      }

      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };

      zoomInput.addEventListener('input', () => {
        const zoom = parseFloat(zoomInput.value) || 1;
        img.style.transform = `translate(-50%, -50%) scale(${zoom})`;
      });

      img.onload = () => {
        const iw = img.naturalWidth || 0;
        const ih = img.naturalHeight || 0;
        if (iw && ih) {
          if (iw > ih) {
            img.style.height = '100%';
            img.style.width = 'auto';
          } else {
            img.style.width = '100%';
            img.style.height = 'auto';
          }
        }
        img.style.transform = 'translate(-50%, -50%) scale(1)';
      };

      saveBtn.onclick = () => {
        const canvasSize = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');
        const zoom = parseFloat(zoomInput.value) || 1;

        const imgEl = img;
        const iw = imgEl.naturalWidth;
        const ih = imgEl.naturalHeight;
        if (!iw || !ih) {
          cleanup();
          resolve(file);
          return;
        }

        const baseScale = Math.max(canvasSize / iw, canvasSize / ih);
        const scale = baseScale * zoom;
        const drawWidth = iw * scale;
        const drawHeight = ih * scale;
        const dx = (canvasSize - drawWidth) / 2;
        const dy = (canvasSize - drawHeight) / 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.drawImage(imgEl, dx, dy, drawWidth, drawHeight);

        canvas.toBlob((blob) => {
          cleanup();
          if (blob) resolve(blob);
          else resolve(file);
        }, 'image/png');
      };
    };
    reader.readAsDataURL(file);
  });
}
async function loadDashboardStats() {
  const statsBox = document.getElementById('dashboardStats');
  const monthCanvas = document.getElementById('linksMonthChart');
  const foldersCanvas = document.getElementById('foldersPieChart');
  const usersCanvas = document.getElementById('usersMonthChart');
  const usersLeaderboardEl = document.getElementById('usersLeaderboard');
  if (statsBox) {
    statsBox.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const sk = document.createElement('div');
      sk.className = 'stat-box skeleton-card';
      sk.innerHTML = '<div class="stat-label skeleton skeleton-text sm" style="width:70%"></div>'+
                     '<div class="stat-value skeleton skeleton-text lg" style="width:40%;margin-top:6px"></div>';
      statsBox.appendChild(sk);
    }
  }
  if (monthCanvas) monthCanvas.style.display = 'none';
  if (foldersCanvas) foldersCanvas.style.display = 'none';
  if (usersCanvas) usersCanvas.style.display = 'none';
  if (monthCanvas && monthCanvas.parentElement) {
    const parent = monthCanvas.parentElement;
    parent.querySelectorAll('.chart-skeleton').forEach(el => el.remove());
    const sk = document.createElement('div');
    sk.className = 'chart-skeleton';
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton skeleton-text';
      line.style.width = (80 - i * 15) + '%';
      sk.appendChild(line);
    }
    parent.appendChild(sk);
  }
  if (foldersCanvas && foldersCanvas.parentElement) {
    const parent = foldersCanvas.parentElement;
    parent.querySelectorAll('.chart-skeleton').forEach(el => el.remove());
    const sk = document.createElement('div');
    sk.className = 'chart-skeleton';
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton skeleton-text';
      line.style.width = (80 - i * 15) + '%';
      sk.appendChild(line);
    }
    parent.appendChild(sk);
  }
  if (usersCanvas && usersCanvas.parentElement) {
    const parent = usersCanvas.parentElement;
    parent.querySelectorAll('.chart-skeleton').forEach(el => el.remove());
    const sk = document.createElement('div');
    sk.className = 'chart-skeleton';
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton skeleton-text';
      line.style.width = (80 - i * 15) + '%';
      sk.appendChild(line);
    }
    parent.appendChild(sk);
  }
  if (usersLeaderboardEl) {
    usersLeaderboardEl.innerHTML = '';
    const sk = document.createElement('div');
    sk.className = 'chart-skeleton';
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton skeleton-text';
      line.style.width = (70 - i * 20) + '%';
      sk.appendChild(line);
    }
    usersLeaderboardEl.appendChild(sk);
  }
  try {
    const stats = await api('/api/dashboard');
    if (statsBox) {
      statsBox.innerHTML = '';
      function stat(label, value, icon) {
        return `<div class="stat-box"><div class="stat-label">${icon ? `<span class='stat-icon'>${icon}</span>` : ''}${label}</div><div class="stat-value">${value}</div></div>`;
      }
      statsBox.innerHTML += stat('Links Added Today', stats.links_today ?? 0, '🔗');
      statsBox.innerHTML += stat('Links This Month', stats.links_this_month ?? 0, '📈');
      statsBox.innerHTML += stat('Total Folders', stats.folders_count ?? 0, '🗂️');
      statsBox.innerHTML += stat('Your Links Added', (stats.links_by_current_user ?? 0), '👤');
    }

    // Monthly links chart (line)
    if (monthCanvas) {
      try {
        const monthly = Array.isArray(stats.monthly_links) ? stats.monthly_links : [];
        const labels = monthly.length
          ? monthly.map(r => (r.day || '').slice(8, 10))
          : ['No data'];
        const data = monthly.length
          ? monthly.map(r => Number(r.count) || 0)
          : [0];
        monthCanvas.style.display = 'block';
        if (window.linksMonthChart && typeof window.linksMonthChart.destroy === 'function') {
          window.linksMonthChart.destroy();
        }
        window.linksMonthChart = new Chart(monthCanvas, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Links per day',
              data,
              borderColor: 'rgba(3,102,214,1)',
              backgroundColor: 'rgba(3,102,214,0.12)',
              borderWidth: 3,
              fill: true,
              tension: 0.3,
              pointRadius: 5,
              pointHoverRadius: 6,
              pointBackgroundColor: 'rgba(3,102,214,1)'
            }]
          },
          options: {
            responsive: true,
            layout: {
              padding: {
                top: 6,
                bottom: 0,
                left: 0,
                right: 0
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.parsed.y || 0} links`,
                }
              }
            },
            scales: {
              x: {
                ticks: { autoSkip: true, maxTicksLimit: 10 },
                title: {
                  display: true,
                  text: 'Day of month',
                  font: { size: 11 },
                  color: '#6b7280'
                }
              },
              y: {
                beginAtZero: true,
                precision: 0,
                title: {
                  display: true,
                  text: 'Links added',
                  font: { size: 11 },
                  color: '#6b7280'
                }
              }
            }
          }
        });
      } catch (err) {
        console.error('Monthly chart error', err);
        monthCanvas.style.display = 'none';
      }
    }

    // Folders pie chart
    if (foldersCanvas) {
      try {
        const breakdown = Array.isArray(stats.folders_breakdown) ? stats.folders_breakdown : [];
        const withCounts = breakdown.filter(f => (Number(f.count) || 0) > 0);
        let source = withCounts.length ? withCounts : breakdown;
        let labels, data;
        if (source.length) {
          labels = source.map(f => f.name || '(Unnamed)');
          data = source.map(f => Number(f.count) || 0);
        } else {
          labels = ['No folders'];
          data = [0];
        }
        foldersCanvas.style.display = 'block';
        if (window.foldersPieChart && typeof window.foldersPieChart.destroy === 'function') {
          window.foldersPieChart.destroy();
        }
        window.foldersPieChart = new Chart(foldersCanvas, {
          type: 'pie',
          data: {
            labels,
            datasets: [{
              data,
              backgroundColor: [
                '#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#22c55e', '#f97316'
              ],
              borderWidth: 1
            }]
          },
          options: {
            plugins: {
              legend: { display: true, position: 'bottom' },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const label = ctx.label || '';
                    const value = ctx.parsed || 0;
                    return `${label}: ${value} link${value === 1 ? '' : 's'}`;
                  }
                }
              }
            }
          }
        });
      } catch (err) {
        console.error('Folders pie chart error', err);
        foldersCanvas.style.display = 'none';
      }
    }

    // Per-user monthly links chart (bar)
    if (usersCanvas) {
      try {
        const usersMonthly = Array.isArray(stats.users_monthly) ? stats.users_monthly : [];
        const labels = usersMonthly.length ? usersMonthly.map(r => r.username || '(unknown)') : ['No users'];
        const data = usersMonthly.length ? usersMonthly.map(r => Number(r.count) || 0) : [0];
        usersCanvas.style.display = 'block';
        if (window.usersMonthChart && typeof window.usersMonthChart.destroy === 'function') {
          window.usersMonthChart.destroy();
        }
        window.usersMonthChart = new Chart(usersCanvas, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Links this month',
              data,
              backgroundColor: 'rgba(3,102,214,0.7)',
              borderColor: 'rgba(3,102,214,1)',
              borderWidth: 1,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.parsed.y || 0} link${(ctx.parsed.y || 0) === 1 ? '' : 's'}`
                }
              }
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'User',
                  font: { size: 11 },
                  color: '#6b7280'
                }
              },
              y: {
                beginAtZero: true,
                precision: 0,
                title: {
                  display: true,
                  text: 'Links added (this month)',
                  font: { size: 11 },
                  color: '#6b7280'
                }
              }
            }
          }
        });
      } catch (err) {
        console.error('Users monthly chart error', err);
        usersCanvas.style.display = 'none';
      }
    }

    // Leaderboard beside per-user chart
    if (usersLeaderboardEl) {
      const usersMonthly = Array.isArray(stats.users_monthly) ? stats.users_monthly.slice() : [];
      if (!usersMonthly.length) {
        usersLeaderboardEl.className = 'users-leaderboard users-leaderboard-empty';
        usersLeaderboardEl.textContent = 'No leaderboard data yet.';
      } else {
        usersMonthly.sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
        usersLeaderboardEl.className = 'users-leaderboard';
        const container = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'users-leaderboard-title';
        title.textContent = 'Leaderboard';
        const list = document.createElement('ul');
        list.className = 'users-leaderboard-list';
        usersMonthly.forEach((u, idx) => {
          const li = document.createElement('li');
          li.className = 'users-leaderboard-item rank-' + (idx + 1);
          const main = document.createElement('div');
          main.className = 'users-leaderboard-main';
          const rank = document.createElement('span');
          rank.className = 'users-leaderboard-rank';
          rank.textContent = idx === 0 ? '#1 🏆' : `#${idx + 1}`;
          const avatarWrap = document.createElement('div');
          avatarWrap.className = 'users-leaderboard-avatar';
          const unameRaw = (u.username || '').trim();
          const initial = unameRaw ? unameRaw.charAt(0).toUpperCase() : '?';
          const avatarUrl = u.avatar_url || null;
          if (avatarUrl) {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = unameRaw || 'User';
            avatarWrap.appendChild(img);
          } else {
            avatarWrap.textContent = initial;
          }
          const name = document.createElement('span');
          name.className = 'users-leaderboard-name';
          const uname = unameRaw;
          name.textContent = uname ? (uname.charAt(0).toUpperCase() + uname.slice(1)) : '(unknown)';
          main.appendChild(rank);
          main.appendChild(avatarWrap);
          main.appendChild(name);
          const count = document.createElement('span');
          count.className = 'users-leaderboard-count';
          const c = Number(u.count) || 0;
          count.textContent = `${c} link${c === 1 ? '' : 's'}`;
          li.appendChild(main);
          li.appendChild(count);
          list.appendChild(li);
        });
        container.appendChild(title);
        container.appendChild(list);
        usersLeaderboardEl.innerHTML = '';
        usersLeaderboardEl.appendChild(container);
      }
    }
    document.querySelectorAll('.chart-skeleton').forEach(el => el.remove());
  } catch (e) {
    document.querySelectorAll('.chart-skeleton').forEach(el => el.remove());
    if (statsBox) statsBox.innerHTML = '<div class="muted">Failed to load stats.</div>';
    if (monthCanvas) monthCanvas.style.display = 'none';
    if (foldersCanvas) foldersCanvas.style.display = 'none';
    if (usersCanvas) usersCanvas.style.display = 'none';
  }
}

let folders = [];
let currentFolder = null;

function getFolderDisplayName(folder) {
  if (!folder) return '';
  const parts = [folder.name];
  let current = folder;
  const seen = new Set();
  while (current.parent_id && !seen.has(current.parent_id)) {
    seen.add(current.parent_id);
    const parent = (folders || []).find(f => String(f.id) === String(current.parent_id));
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  return parts.join(' / ');
}

// Local preferences for root-level folder order, pinned folders, and expanded branches
let rootFolderOrder = [];
let pinnedRootFolders = new Set();
let expandedFolders = new Set();
// Local per-folder activity state: last time each folder was opened, and unread counts
let folderLastOpened = {};
let folderUnreadCounts = {};

function loadFolderPrefs() {
  try {
    const rawOrder = localStorage.getItem('rootFolderOrder');
    rootFolderOrder = rawOrder ? JSON.parse(rawOrder) : [];
  } catch (_e) {
    rootFolderOrder = [];
  }
  try {
    const rawPinned = localStorage.getItem('pinnedRootFolders');
    const arr = rawPinned ? JSON.parse(rawPinned) : [];
    pinnedRootFolders = new Set(arr.map(String));
  } catch (_e2) {
    pinnedRootFolders = new Set();
  }
  try {
    const rawExpanded = localStorage.getItem('expandedFolders');
    const arrExp = rawExpanded ? JSON.parse(rawExpanded) : [];
    expandedFolders = new Set(arrExp.map(String));
  } catch (_e3) {
    expandedFolders = new Set();
  }
}

function saveFolderPrefs() {
  try {
    localStorage.setItem('rootFolderOrder', JSON.stringify(rootFolderOrder || []));
    localStorage.setItem('pinnedRootFolders', JSON.stringify(Array.from(pinnedRootFolders || [])));
    localStorage.setItem('expandedFolders', JSON.stringify(Array.from(expandedFolders || [])));
  } catch (_e) {}
}

function loadFolderActivityPrefs() {
  try {
    const raw = localStorage.getItem('folderLastOpened');
    folderLastOpened = raw ? JSON.parse(raw) : {};
  } catch (_e) {
    folderLastOpened = {};
  }
}

function saveFolderActivityPrefs() {
  try {
    localStorage.setItem('folderLastOpened', JSON.stringify(folderLastOpened || {}));
  } catch (_e) {
    // ignore
  }
}

function markFolderOpened(folderId) {
  if (!folderId) return;
  const key = String(folderId);
  folderLastOpened[key] = Date.now();
  saveFolderActivityPrefs();
}

async function refreshFolderUnreadCounts() {
  if (!folders || !folders.length) {
    folderUnreadCounts = {};
    return;
  }
  const meUsername = currentUser && currentUser.username ? currentUser.username.trim().toLowerCase() : null;
  const lastOpened = folderLastOpened || {};
  const counts = {};
  try {
    const links = await api('/api/links');
    (links || []).forEach((l) => {
      const createdBy = (l.created_by || '').trim().toLowerCase();
      if (meUsername && createdBy && createdBy === meUsername) return; // ignore own links
      if (!l.created_at) return;
      const createdAtMs = new Date(l.created_at).getTime();
      if (!Number.isFinite(createdAtMs)) return;
      let fids = [];
      if (Array.isArray(l.folder_ids) && l.folder_ids.length) {
        fids = l.folder_ids;
      } else if (l.folder_id) {
        fids = [l.folder_id];
      }
      fids.forEach((fid) => {
        const key = String(fid);
        const seenTs = Number(lastOpened[key] || 0);
        if (!seenTs || createdAtMs > seenTs) {
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    });
    folderUnreadCounts = counts;
    renderFolders();
  } catch (_e) {
    // ignore errors computing unread counts
  }
}

loadFolderPrefs();
loadFolderActivityPrefs();

async function loadFolders() {
  renderFoldersSkeleton();
  folders = await api('/api/folders');
  // ensure root-level order list is in sync with current folders
  const roots = (folders || []).filter(f => !f.parent_id);
  const rootIds = roots.map(f => String(f.id));
  if (!rootFolderOrder || !rootFolderOrder.length) {
    rootFolderOrder = rootIds.slice();
  } else {
    const idSet = new Set(rootIds);
    rootFolderOrder = rootFolderOrder.filter(id => idSet.has(String(id)));
    rootIds.forEach(id => {
      if (!rootFolderOrder.includes(String(id))) rootFolderOrder.push(String(id));
    });
  }
  // keep expanded folder list in sync with existing folders
  const allIds = new Set((folders || []).map(f => String(f.id)));
  expandedFolders = new Set(Array.from(expandedFolders || []).filter(id => allIds.has(String(id))));
  saveFolderPrefs();
  renderFolders();
  populateFolderSelect();
  updateLinksHeading();
}

function renderFoldersSkeleton() {
  if (!foldersEl) return;
  foldersEl.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const li = document.createElement('li');
    li.className = 'folder';
    const row = document.createElement('div');
    row.className = 'folder-row';
    const line = document.createElement('div');
    line.className = 'skeleton skeleton-text lg';
    line.style.width = (70 - i * 5) + '%';
    row.appendChild(line);
    li.appendChild(row);
    foldersEl.appendChild(li);
  }
}

function buildFolderPathLabel() {
  if (!folders || !folders.length || currentFolder == null) return 'All Links';
  const byId = {};
  folders.forEach(f => { byId[String(f.id)] = f; });
  const segments = [];
  let cursor = byId[String(currentFolder)] || null;
  while (cursor) {
    segments.unshift(cursor.name);
    if (!cursor.parent_id) break;
    cursor = byId[String(cursor.parent_id)] || null;
  }
  if (!segments.length) return 'All Links';
  if (segments.length === 1) return segments[0];
  return segments.join(' >> ');
}

function updateLinksHelper() {
  if (!linksHelper) return;

  // All Links view: explain the global Add Link flow
  if (currentFolder == null) {
    linksHelper.style.display = 'block';
    linksHelper.innerHTML = `
      <div class="links-helper-title">How to add a new link</div>
      <p>Use the <strong>Add Link</strong> button in the sidebar: paste your URL, add an optional note, choose one or more folders, then click <strong>Add Link</strong>. Saved links will appear here, grouped by date.</p>
    `;
    return;
  }

  // Inside a specific folder: show CTA to add a link and motivational text
  linksHelper.style.display = 'block';
  linksHelper.innerHTML = `
    <div class="links-helper-title">Add a link to this folder</div>
    <p>Increase your work quality by adding quality reference links today. Use the <strong>Add Link</strong> button in the sidebar, then select this folder when saving.</p>
    <button type="button" class="links-helper-cta">Add a link</button>
  `;

  const ctaBtn = linksHelper.querySelector('.links-helper-cta');
  if (ctaBtn) {
    ctaBtn.onclick = () => {
      openAddLinkOverlay();
    };
  }
}

function updateLinksHeading() {
  if (!linksHeading) return;
  const label = buildFolderPathLabel();
  linksHeading.textContent = label || 'All Links';
  updateLinksHelper();
}

function renderFolders() {
  foldersEl.innerHTML = '';
  const liAll = document.createElement('li');
  liAll.className = 'folder folder-all' + (currentFolder === null ? ' active' : '');
  const allRow = document.createElement('div');
  allRow.className = 'folder-all-row';
  const allIcon = document.createElement('span');
  allIcon.className = 'folder-all-icon';
  allIcon.textContent = '🔗';
  const allLabel = document.createElement('span');
  allLabel.className = 'folder-all-label';
  allLabel.textContent = 'All Links';
  allRow.appendChild(allIcon);
  allRow.appendChild(allLabel);
  liAll.appendChild(allRow);
  liAll.onclick = () => {
    currentFolder = null;
    showLinksView();
    loadLinks();
    renderFolders();
    updateLinksHeading();
    // on small screens, auto-scroll to the links list
    if (window.innerWidth <= 768 && linksSection && typeof linksSection.scrollIntoView === 'function') {
      setTimeout(() => {
        linksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };
  foldersEl.appendChild(liAll);
  const byParent = {};
  folders.forEach(f => {
    const pid = f.parent_id || null;
    if (!byParent[pid]) byParent[pid] = [];
    byParent[pid].push(f);
  });

  function renderBranch(parentId, depth) {
    let list = byParent[parentId] || [];
    // For root-level folders, apply pinned + custom ordering
    if (parentId === null) {
      const pinned = [];
      const normal = [];
      list.forEach(f => {
        (pinnedRootFolders.has(String(f.id)) ? pinned : normal).push(f);
      });
      function sortByOrder(arr) {
        return arr.slice().sort((a, b) => {
          const aId = String(a.id);
          const bId = String(b.id);
          const ai = rootFolderOrder.indexOf(aId);
          const bi = rootFolderOrder.indexOf(bId);
          const ap = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
          const bp = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
          return ap - bp;
        });
      }
      list = sortByOrder(pinned).concat(sortByOrder(normal));
    }
    list.forEach(f => {
      const li = document.createElement('li');
      li.className = 'folder depth-' + depth + (currentFolder === f.id ? ' active' : '');
      li.dataset.id = String(f.id);
      const idStr = String(f.id);
      const hasChildren = !!(byParent[f.id] && byParent[f.id].length);

      const row = document.createElement('div'); row.className = 'folder-row';
      if (depth > 0) {
        row.style.marginLeft = (depth * 18) + 'px';
      }

      // expand / collapse chevron (left side, like design)
      let toggle = null;
      if (hasChildren) {
        const expanded = expandedFolders.has(idStr);
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'folder-toggle' + (expanded ? ' expanded' : '');
        toggle.onclick = (e) => {
          e.stopPropagation();
          if (expandedFolders.has(idStr)) expandedFolders.delete(idStr);
          else expandedFolders.add(idStr);
          saveFolderPrefs();
          renderFolders();
        };
        row.appendChild(toggle);
      }

      // Static pin indicator for root-level folders (state controlled from menu)
      if (depth === 0 && pinnedRootFolders.has(idStr)) {
        const pinIcon = document.createElement('span');
        pinIcon.className = 'folder-pin-indicator';
        pinIcon.textContent = '★';
        row.appendChild(pinIcon);
      }

      // Folder icon for all folders (color varies by depth)
      const folderIcon = document.createElement('span');
      folderIcon.className = 'folder-icon ' + (depth === 0 ? 'folder-icon-root' : 'folder-icon-sub');
      folderIcon.textContent = '📁';
      row.appendChild(folderIcon);

      const nameSpan = document.createElement('span'); nameSpan.className = 'folder-name';
      nameSpan.textContent = depth > 0 ? '↳ ' + f.name : f.name;
      nameSpan.onclick = () => {
        currentFolder = f.id;
        markFolderOpened(f.id);
        showLinksView();
        loadLinks();
        renderFolders();
        updateLinksHeading();
        // refresh unread counts in the background (e.g., if other folders have new links)
        refreshFolderUnreadCounts();
        // on small screens, auto-scroll to the links list for convenience
        if (window.innerWidth <= 768 && linksSection && typeof linksSection.scrollIntoView === 'function') {
          setTimeout(() => {
            linksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }
      };

      const unreadCount = folderUnreadCounts[idStr] || 0;
      if (unreadCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'folder-unread-badge';
        badge.textContent = String(unreadCount > 9 ? '9+' : unreadCount);
        row.appendChild(badge);
      }

      const btn = document.createElement('button'); btn.className = 'folder-actions'; btn.textContent = '⋮';
      btn.onclick = (e) => { e.stopPropagation(); openFolderMenu(f, li, btn); };

      row.appendChild(nameSpan);
      row.appendChild(btn);
      li.appendChild(row);

      // Drag-and-drop ordering for root-level folders
      if (depth === 0) {
        li.draggable = true;
        li.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(f.id));
          li.classList.add('dragging');
        });
        li.addEventListener('dragend', () => {
          li.classList.remove('dragging');
          foldersEl.querySelectorAll('.folder.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        li.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          li.classList.add('drag-over');
        });
        li.addEventListener('dragleave', () => {
          li.classList.remove('drag-over');
        });
        li.addEventListener('drop', (e) => {
          e.preventDefault();
          li.classList.remove('drag-over');
          const sourceId = e.dataTransfer.getData('text/plain');
          const targetId = String(f.id);
          if (!sourceId || sourceId === targetId) return;
          const srcFolder = folders.find(x => String(x.id) === String(sourceId));
          const tgtFolder = folders.find(x => String(x.id) === targetId);
          if (!srcFolder || !tgtFolder) return;
          if ((srcFolder.parent_id || null) !== (tgtFolder.parent_id || null)) return; // only reorder siblings
          const sId = String(sourceId);
          const tId = targetId;
          const sIdx = rootFolderOrder.indexOf(sId);
          const tIdx = rootFolderOrder.indexOf(tId);
          if (sIdx === -1 || tIdx === -1) return;
          rootFolderOrder.splice(sIdx, 1);
          const newIndex = rootFolderOrder.indexOf(tId);
          rootFolderOrder.splice(newIndex, 0, sId);
          saveFolderPrefs();
          renderFolders();
        });
      }

      foldersEl.appendChild(li);
      if (expandedFolders.has(idStr)) {
        renderBranch(f.id, depth + 1);
      }
    });
  }

  renderBranch(null, 0);
}

async function duplicateFolderTree(folder, newRootName) {
  if (!folders || !folders.length) return;
  const childrenByParent = {};
  folders.forEach((f) => {
    if (f.parent_id == null) return;
    const key = String(f.parent_id);
    if (!childrenByParent[key]) childrenByParent[key] = [];
    childrenByParent[key].push(f);
  });

  async function cloneNode(source, parentId, overrideName) {
    const payload = { name: overrideName || source.name, parent_id: parentId };
    const created = await api('/api/folders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const children = childrenByParent[String(source.id)] || [];
    for (const child of children) {
      await cloneNode(child, created.id, null);
    }
  }

  const parentId = folder.parent_id || null;
  await cloneNode(folder, parentId, newRootName);
}

function openFolderMenu(folder, liElem, btnElem) {
  // remove any existing menu
  const existing = document.querySelector('.folder-menu'); if (existing) existing.remove();
  const menu = document.createElement('div'); menu.className = 'folder-menu';
  const renameBtn = document.createElement('button'); renameBtn.textContent = 'Rename';
  const subfolderBtn = document.createElement('button'); subfolderBtn.textContent = 'Add subfolder';
  const isRoot = !folder.parent_id;
  let pinToggleBtn = null;
  if (isRoot) {
    pinToggleBtn = document.createElement('button');
    const idStr = String(folder.id);
    const isPinned = pinnedRootFolders.has(idStr);
    pinToggleBtn.textContent = isPinned ? 'Unpin folder' : 'Pin folder';
  }
  const duplicateBtn = document.createElement('button'); duplicateBtn.textContent = 'Duplicate';
  const bulkBtn = document.createElement('button'); bulkBtn.textContent = 'Add bulk links';
  const delBtn = document.createElement('button'); delBtn.textContent = 'Delete';
  menu.appendChild(renameBtn);
  menu.appendChild(subfolderBtn);
  menu.appendChild(duplicateBtn);
  if (pinToggleBtn) menu.appendChild(pinToggleBtn);
  menu.appendChild(bulkBtn);
  menu.appendChild(delBtn);
  // position menu next to button
  const rect = btnElem.getBoundingClientRect();
  menu.style.top = (rect.bottom + window.scrollY + 6) + 'px';
  menu.style.left = (rect.left + window.scrollX) + 'px';
  document.body.appendChild(menu);
  function cleanup() { menu.remove(); document.removeEventListener('click', onDoc); }
  function onDoc(ev) { if (!menu.contains(ev.target) && ev.target !== btnElem) cleanup(); }
  document.addEventListener('click', onDoc);
  renameBtn.onclick = async (ev) => {
    ev.stopPropagation();
    cleanup();
    openFolderRenameModal(folder);
  };
  subfolderBtn.onclick = async (ev) => {
    ev.stopPropagation(); cleanup();
    const subName = prompt('Subfolder name', '');
    if (!subName || !subName.trim()) return;
    try {
      await api('/api/folders', { method: 'POST', body: JSON.stringify({ name: subName.trim(), parent_id: folder.id }) });
      await loadFolders();
      showToast('Subfolder created');
    } catch (e) {
      showToast('Failed to create subfolder', 'error');
    }
  };
  duplicateBtn.onclick = async (ev) => {
    ev.stopPropagation(); cleanup();
    let suggested = folder.name ? folder.name + ' copy' : 'New folder copy';
    let newName = prompt('Name for duplicated folder', suggested);
    if (newName == null) return; // user cancelled
    newName = newName.trim();
    if (!newName) {
      showToast('Folder name is required', 'error');
      return;
    }
    try {
      await duplicateFolderTree(folder, newName);
      await loadFolders();
      showToast('Folder duplicated');
    } catch (e) {
      showToast('Failed to duplicate folder', 'error');
    }
  };
  bulkBtn.onclick = (ev) => {
    ev.stopPropagation(); cleanup();
    if (!bulkLinksModal || !bulkLinksTextarea || !bulkLinksFolderLabel) return;
    bulkTargetFolderId = folder.id;
    bulkLinksFolderLabel.textContent = `Folder: ${folder.name}`;
    bulkLinksTextarea.value = '';
    bulkLinksModal.style.display = 'flex';
    bulkLinksModal.setAttribute('aria-hidden', 'false');
    bulkLinksTextarea.focus();
  };
  if (pinToggleBtn) {
    pinToggleBtn.onclick = (ev) => {
      ev.stopPropagation();
      cleanup();
      const idStr = String(folder.id);
      if (pinnedRootFolders.has(idStr)) pinnedRootFolders.delete(idStr);
      else pinnedRootFolders.add(idStr);
      saveFolderPrefs();
      renderFolders();
    };
  }
  delBtn.onclick = async (ev) => {
    ev.stopPropagation(); cleanup();
    const ok = confirm('Deleting this folder will permanently delete its associated links (links only in this folder). Continue?');
    if (!ok) return;
    try { await api('/api/folders/' + folder.id, { method: 'DELETE' }); await loadFolders(); await loadLinks(); showToast('Folder deleted'); } catch (e) { showToast('Delete failed', 'error'); }
  };
}

function closeBulkLinksModal() {
  if (!bulkLinksModal) return;
  bulkLinksModal.style.display = 'none';
  bulkLinksModal.setAttribute('aria-hidden', 'true');
  bulkTargetFolderId = null;
}

if (bulkLinksCancel) {
  bulkLinksCancel.addEventListener('click', () => {
    closeBulkLinksModal();
  });
}

if (bulkLinksModal) {
  bulkLinksModal.addEventListener('click', (e) => {
    if (e.target === bulkLinksModal) {
      closeBulkLinksModal();
    }
  });
}

function openFolderRenameModal(folder) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay folder-rename-modal';
  overlay.setAttribute('aria-hidden', 'false');

  const card = document.createElement('div');
  card.className = 'modal-card';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const h2 = document.createElement('h2');
  h2.textContent = 'Rename folder';
  const subtitle = document.createElement('p');
  subtitle.className = 'modal-subtitle';
  subtitle.textContent = folder.name;
  header.appendChild(h2);
  header.appendChild(subtitle);

  const body = document.createElement('div');
  body.className = 'modal-body';
  const label = document.createElement('label');
  label.className = 'modal-label';
  label.textContent = 'New name';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'modal-input';
  input.value = folder.name;
  body.appendChild(label);
  body.appendChild(input);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary';
  cancelBtn.textContent = 'Cancel';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Save';
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() {
    overlay.setAttribute('aria-hidden', 'true');
    document.body.removeChild(overlay);
  }

  cancelBtn.onclick = () => close();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  function doSave() {
    const newName = (input.value || '').trim();
    if (!newName || newName === folder.name) {
      close();
      return;
    }
    (async () => {
      try {
        await api('/api/folders/' + folder.id, {
          method: 'PUT',
          body: JSON.stringify({ name: newName })
        });
        await loadFolders();
        await loadLinks();
        showToast('Folder renamed');
      } catch (_e) {
        showToast('Rename failed', 'error');
      } finally {
        close();
      }
    })();
  }

  saveBtn.onclick = () => doSave();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

if (bulkLinksSave) {
  bulkLinksSave.addEventListener('click', async () => {
    if (!bulkLinksTextarea || !bulkTargetFolderId) {
      closeBulkLinksModal();
      return;
    }
    const raw = bulkLinksTextarea.value || '';
    const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) {
      showToast('Please paste at least one URL', 'error', 2500);
      return;
    }
    bulkLinksSave.disabled = true;
    bulkLinksSave.textContent = 'Adding...';
    let added = 0, skipped = 0, failed = 0;
    for (const url of lines) {
      try {
        await api('/api/links', {
          method: 'POST',
          body: JSON.stringify({ url, folder_id: bulkTargetFolderId, note: null })
        });
        added++;
      } catch (err) {
        if (err.status === 409) {
          skipped++;
        } else {
          failed++;
        }
      }
    }

    await loadFolders();
    await loadLinks();
    if (dashboardSection && dashboardSection.style.display === 'block') {
      loadDashboardStats();
    }
    let msg = `Added ${added} link${added === 1 ? '' : 's'}`;
    if (skipped) msg += `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`;
    if (failed) msg += `, ${failed} failed`;
    showToast(msg);
  });
}

function populateFolderSelect() {
  // populate multi-select dropdown for folders
  if (!linkFolder) return;
  linkFolder.innerHTML = '<option value="">(No Folder)</option>';
  (folders || []).forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = getFolderDisplayName(f);
    linkFolder.appendChild(opt);
  });

  // also rebuild custom multi-select panel
  if (folderMultiPanel && folderMultiSelected) {
    folderMultiPanel.innerHTML = '';
    if (!folders.length) {
      const empty = document.createElement('div');
      empty.className = 'ms-empty';
      empty.textContent = 'No folders yet';
      folderMultiPanel.appendChild(empty);
      folderMultiSelected.textContent = 'No folder selected';
    } else {
      (folders || []).forEach(f => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = f.id;
        cb.addEventListener('change', () => {
          // sync to hidden select
          const opt = Array.from(linkFolder.options).find(o => String(o.value) === String(f.id));
          if (opt) opt.selected = cb.checked;
          updateFolderMultiSelectedLabel();
        });
        const span = document.createElement('span');
        span.textContent = getFolderDisplayName(f);
        // checkbox first, then text
        label.appendChild(cb);
        label.appendChild(span);
        folderMultiPanel.appendChild(label);
      });
      updateFolderMultiSelectedLabel();
    }
  }
}

function getSelectedFolderIds() {
  if (!linkFolder) return [];
  const ids = [];
  const opts = linkFolder.selectedOptions || [];
  for (const opt of opts) {
    if (opt.value) ids.push(opt.value);
  }
  return ids;
}

function clearSelectedFolderIds() {
  if (!linkFolder) return;
  Array.from(linkFolder.options || []).forEach(o => { o.selected = false; });
  if (folderMultiPanel) {
    Array.from(folderMultiPanel.querySelectorAll('input[type="checkbox"]') || []).forEach(cb => { cb.checked = false; });
  }
  updateFolderMultiSelectedLabel();
}

function showConfettiCelebration(name) {
  let overlay = document.getElementById('confettiOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confettiOverlay';
    overlay.className = 'confetti-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';

  const msg = document.createElement('div');
  msg.className = 'confetti-message';
  msg.textContent = `Keep it up, ${name}! You just reached #1 🎉`;
  overlay.appendChild(msg);

  const colors = ['#f97316','#22c55e','#3b82f6','#e11d48','#facc15'];
  const pieces = 80;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const left = Math.random() * 100;
    const delay = Math.random() * 0.8;
    const duration = 2 + Math.random();
    piece.style.left = left + '%';
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = delay + 's';
    piece.style.animationDuration = duration + 's';
    overlay.appendChild(piece);
  }

  overlay.style.display = 'block';
  if (confettiTimeout) clearTimeout(confettiTimeout);
  confettiTimeout = setTimeout(() => {
    overlay.style.display = 'none';
  }, 2600);
}

function renderNotifications() {
  if (!notificationsList) return;
  notificationsList.innerHTML = '';
  if (!notifications.length) {
    const empty = document.createElement('div');
    empty.className = 'notifications-empty';
    empty.textContent = 'No notifications yet.';
    notificationsList.appendChild(empty);
    return;
  }
  notifications.forEach((n) => {
    const item = document.createElement('div');
    item.className = 'notifications-item';
    const msg = document.createElement('div');
    msg.textContent = n.message;
    item.appendChild(msg);
    if (n.createdAt) {
      const t = document.createElement('time');
      t.textContent = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      item.appendChild(t);
    }
    if (n.type === 'link_added' && n.folderId) {
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'notifications-cta';
      cta.textContent = 'Check now';
      cta.onclick = () => {
        currentFolder = n.folderId;
        markFolderOpened(n.folderId);
        showLinksView();
        loadLinks();
        renderFolders();
        updateLinksHeading();
        refreshFolderUnreadCounts();
        if (notificationsPanel) {
          notificationsPanel.style.display = 'none';
          notificationsPanel.setAttribute('aria-hidden', 'true');
        }
      };
      item.appendChild(cta);
    }

    notificationsList.appendChild(item);
  });
}

function getNotificationsLastSeenKey() {
  if (!currentUser || !currentUser.username) return null;
  return 'linkstorer:lastSeenNotification:' + currentUser.username;
}

function getNotificationsLastSeenTimestamp() {
  const key = getNotificationsLastSeenKey();
  if (!key || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch (_e) {
    return null;
  }
}

function setNotificationsLastSeenTimestamp(ts) {
  const key = getNotificationsLastSeenKey();
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, String(ts));
  } catch (_e) {
    // ignore storage failures
  }
}

function getUnseenNotificationCount() {
  if (!notifications || !notifications.length) return 0;
  const lastSeen = getNotificationsLastSeenTimestamp();
  return notifications.filter((n) => {
    if (!n) return false;
    const idStr = n.id != null ? String(n.id) : '';
    // treat local/in-app notifications (id starting with 'local-') as always seen for the badge
    if (idStr.startsWith('local-')) return false;
    if (!n.createdAt) return !lastSeen;
    return !lastSeen || n.createdAt > lastSeen;
  }).length;
}

function markAllNotificationsSeen() {
  const now = Date.now();
  setNotificationsLastSeenTimestamp(now);
  if (notificationsBadge) {
    notificationsBadge.textContent = '';
    notificationsBadge.style.display = 'none';
  }
}

function addNotification(message, extra) {
  const entry = {
    id: extra && extra.id != null ? extra.id : ('local-' + Date.now()),
    type: (extra && extra.type) || 'general',
    actor: (extra && extra.actor) || null,
    linkId: (extra && extra.linkId) || null,
    folderId: (extra && extra.folderId) || null,
    message,
    createdAt: (extra && extra.createdAt) || Date.now()
  };
  notifications.unshift(entry);
  if (notifications.length > 20) notifications = notifications.slice(0, 20);
  renderNotifications();
  if (notificationsBadge) {
    notificationsBadge.textContent = String(notifications.length > 9 ? '9+' : notifications.length);
    notificationsBadge.style.display = 'flex';
  }
  if (notificationsPanel) {
    notificationsPanel.style.display = 'block';
    notificationsPanel.setAttribute('aria-hidden', 'false');
  }
}

async function fetchNotificationsFromServer() {
  if (!currentUser) return;
  try {
    const rows = await api('/api/notifications');
    const meUsername = currentUser && currentUser.username ? currentUser.username : null;
    const filtered = (rows || []).filter(n => !meUsername || !n.actor || n.actor !== meUsername);
    notifications = filtered.map((n) => ({
      id: n.id,
      type: n.type || 'link_added',
      actor: n.actor || null,
      linkId: n.link_id || null,
      folderId: n.folder_id || null,
      message: n.message,
      createdAt: n.created_at ? new Date(n.created_at).getTime() : Date.now()
    }));
    renderNotifications();
    if (notificationsBadge) {
      const count = getUnseenNotificationCount();
      if (count) {
        notificationsBadge.textContent = String(count > 9 ? '9+' : count);
        notificationsBadge.style.display = 'flex';
      } else {
        notificationsBadge.textContent = '';
        notificationsBadge.style.display = 'none';
      }
    }
  } catch (e) {
    // ignore notification fetch errors
  }
}

async function updateNotificationsAfterLinkAdded() {
  try {
    // ensure we know the current user
    if (!currentUser) {
      try {
        currentUser = await api('/api/me');
      } catch (e) {
        // ignore; we'll fall back to generic messaging
      }
    }
    const stats = await api('/api/dashboard');
    const usersMonthlyRaw = Array.isArray(stats.users_monthly) ? stats.users_monthly.slice() : [];
    if (!usersMonthlyRaw.length) return;

    usersMonthlyRaw.sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
    const leader = usersMonthlyRaw[0];
    const meUsernameRaw = currentUser && currentUser.username ? currentUser.username.trim() : null;
    const mePretty = meUsernameRaw ? (meUsernameRaw.charAt(0).toUpperCase() + meUsernameRaw.slice(1)) : 'You';
    const meEntry = meUsernameRaw
      ? usersMonthlyRaw.find(u => (u.username || '').trim().toLowerCase() === meUsernameRaw.toLowerCase())
      : null;

    const meCount = Number(meEntry ? meEntry.count : 0) || 0;
    const leaderCount = Number(leader.count) || 0;

    let message;
    let rank = null;
    if (meEntry) {
      rank = usersMonthlyRaw.indexOf(meEntry) + 1;
    }

    if (meEntry && meEntry === leader) {
      message = `Awesome, ${mePretty}! You're already #1 this month with ${meCount} link${meCount === 1 ? '' : 's'}. Keep it going!`;
    } else {
      const diff = Math.max(leaderCount - meCount, 0);
      const leaderName = leader.username ? (leader.username.charAt(0).toUpperCase() + leader.username.slice(1)) : 'the top user';
      if (!meEntry) {
        message = `${mePretty}, you're just getting started. Add ${leaderCount} more link${leaderCount === 1 ? '' : 's'} to catch up to #1 (${leaderName}).`;
      } else if (diff === 0) {
        message = `Great job, ${mePretty}! You're now tied for #1 with ${meCount} link${meCount === 1 ? '' : 's'}. One more to take the solo lead!`;
      } else {
        message = `${mePretty}, you're currently #${rank}. Add ${diff} more link${diff === 1 ? '' : 's'} to reach #1 (${leaderName}).`;
      }
    }

    if (message) addNotification(message);

    if (meEntry && rank === 1 && (lastLeaderboardRank === null || lastLeaderboardRank > 1)) {
      showConfettiCelebration(mePretty);
    }
    if (rank !== null) {
      lastLeaderboardRank = rank;
    }
  } catch (e) {
    // silently ignore notification errors; do not block link creation UX
  }
}

if (newFolderToggle && folderForm && folderName) {
  newFolderToggle.addEventListener('click', () => {
    const isHidden = folderForm.style.display === 'none' || !folderForm.style.display;
    folderForm.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      setTimeout(() => folderName.focus(), 0);
    }
  });
}

if (cancelFolderCreate && folderForm) {
  cancelFolderCreate.addEventListener('click', () => {
    folderForm.style.display = 'none';
    if (folderName) folderName.value = '';
  });
}

if (folderForm) {
  folderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!folderName || !folderName.value.trim()) return;
    await api('/api/folders', { method: 'POST', body: JSON.stringify({ name: folderName.value.trim() }) });
    folderName.value = '';
    folderForm.style.display = 'none';
    await loadFolders();
  });
}

linkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = linkUrl.value.trim(); if (!url) return;
  let folder_ids = getSelectedFolderIds();
  // If user has a folder selected in the sidebar but hasn't
  // explicitly chosen folders in the multi-select, default to
  // adding the link into the current folder for convenience.
  if ((!folder_ids || folder_ids.length === 0) && currentFolder) {
    folder_ids = [currentFolder];
  }
  const note = linkNote.value.trim() || null;
  try {
    await api('/api/links', { method: 'POST', body: JSON.stringify({ url, folder_ids, note }) });
    linkUrl.value = ''; linkNote.value = '';
    await loadLinks();
    if (dashboardSection && dashboardSection.style.display === 'block') {
      loadDashboardStats();
    }
    let folderNameTxt = '(No Folder)';
    if (folder_ids && folder_ids.length === 1) {
      const f = folders.find(x => String(x.id) === String(folder_ids[0]));
      if (f) folderNameTxt = f.name;
    } else if (folder_ids && folder_ids.length > 1) {
      folderNameTxt = `${folder_ids.length} folders`;
    }
    clearSelectedFolderIds();
    showToast(`Link added successfully to ${folderNameTxt}`);
    updateNotificationsAfterLinkAdded().catch(() => {});
  } catch (err) {
    if (err.status === 409 && err.body && err.body.existing) {
      const ex = err.body.existing;
      const existingFolderName = (ex.folder_ids || [])[0] ? (folders.find(x => x.id == ex.folder_ids[0]) || {}).name : '(No Folder)';
      const confirmMsg = `This link already exists in ${existingFolderName} (title: ${ex.title || ex.url}). Do you still want to add it?`;
      if (confirm(confirmMsg)) {
        try {
          await api('/api/links', { method: 'POST', body: JSON.stringify({ url, folder_ids, note, force: true }) });
          linkUrl.value = '';
          linkNote.value = '';
          await loadLinks();
          if (dashboardSection && dashboardSection.style.display === 'block') {
            loadDashboardStats();
          }
          showToast(`Link added successfully`);
          updateNotificationsAfterLinkAdded().catch(() => {});
        }
        catch (e) { showToast('There is issue while adding your link', 'error'); console.error(e); }
      }
      return;
    }
    showToast('There is issue while adding your link', 'error'); console.error('Add link error', err);
  }
});

function updateFolderMultiSelectedLabel() {
  if (!folderMultiSelected || !linkFolder) return;
  const ids = getSelectedFolderIds();
  if (!ids.length) {
    folderMultiSelected.textContent = 'Click to select folders';
    return;
  }
  if (ids.length === 1) {
    const f = folders.find(x => String(x.id) === String(ids[0]));
    folderMultiSelected.textContent = f ? f.name : '1 folder selected';
  } else {
    folderMultiSelected.textContent = `${ids.length} folders selected`;
  }
}

if (folderMultiPanel && folderMultiSelect && folderMultiSelected) {
  folderMultiSelected.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = folderMultiPanel.style.display === 'block';
    folderMultiPanel.style.display = isOpen ? 'none' : 'block';
  });
  document.addEventListener('click', (e) => {
    if (!folderMultiSelect.contains(e.target)) {
      folderMultiPanel.style.display = 'none';
    }
  });
}

async function loadLinks() {
  // build query with folder and date filters
  const params = [];
  if (currentFolder) params.push(`folder_id=${currentFolder}`);
  // date presets
  const preset = document.getElementById('datePreset');
  const custom = document.getElementById('dateCustom');
  let presetValue = 'all';
  if (preset) {
    const v = preset.value;
    presetValue = v || 'all';
    if (v === 'today') params.push(`date=${new Date().toISOString().slice(0,10)}`);
    else if (v === 'yesterday') {
      const d = new Date(); d.setDate(d.getDate()-1); params.push(`date=${d.toISOString().slice(0,10)}`);
    } else if (v === '7') {
      const d = new Date(); d.setDate(d.getDate()-6); params.push(`start=${d.toISOString().slice(0,10)}`);
    } else if (v === 'custom' && custom && custom.value) {
      params.push(`date=${custom.value}`);
    }
  }
  const q = params.length ? ('?' + params.join('&')) : '';
  renderLinksSkeleton();
  const data = await api('/api/links' + q);
  renderLinksGrouped(data || [], presetValue);
}
function renderLinksSkeleton() {
  if (!linksEl) return;
  linksEl.innerHTML = '';
  const group = document.createElement('div');
  group.className = 'date-group';
  for (let i = 0; i < 4; i++) {
    const card = document.createElement('div');
    card.className = 'card skeleton-card';
    const line1 = document.createElement('div'); line1.className = 'skeleton skeleton-text lg'; line1.style.width = '80%';
    const line2 = document.createElement('div'); line2.className = 'skeleton skeleton-text'; line2.style.width = '60%';
    const line3 = document.createElement('div'); line3.className = 'skeleton skeleton-text'; line3.style.width = '40%';
    card.appendChild(line1);
    card.appendChild(line2);
    card.appendChild(line3);
    group.appendChild(card);
  }
  linksEl.appendChild(group);
}
function renderLinksGrouped(arr, presetValue) {
  linksEl.innerHTML = '';
  if (!arr || arr.length === 0) {
    const no = document.createElement('div'); no.className = 'no-links muted'; no.textContent = 'There is no link present related to this date.';
    linksEl.appendChild(no);
    return;
  }

  const isAllFolder = currentFolder === null;

  // For "All Links" folder: flat masonry, only preview and who added
  if (isAllFolder) {
    const wrapper = document.createElement('div'); wrapper.className = 'date-group';
    arr.forEach(l => {
      const card = document.createElement('div'); card.className = 'card';
      // preview (video or image)
      if (l.video) {
        const vid = String(l.video || '');
        function youtubeEmbedFrom(u) {
          try {
            const o = new URL(u);
            const host = o.hostname.replace('www.', '');
            if (host.includes('youtube.com')) {
              const v = o.searchParams.get('v');
              if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&mute=1&controls=1&rel=0`;
            }
            if (host.includes('youtu.be')) {
              const id = o.pathname.split('/').filter(Boolean)[0]; if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=1&rel=0`;
            }
          } catch (e) {}
          return null;
        }
        const yt = youtubeEmbedFrom(vid);
        if (yt || vid.includes('youtube.com/embed')) {
          const container = document.createElement('div');
          container.className = 'video-preview-wrap';
          const posterLink = document.createElement('a'); posterLink.href = l.url; posterLink.target = '_blank';
          if (l.image) { const pImg = document.createElement('img'); pImg.src = l.image; posterLink.appendChild(pImg); }
          container.appendChild(posterLink);
          const iframe = document.createElement('iframe'); iframe.style.position = 'absolute'; iframe.style.top = '0'; iframe.style.left = '0'; iframe.style.width = '100%'; iframe.style.height = '100%'; iframe.style.border = '0'; iframe.setAttribute('allow', 'autoplay; encrypted-media');
          const embedSrc = yt || vid;
          container.addEventListener('mouseenter', () => { if (!iframe.src) iframe.src = embedSrc; });
          container.addEventListener('mouseleave', () => { iframe.src = ''; });
          const fullBtn = document.createElement('button');
          fullBtn.type = 'button';
          fullBtn.className = 'video-preview-btn';
          fullBtn.title = 'Preview video';
          fullBtn.textContent = '⤢';
          fullBtn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openVideoPreview('youtube', embedSrc, l.image || null);
          };
          container.appendChild(fullBtn);
          container.appendChild(iframe);
          card.appendChild(container);
        } else {
          const container = document.createElement('div');
          container.className = 'video-preview-wrap';
          const video = document.createElement('video'); video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'none';
          if (l.image) video.poster = l.image;
          const source = document.createElement('source'); source.src = vid; video.appendChild(source);
          video.addEventListener('mouseenter', () => { video.play().catch(()=>{}); });
          video.addEventListener('mouseleave', () => { video.pause(); try { video.currentTime = 0; } catch(e){} });
          const fullBtn = document.createElement('button');
          fullBtn.type = 'button';
          fullBtn.className = 'video-preview-btn';
          fullBtn.title = 'Preview video';
          fullBtn.textContent = '⤢';
          fullBtn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openVideoPreview('file', vid, l.image || null);
          };
          container.appendChild(video);
          container.appendChild(fullBtn);
          card.appendChild(container);
        }
      } else if (l.image) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'image-preview-wrap';
        const aImg = document.createElement('a'); aImg.href = l.url; aImg.target = '_blank';
        const img = document.createElement('img'); img.src = l.image; aImg.appendChild(img);
        imgWrap.appendChild(aImg);
        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'image-preview-btn';
        viewBtn.textContent = 'View';
        viewBtn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          openImagePreview(l.image);
        };
        imgWrap.appendChild(viewBtn);
        card.appendChild(imgWrap);
      }

      if (l.created_by) {
        const meta = document.createElement('div');
        meta.className = 'card-meta';
        const userWrap = document.createElement('div');
        userWrap.className = 'card-meta-user';
        const avatar = document.createElement('div');
        avatar.className = 'card-meta-avatar';
        const rawName = String(l.created_by || '').trim();
        const initial = rawName ? rawName.charAt(0).toUpperCase() : '?';
        const creatorAvatarUrl = l.created_by_avatar_url || null;
        if (creatorAvatarUrl) {
          const img = document.createElement('img');
          img.src = creatorAvatarUrl;
          img.alt = rawName || 'User';
          avatar.appendChild(img);
        } else {
          avatar.textContent = initial;
        }
        const label = document.createElement('span');
        label.className = 'card-meta-label';
        let pretty = rawName;
        if (pretty) {
          pretty = pretty.charAt(0).toUpperCase() + pretty.slice(1);
        }
        label.textContent = pretty ? `Added by ${pretty}` : 'Added by user';
        userWrap.appendChild(avatar);
        userWrap.appendChild(label);
        meta.appendChild(userWrap);
        card.appendChild(meta);
      }

      wrapper.appendChild(card);
    });
    linksEl.appendChild(wrapper);
    return;
  }
  // group by date (YYYY-MM-DD)
  const groups = {};
  arr.forEach(l => {
    const d = (l.created_at || '').slice(0,10) || 'unknown';
    if (!groups[d]) groups[d] = [];
    groups[d].push(l);
  });
  // sort dates descending
  const dates = Object.keys(groups).sort((a,b) => b.localeCompare(a));
  const today = new Date().toISOString().slice(0,10);
  const yesterdayD = new Date(); yesterdayD.setDate(yesterdayD.getDate()-1); const yesterday = yesterdayD.toISOString().slice(0,10);
  dates.forEach((date, idx) => {
    const heading = document.createElement('div'); heading.className = 'date-heading';
    if (date === today) heading.textContent = 'Today';
    else if (date === yesterday) heading.textContent = 'Yesterday';
    else heading.textContent = date;
    linksEl.appendChild(heading);
    const wrapper = document.createElement('div'); wrapper.className = 'date-group';
    groups[date].forEach(l => {
      const card = document.createElement('div'); card.className = 'card';
      // if preview has a video, render video/iframe that plays on hover
      if (l.video) {
        const vid = String(l.video || '');
        // helper to build youtube embed
        function youtubeEmbedFrom(u) {
          try {
            const o = new URL(u);
            const host = o.hostname.replace('www.', '');
            if (host.includes('youtube.com')) {
              const v = o.searchParams.get('v');
              if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&mute=1&controls=1&rel=0`;
            }
            if (host.includes('youtu.be')) {
              const id = o.pathname.split('/').filter(Boolean)[0]; if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=1&rel=0`;
            }
          } catch (e) {}
          return null;
        }
        const yt = youtubeEmbedFrom(vid);
        if (yt || vid.includes('youtube.com/embed')) {
          const container = document.createElement('div');
          container.className = 'video-preview-wrap';
          const posterLink = document.createElement('a'); posterLink.href = l.url; posterLink.target = '_blank';
          if (l.image) { const pImg = document.createElement('img'); pImg.src = l.image; posterLink.appendChild(pImg); }
          container.appendChild(posterLink);
          const iframe = document.createElement('iframe'); iframe.style.position = 'absolute'; iframe.style.top = '0'; iframe.style.left = '0'; iframe.style.width = '100%'; iframe.style.height = '100%'; iframe.style.border = '0'; iframe.setAttribute('allow', 'autoplay; encrypted-media');
          // don't set src until hover
          const embedSrc = yt || vid;
          container.addEventListener('mouseenter', () => { if (!iframe.src) iframe.src = embedSrc; });
          container.addEventListener('mouseleave', () => { iframe.src = ''; });
          const fullBtn = document.createElement('button');
          fullBtn.type = 'button';
          fullBtn.className = 'video-preview-btn';
          fullBtn.title = 'Preview video';
          fullBtn.textContent = '⤢';
          fullBtn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openVideoPreview('youtube', embedSrc, l.image || null);
          };
          container.appendChild(fullBtn);
          container.appendChild(iframe);
          card.appendChild(container);
        } else {
          // assume direct video (mp4/webm)
          const container = document.createElement('div');
          container.className = 'video-preview-wrap';
          const video = document.createElement('video'); video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'none';
          if (l.image) video.poster = l.image;
          const source = document.createElement('source'); source.src = vid; video.appendChild(source);
          video.addEventListener('mouseenter', () => { video.play().catch(()=>{}); });
          video.addEventListener('mouseleave', () => { video.pause(); try { video.currentTime = 0; } catch(e){} });
          const fullBtn = document.createElement('button');
          fullBtn.type = 'button';
          fullBtn.className = 'video-preview-btn';
          fullBtn.title = 'Preview video';
          fullBtn.textContent = '⤢';
          fullBtn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openVideoPreview('file', vid, l.image || null);
          };
          container.appendChild(video);
          container.appendChild(fullBtn);
          card.appendChild(container);
        }
      } else if (l.image) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'image-preview-wrap';
        const aImg = document.createElement('a'); aImg.href = l.url; aImg.target = '_blank';
        const img = document.createElement('img'); img.src = l.image; aImg.appendChild(img);
        imgWrap.appendChild(aImg);
        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'image-preview-btn';
        viewBtn.textContent = 'View';
        viewBtn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          openImagePreview(l.image);
        };
        imgWrap.appendChild(viewBtn);
        card.appendChild(imgWrap);
      }
      if (l.created_by) {
        const meta = document.createElement('div');
        meta.className = 'card-meta';
        const userWrap = document.createElement('div');
        userWrap.className = 'card-meta-user';
        const avatar = document.createElement('div');
        avatar.className = 'card-meta-avatar';
        const rawName = String(l.created_by || '').trim();
        const initial = rawName ? rawName.charAt(0).toUpperCase() : '?';
        const creatorAvatarUrl = l.created_by_avatar_url || null;
        if (creatorAvatarUrl) {
          const img = document.createElement('img');
          img.src = creatorAvatarUrl;
          img.alt = rawName || 'User';
          avatar.appendChild(img);
        } else {
          avatar.textContent = initial;
        }
        const label = document.createElement('span');
        label.className = 'card-meta-label';
        let pretty = rawName;
        if (pretty) {
          pretty = pretty.charAt(0).toUpperCase() + pretty.slice(1);
        }
        label.textContent = pretty ? `Added by ${pretty}` : 'Added by user';
        userWrap.appendChild(avatar);
        userWrap.appendChild(label);
        meta.appendChild(userWrap);
        card.appendChild(meta);
      }
      if (l.note) {
        const noteEl = document.createElement('div'); noteEl.className = 'note'; noteEl.textContent = l.note; card.appendChild(noteEl);
      }
      const moveRow = document.createElement('div'); moveRow.style.marginTop = '8px';
      const sel = document.createElement('select'); sel.style.minWidth = '140px';
      const optNone = document.createElement('option'); optNone.value = ''; optNone.textContent = '(No Folder)'; sel.appendChild(optNone);
      folders.forEach(f => { const o = document.createElement('option'); o.value = f.id; o.textContent = getFolderDisplayName(f); sel.appendChild(o); });
      sel.value = (l.folder_ids && l.folder_ids.length) ? l.folder_ids[0] : '';
      sel.onchange = async () => {
        try { const val = sel.value || null; await api('/api/links/' + l.id, { method: 'PUT', body: JSON.stringify({ folder_id: val }) }); loadLinks(); } catch (err) { showToast(err.message || 'Error', 'error'); }
      };
      moveRow.appendChild(sel);
      card.appendChild(moveRow);
      const actions = document.createElement('div'); actions.className = 'actions';
      const primaryRow = document.createElement('div'); primaryRow.className = 'actions-row';
      const edit = document.createElement('button'); edit.className = 'edit'; edit.innerHTML = '✏️ Edit';
      const share = document.createElement('button'); share.className = 'share-whatsapp'; share.innerHTML = '💬 WhatsApp';
      const del = document.createElement('button'); del.className = 'delete'; del.innerHTML = '🗑️ Delete';
      edit.onclick = () => enterEditMode(card, l);
      share.onclick = () => {
        const parts = [];
        if (l.title) parts.push(l.title);
        parts.push(l.url);
        if (l.note) parts.push('Note: ' + l.note);
        const text = encodeURIComponent(parts.join(' - '));
        const waUrl = 'https://wa.me/?text=' + text;
        window.open(waUrl, '_blank');
      };
      del.onclick = async () => { if (!confirm('Delete this link?')) return; try { await api('/api/links/' + l.id, { method: 'DELETE' }); loadLinks(); showToast('Link deleted', 'success'); } catch (err) { showToast('Delete failed', 'error'); } };
      primaryRow.appendChild(edit);
      primaryRow.appendChild(share);
      actions.appendChild(primaryRow);
      actions.appendChild(del);
      card.appendChild(actions);
      wrapper.appendChild(card);
    });
    linksEl.appendChild(wrapper);
    if (idx < dates.length - 1) {
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      linksEl.appendChild(sep);
    }
  });
}

function enterEditMode(card, link) {
  card.innerHTML = '';
  const urlInput = document.createElement('input'); urlInput.value = link.url; urlInput.style.width = '100%';
  const titleInput = document.createElement('input'); titleInput.value = link.title || ''; titleInput.style.width = '100%';
  const descInput = document.createElement('textarea'); descInput.value = link.description || ''; descInput.style.width = '100%'; descInput.rows = 3;
  const noteInput = document.createElement('textarea'); noteInput.value = link.note || ''; noteInput.style.width = '100%'; noteInput.rows = 2;
  const save = document.createElement('button'); save.textContent = 'Save';
  const cancel = document.createElement('button'); cancel.textContent = 'Cancel';
  const err = document.createElement('div'); err.className = 'muted'; err.style.color = 'red';
  // build single-folder select for editing
  const editSel = document.createElement('select'); editSel.style.width = '100%'; editSel.style.marginTop = '8px';
  const optNone = document.createElement('option'); optNone.value = ''; optNone.textContent = '(No Folder)'; editSel.appendChild(optNone);
  folders.forEach(f => { const o = document.createElement('option'); o.value = f.id; o.textContent = f.name; editSel.appendChild(o); });
  editSel.value = (link.folder_ids && link.folder_ids.length) ? link.folder_ids[0] : '';
  save.onclick = async () => { try { const val = editSel.value || null; await api('/api/links/' + link.id, { method: 'PUT', body: JSON.stringify({ url: urlInput.value.trim(), title: titleInput.value.trim(), description: descInput.value.trim(), note: noteInput.value.trim(), folder_id: val }) }); await loadLinks(); } catch (e) { err.textContent = e.message; } };
  cancel.onclick = () => loadLinks();
  card.appendChild(urlInput); card.appendChild(titleInput); card.appendChild(descInput); card.appendChild(noteInput); card.appendChild(editSel); card.appendChild(err);
  const row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '8px'; row.style.marginTop = '8px'; row.appendChild(save); row.appendChild(cancel); card.appendChild(row);
}

// initial load: decide between login screen and app based on token validity
(async function init() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (!token) {
    showLoginScreen();
    return;
  }
  try {
    // quick check: if dashboard loads, token is valid
    await api('/api/dashboard');
    enterApp();
    loadCurrentUserProfile();
  } catch (err) {
    if (err.status === 401) {
      localStorage.removeItem('authToken');
      showLoginScreen();
    } else {
      // token present but other error; still enter app so user can see UI
      enterApp();
      loadCurrentUserProfile();
    }
  }
})();

// date filter UI binding
const datePresetEl = document.getElementById('datePreset');
const dateCustomEl = document.getElementById('dateCustom');
if (datePresetEl && dateCustomEl) {
  datePresetEl.addEventListener('change', () => {
    if (datePresetEl.value === 'custom') dateCustomEl.style.display = 'inline-block';
    else dateCustomEl.style.display = 'none';
    loadLinks();
  });
  dateCustomEl.addEventListener('change', () => loadLinks());
}

