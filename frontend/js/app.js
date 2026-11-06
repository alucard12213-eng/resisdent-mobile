// Dynamic backend URL so this works across localhost, 127.0.0.1, LAN IP (e.g. mobile testing),
// Live Server, or when served via npm run dev.
const API_BASE_URL = window.API_BASE_URL || (
    typeof window !== 'undefined' && window.location && window.location.hostname && window.location.protocol.startsWith('http')
        ? `${window.location.protocol}//${window.location.hostname}:8000/api`
        : 'http://localhost:8000/api'
);

/**
 * Resolves a media / storage URL to an absolute web-accessible URL.
 * Handles Laravel /storage paths, base64 data URLs, external HTTP(S) links,
 * and handles mobile local paths gracefully.
 */
function resolveMediaUrl(path) {
    if (!path || typeof path !== 'string') return null;
    const trimmed = path.trim();
    if (!trimmed || trimmed.startsWith('file://')) return null;
    if (trimmed.startsWith('data:image') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    const host = (window.API_BASE_URL || API_BASE_URL).replace(/\/api\/?$/, '');
    return `${host}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}
window.resolveMediaUrl = resolveMediaUrl;

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

/*
|--------------------------------------------------------------------------
| THEME (LIGHT / DARK MODE)
|--------------------------------------------------------------------------
| Applied as early as possible (before DOMContentLoaded) to avoid a flash
| of the wrong theme. Persisted in localStorage so it sticks across pages.
*/

function applyStoredTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

function setTheme(theme) {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const current = localStorage.getItem('theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
}

applyStoredTheme();

function isAuthPage() {
    const path = (window.location.pathname || '').toLowerCase();
    return path.includes('login.html') || path.endsWith('/login') || path === '/login' || path.endsWith('index.html') || path === '/' || path === '';
}

// Check if user is logged in
function checkAuth() {
    const token = localStorage.getItem('auth_token');
    if (!token && !isAuthPage()) {
        if (window.location.pathname.includes('clenro-reports.html')) {
            return;
        }
        window.location.href = 'login.html';
    }
}


// Perform API request
async function apiRequest(endpoint, method = 'GET', data = null) {
    const token = localStorage.getItem('auth_token');
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers
    };

    if (data && (method !== 'GET' && method !== 'HEAD')) {
        options.body = JSON.stringify(data);
    }

    if (typeof window.startGlobalLazyProgress === 'function') {
        try { window.startGlobalLazyProgress(); } catch (e) {}
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        // Handle unauthorized
        if (response.status === 401 && !isAuthPage()) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return null;
        }


        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'API request failed');
        }

        if (method !== 'GET' && method !== 'HEAD' && typeof window.recordApiMutationNotification === 'function') {
            try { window.recordApiMutationNotification(endpoint, method, data, result); } catch (e) {}
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    } finally {
        if (typeof window.finishGlobalLazyProgress === 'function') {
            try { window.finishGlobalLazyProgress(); } catch (e) {}
        }
    }
}

// Logout
function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Get the current user's role slug, e.g. "super_admin" or "admin".
function getUserRole() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (Array.isArray(user.roles) && user.roles.length > 0) {
        return user.roles[0].name;
    }
    return user.role || null;
}

// There are 2 roles on the web dashboard: Super Admin (CLENRO Central)
// and Admin (Barangay Admin — Field Operations).
function getRoleDisplayName(role) {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Barangay Admin';
    return role || 'User';
}

// Where each role should land after logging in / when visiting "home".
function getHomePage(role) {
    return role === 'super_admin' ? 'analytics.html' : 'barangay-overview.html';
}

function loadSidebar() {
    const userStr = localStorage.getItem('user');
    let user = null;
    if (userStr) {
        try { user = JSON.parse(userStr); } catch (e) { user = null; }
    }
    if (!user) {
        user = { name: 'CLENRO Official', role: 'super_admin' };
    }
    const role = getUserRole() || user.role || 'super_admin';
    const isSuperAdmin = role === 'super_admin';
    const roleLabel = getRoleDisplayName(role);

    // SVG icon helper
    const icon = (path, extra = '') => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;" ${extra}>${path}</svg>`;

    // Role-Separated Navigation Structure (Super Admin vs Barangay Admin)
    let links = '';

    if (isSuperAdmin) {
        links += `<a href="analytics.html" class="nav-link" id="nav-analytics">${icon('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>')}Dashboard Analytics</a>`;
        links += `<a href="trucks.html" class="nav-link" id="nav-trucks">${icon('<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>')}Monitor Truck</a>`;
        links += `<a href="employees.html" class="nav-link" id="nav-employees">${icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')}Field Employees</a>`;
        links += `<a href="contractors.html" class="nav-link" id="nav-contractors">${icon('<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/>')}Contractor Fleets</a>`;
        links += `<a href="reports.html" class="nav-link" id="nav-reports">${icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>')}Reports &amp; Issues</a>`;
        links += `<a href="clenro-reports.html" class="nav-link" id="nav-clenro">${icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>')}CLENRO Historical Data</a>`;
        links += `<a href="schedule.html" class="nav-link" id="nav-schedule">${icon('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>')}Collection Schedule</a>`;
        links += `<a href="vendors.html" class="nav-link" id="nav-vendors">${icon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>')}Market Vendors</a>`;
        links += `<a href="attendance.html" class="nav-link" id="nav-attendance">${icon('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')}Attendance Roster</a>`;
        links += `<a href="users.html" class="nav-link" id="nav-users">${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}User Management</a>`;
        links += `<a href="activity-logs.html" class="nav-link" id="nav-activity-logs">${icon('<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>')}Activity Logs</a>`;
    } else {
        links += `<a href="barangay-overview.html" class="nav-link" id="nav-overview">${icon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>')}Barangay Overview</a>`;
        links += `<a href="trucks.html" class="nav-link" id="nav-trucks">${icon('<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>')}Monitor Truck</a>`;
        links += `<a href="residents.html" class="nav-link" id="nav-residents">${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}Resident Accounts</a>`;
        links += `<a href="schedule.html" class="nav-link" id="nav-schedule">${icon('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>')}Collection Schedule</a>`;
        links += `<a href="reports.html" class="nav-link" id="nav-reports">${icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>')}Reports &amp; Issues</a>`;
        links += `<a href="clenro-reports.html" class="nav-link" id="nav-clenro">${icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>')}CLENRO Historical Data</a>`;
        links += `<a href="attendance.html" class="nav-link" id="nav-attendance">${icon('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')}Attendance Roster</a>`;
        links += `<a href="users.html" class="nav-link" id="nav-users">${icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}User Management</a>`;
        links += `<a href="archives.html" class="nav-link" id="nav-archives">${icon('<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>')}Records &amp; Archives</a>`;
        links += `<a href="activity-logs.html" class="nav-link" id="nav-activity-logs">${icon('<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>')}Activity Logs</a>`;
    }

    // Append evergreen pine tree motif accent before footer
    links += `
        <div class="sidebar-tree-motif" aria-hidden="true">
            <svg viewBox="0 0 240 28" fill="currentColor" width="100%" height="24" opacity="0.35">
                <path d="M12 28L18 16H15L20 8H17L22 0L27 8H24L29 16H26L32 28H12ZM42 28L47 18H44L49 10H46L51 2L56 10H53L58 18H55L60 28H42ZM75 28L80 17H77L82 9H79L84 1L89 9H86L91 17H88L93 28H75ZM110 28L115 19H112L117 11H114L119 3L124 11H121L126 19H123L128 28H110ZM145 28L151 16H148L153 8H150L155 0L160 8H157L162 16H159L165 28H145ZM180 28L185 18H182L187 10H184L189 2L194 10H191L196 18H193L198 28H180ZM212 28L217 17H214L219 9H216L221 1L226 9H223L228 17H225L230 28H12Z"/>
            </svg>
        </div>
    `;

    const navContainer = document.getElementById('sidebar-nav');
    if (navContainer) {
        navContainer.innerHTML = links;
        
        // Highlight active link
        const pageName = window.location.pathname.split('/').pop() || 'index.html';
        const pageWithExt = pageName.endsWith('.html') ? pageName : (pageName ? `${pageName}.html` : 'index.html');
        const pageWithoutExt = pageName.replace(/\.html$/, '');
        const activeLink = document.querySelector(`.nav-link[href="${pageWithExt}"], .nav-link[href="${pageWithoutExt}"], .nav-link[href="${pageName}"]`);
        if(activeLink) activeLink.classList.add('active');
    }

    // Header branding with integrated navigation toggle button
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
        sidebarHeader.innerHTML = `
            <div class="sidebar-header-row">
                <div class="sidebar-brand-group">
                    <div style="display:flex;align-items:center;gap:3px;">
                        <span class="brand-katok">Katok</span><span class="brand-kalinisan">Kalinis</span>
                    </div>
                    <div class="brand-tagline">Katok. Linis. Gaan ang Buhay.</div>
                </div>
                <button type="button" class="sidebar-toggle-btn-inside" id="sidebar-toggle-btn-inside" title="Collapse navigation menu (Ctrl+B)" aria-label="Toggle navigation">
                    <svg class="sidebar-toggle-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <path class="toggle-arrow" d="M15 9l-3 3 3 3"></path>
                    </svg>
                </button>
            </div>
        `;
    }

    // Role Badge in Sidebar Header (Separated Super Admin vs Barangay Admin)
    const roleContainer = document.getElementById('sidebar-role');
    if (roleContainer) {
        roleContainer.innerHTML = `
            <div class="sidebar-role-badge-row">
                <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.92);">${isSuperAdmin ? 'CLENRO Department' : 'Barangay Command'}</span>
                <span class="sidebar-role-badge ${isSuperAdmin ? 'role-super' : 'role-admin'}">
                    <span class="role-dot"></span>
                    ${isSuperAdmin ? 'SUPER ADMIN' : 'BARANGAY ADMIN'}
                </span>
            </div>
        `;
    }

    // Topbar Greeting
    const userNameEl = document.getElementById('topbar-user');
    if (userNameEl) {
        userNameEl.innerText = `Welcome, ${user.name || 'CLENRO Officer'} (${roleLabel})`;
    }

    // Initialize Global Topbar Notification Bell connected to all modules
    if (typeof initGlobalNotificationBell === 'function') {
        initGlobalNotificationBell();
    }

    // Render Integrated Profile Component in Sidebar Footer
    const footerContainer = document.querySelector('.sidebar-footer');
    if (footerContainer) {
        const initials = (user.name || 'Admin')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(n => n[0].toUpperCase())
            .join('') || 'CL';

        footerContainer.innerHTML = `
            <div class="sidebar-profile-widget" id="sidebar-profile-widget">
                <div class="sidebar-profile-card" id="sidebar-profile-card" onclick="toggleProfileMenu(event)" title="Click to view Profile, Settings &amp; Logout">
                    <div class="profile-avatar-wrap">
                        <div class="profile-avatar">${initials}</div>
                        <span class="status-indicator-dot" title="Account Active"></span>
                    </div>
                    <div class="profile-meta">
                        <div class="profile-meta-name">${escapeHtml(user.name || 'CLENRO Officer')}</div>
                        <div class="profile-meta-role">${escapeHtml(roleLabel)}</div>
                    </div>
                    <svg class="profile-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                </div>

                <!-- Profile Dropdown containing Settings, Dark Mode & Logout -->
                <div class="profile-dropdown-menu" id="profile-dropdown-menu">
                    <div class="dropdown-user-header">
                        <div class="dropdown-user-name">${escapeHtml(user.name || 'CLENRO Official')}</div>
                        <div class="dropdown-user-email">${escapeHtml(user.email || 'clenro@cagayandeoro.gov.ph')}</div>
                        <span class="dropdown-department-tag">CLENRO · Cagayan de Oro</span>
                    </div>
                    <a href="settings.html" class="dropdown-item" id="dropdown-settings-link">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                        Settings &amp; Preferences
                    </a>
                    <button type="button" class="dropdown-item" onclick="toggleTheme();">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                        </svg>
                        Toggle Light / Dark Mode
                    </button>
                    <div class="dropdown-divider"></div>
                    <button type="button" class="dropdown-item dropdown-logout" onclick="logout()">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Logout
                    </button>
                </div>
            </div>
        `;
    }

    // Initialize Mobile Responsive Navigation Drawer & Table Wrappers
    initResponsiveLayout();
}

function initResponsiveLayout() {
    const layout = document.querySelector('.dashboard-layout');
    const sidebar = document.querySelector('.sidebar');
    const topbar = document.querySelector('.topbar');
    if (!layout || !sidebar || !topbar) return;

    // 1. Off-canvas Backdrop Overlay
    let backdrop = document.getElementById('sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'sidebar-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        layout.appendChild(backdrop);
    }

    // 2. Navigation Toggle Button INSIDE Sidebar Header
    const insideToggleBtn = document.getElementById('sidebar-toggle-btn-inside');

    // 3. Floating Expand Button when Sidebar is Collapsed on Desktop
    let floatExpandBtn = document.getElementById('sidebar-expand-float-btn');
    if (!floatExpandBtn) {
        floatExpandBtn = document.createElement('button');
        floatExpandBtn.id = 'sidebar-expand-float-btn';
        floatExpandBtn.className = 'sidebar-expand-float-btn';
        floatExpandBtn.type = 'button';
        floatExpandBtn.setAttribute('title', 'Expand Navigation (Ctrl+B)');
        floatExpandBtn.setAttribute('aria-label', 'Expand Navigation');
        floatExpandBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
                <path d="M13 9l3 3-3 3"></path>
            </svg>
        `;
        layout.appendChild(floatExpandBtn);
    }

    // 4. Mobile Navigation Toggle in Topbar (Only created / shown on mobile <= 1024px)
    let mobileToggleBtn = document.getElementById('mobile-nav-toggle');
    if (window.innerWidth <= 1024) {
        if (!mobileToggleBtn) {
            mobileToggleBtn = document.createElement('button');
            mobileToggleBtn.id = 'mobile-nav-toggle';
            mobileToggleBtn.className = 'mobile-nav-toggle nav-toggle-btn';
            mobileToggleBtn.type = 'button';
            mobileToggleBtn.setAttribute('aria-label', 'Toggle navigation menu');
            mobileToggleBtn.setAttribute('title', 'Open navigation menu');
            mobileToggleBtn.innerHTML = `
                <svg class="sidebar-toggle-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                    <path class="toggle-arrow" d="M15 9l-3 3 3 3"></path>
                </svg>
            `;

            let leftGroup = topbar.querySelector('.topbar-left');
            const heading = topbar.querySelector('h2, .topbar-title');
            if (!leftGroup) {
                leftGroup = document.createElement('div');
                leftGroup.className = 'topbar-left';
                leftGroup.style.display = 'flex';
                leftGroup.style.alignItems = 'center';
                leftGroup.style.gap = '12px';
                if (heading) {
                    topbar.insertBefore(leftGroup, heading);
                    leftGroup.appendChild(mobileToggleBtn);
                    leftGroup.appendChild(heading);
                } else {
                    topbar.insertBefore(leftGroup, topbar.firstChild);
                    leftGroup.appendChild(mobileToggleBtn);
                }
            } else if (!leftGroup.contains(mobileToggleBtn)) {
                leftGroup.insertBefore(mobileToggleBtn, leftGroup.firstChild);
            }
        }
    } else {
        // Desktop (> 1024px): completely remove any toggle button in the topbar
        if (mobileToggleBtn) {
            mobileToggleBtn.remove();
            mobileToggleBtn = null;
        }
        const leftoverToggle = topbar.querySelector('.mobile-nav-toggle, .nav-toggle-btn');
        if (leftoverToggle) {
            leftoverToggle.remove();
        }
    }

    function updateToggleUI(isCollapsed) {
        if (insideToggleBtn) {
            insideToggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
            insideToggleBtn.setAttribute('title', isCollapsed ? 'Expand Navigation' : 'Collapse Navigation (Ctrl+B)');
        }
        if (mobileToggleBtn) {
            const isOpen = sidebar.classList.contains('open');
            mobileToggleBtn.classList.toggle('active', isOpen);
            mobileToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
    }

    // Restore desktop collapsed preference from localStorage
    if (window.innerWidth > 1024) {
        const savedCollapsed = localStorage.getItem('katok_sidebar_collapsed') === 'true';
        if (savedCollapsed) {
            layout.classList.add('sidebar-collapsed');
            updateToggleUI(true);
        } else {
            updateToggleUI(false);
        }
    }

    function openDrawer() {
        sidebar.classList.add('open');
        backdrop.classList.add('active');
        if (mobileToggleBtn) {
            mobileToggleBtn.classList.add('active');
            mobileToggleBtn.setAttribute('aria-expanded', 'true');
        }
        document.body.classList.add('sidebar-open');
    }

    function closeDrawer() {
        sidebar.classList.remove('open');
        backdrop.classList.remove('active');
        if (mobileToggleBtn) {
            mobileToggleBtn.classList.remove('active');
            mobileToggleBtn.setAttribute('aria-expanded', 'false');
        }
        document.body.classList.remove('sidebar-open');
    }

    function toggleSidebarAction(e) {
        if (e) e.stopPropagation();
        if (window.innerWidth <= 1024) {
            // Mobile / Tablet drawer behavior
            if (sidebar.classList.contains('open')) {
                closeDrawer();
            } else {
                openDrawer();
            }
        } else {
            // Desktop collapse / showcase mode
            const isCollapsed = layout.classList.toggle('sidebar-collapsed');
            localStorage.setItem('katok_sidebar_collapsed', isCollapsed ? 'true' : 'false');
            updateToggleUI(isCollapsed);
            // Trigger resize event so charts, maps, and canvas elements re-fit immediately
            window.dispatchEvent(new Event('resize'));
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 300);
        }
    }

    if (insideToggleBtn) {
        insideToggleBtn.onclick = toggleSidebarAction;
    }
    if (floatExpandBtn) {
        floatExpandBtn.onclick = toggleSidebarAction;
    }
    if (mobileToggleBtn) {
        mobileToggleBtn.onclick = toggleSidebarAction;
    }
    backdrop.onclick = closeDrawer;

    // 3. Mobile Close Button in Sidebar Header
    const sidebarHeader = sidebar.querySelector('.sidebar-header');
    if (sidebarHeader && !document.getElementById('sidebar-close-btn')) {
        const closeBtn = document.createElement('button');
        closeBtn.id = 'sidebar-close-btn';
        closeBtn.className = 'sidebar-close-btn';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close navigation menu');
        closeBtn.innerHTML = `&times;`;
        closeBtn.onclick = closeDrawer;
        sidebarHeader.appendChild(closeBtn);
    }

    // Keyboard shortcut: Escape closes drawer on mobile; Ctrl+B toggles showcase on desktop
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            closeDrawer();
        } else if ((e.key === '[' || e.key === 'b') && e.ctrlKey && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            toggleSidebarAction();
        }
    });

    // Close drawer when clicking a nav link on mobile/tablet
    sidebar.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeDrawer();
            }
        });
    });

    // Auto adapt if resized between desktop and mobile
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            if (sidebar.classList.contains('open')) {
                closeDrawer();
            }
            const savedCollapsed = localStorage.getItem('katok_sidebar_collapsed') === 'true';
            layout.classList.toggle('sidebar-collapsed', savedCollapsed);
            updateToggleUI(savedCollapsed);
        } else {
            layout.classList.remove('sidebar-collapsed');
            updateToggleUI(false);
        }
    });

    // Auto-wrap tables in responsive scrollable container
    document.querySelectorAll('table').forEach(tbl => {
        if (!tbl.closest('.table-responsive') && !tbl.closest('.table-container')) {
            const wrap = document.createElement('div');
            wrap.className = 'table-responsive';
            tbl.parentNode.insertBefore(wrap, tbl);
            wrap.appendChild(tbl);
        }
    });
}

// Profile Dropdown Toggle
function toggleProfileMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('profile-dropdown-menu');
    const card = document.getElementById('sidebar-profile-card');
    if (!menu) return;
    const isOpen = menu.classList.contains('active');
    if (isOpen) {
        closeProfileMenu();
    } else {
        menu.classList.add('active');
        if (card) card.classList.add('menu-open');
        if (typeof window.triggerFloatingBarLazyStage === 'function') {
            window.triggerFloatingBarLazyStage(menu, 180);
        }
    }
}

function closeProfileMenu() {
    const menu = document.getElementById('profile-dropdown-menu');
    const card = document.getElementById('sidebar-profile-card');
    if (menu) menu.classList.remove('active');
    if (card) card.classList.remove('menu-open');
}

// Close profile dropdown when clicking outside or pressing Escape
document.addEventListener('click', (e) => {
    const widget = document.getElementById('sidebar-profile-widget');
    if (widget && !widget.contains(e.target)) {
        closeProfileMenu();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeProfileMenu();
    }
});

// Helper for escaping HTML strings
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Automatic Code Generator for Government/CLENRO entities
function generateAutoCode(prefix = 'EMP') {
    const year = new Date().getFullYear();
    const randNum = String(Math.floor(1000 + Math.random() * 9000));
    return `CLENRO-${prefix}-${year}-${randNum}`;
}

/*
|--------------------------------------------------------------------------
| TOAST NOTIFICATIONS
|--------------------------------------------------------------------------
*/
function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else if (type === 'warning') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    } else {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `
        <span class="toast-icon">${iconSvg}</span>
        <span class="toast-msg">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px)';
        setTimeout(() => toast.remove(), 260);
    }, duration);
}
window.showToast = showToast;

/*
|--------------------------------------------------------------------------
| REUSABLE PAGINATION CONTROLS
|--------------------------------------------------------------------------
*/
class PaginationControls {
    constructor(options = {}) {
        this.containerId = options.containerId || 'pagination-container';
        this.currentPage = options.currentPage || 1;
        this.rowsPerPage = options.rowsPerPage || 10;
        this.rowsPerPageOptions = options.rowsPerPageOptions || [10, 20, 50, 100];
        this.totalItems = options.totalItems || 0;
        this.itemLabel = options.itemLabel || 'users';
        this.onPageChange = options.onPageChange || (() => {});
        this.onRowsPerPageChange = options.onRowsPerPageChange || (() => {});
        this.render();
    }

    update({ currentPage, totalItems, rowsPerPage }) {
        if (currentPage !== undefined) this.currentPage = currentPage;
        if (totalItems !== undefined) this.totalItems = totalItems;
        if (rowsPerPage !== undefined) this.rowsPerPage = rowsPerPage;
        this.render();
    }

    getTotalPages() {
        return Math.max(1, Math.ceil(this.totalItems / this.rowsPerPage));
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const totalPages = this.getTotalPages();
        if (this.currentPage > totalPages) this.currentPage = totalPages;

        const startItem = this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.rowsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.rowsPerPage, this.totalItems);

        // Build numeric page range (e.g. 1, 2, ..., 10)
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (this.currentPage > 3) pages.push('...');
            const start = Math.max(2, this.currentPage - 1);
            const end = Math.min(totalPages - 1, this.currentPage + 1);
            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
            }
            if (this.currentPage < totalPages - 2) pages.push('...');
            if (!pages.includes(totalPages)) pages.push(totalPages);
        }

        const optionsHtml = this.rowsPerPageOptions.map(opt =>
            `<option value="${opt}" ${opt === this.rowsPerPage ? 'selected' : ''}>${opt}</option>`
        ).join('');

        const desktopButtonsHtml = pages.map(p => {
            if (p === '...') return `<span class="page-ellipsis">&hellip;</span>`;
            return `<button type="button" class="page-btn ${p === this.currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
        }).join('');

        container.innerHTML = `
            <div class="pagination-left">
                <span class="pagination-summary">
                    ${this.totalItems > 0 ? `Showing <strong>${startItem}–${endItem}</strong> of <strong>${this.totalItems}</strong> ${this.itemLabel}` : `No ${this.itemLabel} to display`}
                </span>
                <div class="rows-per-page-wrap">
                    <label for="rows-per-page-select">Rows per page:</label>
                    <select id="rows-per-page-select" class="rows-per-page-select">
                        ${optionsHtml}
                    </select>
                </div>
            </div>
            <div class="pagination-controls">
                <button type="button" class="page-btn prev-btn" ${this.currentPage <= 1 ? 'disabled' : ''} title="Previous Page" aria-label="Previous Page">&laquo; Prev</button>
                <div class="pagination-pages-desktop">
                    ${desktopButtonsHtml}
                </div>
                <div class="pagination-pages-mobile">
                    Page ${this.currentPage} of ${totalPages}
                </div>
                <button type="button" class="page-btn next-btn" ${this.currentPage >= totalPages ? 'disabled' : ''} title="Next Page" aria-label="Next Page">Next &raquo;</button>
            </div>
        `;

        // Event listeners
        const prevBtn = container.querySelector('.prev-btn');
        if (prevBtn) {
            prevBtn.onclick = () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.onPageChange(this.currentPage);
                }
            };
        }

        const nextBtn = container.querySelector('.next-btn');
        if (nextBtn) {
            nextBtn.onclick = () => {
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.onPageChange(this.currentPage);
                }
            };
        }

        container.querySelectorAll('.pagination-pages-desktop button[data-page]').forEach(btn => {
            btn.onclick = () => {
                const targetPage = parseInt(btn.getAttribute('data-page'), 10);
                if (targetPage !== this.currentPage) {
                    this.currentPage = targetPage;
                    this.onPageChange(this.currentPage);
                }
            };
        });

        const rowsSelect = container.querySelector('#rows-per-page-select');
        if (rowsSelect) {
            rowsSelect.onchange = (e) => {
                const newRows = parseInt(e.target.value, 10);
                this.rowsPerPage = newRows;
                this.currentPage = 1;
                this.onRowsPerPageChange(newRows);
            };
        }
    }
}
window.PaginationControls = PaginationControls;

/*
|--------------------------------------------------------------------------
| STANDARD REAL-TIME & NORMAL TIME FORMATTERS (12-Hour AM/PM)
|--------------------------------------------------------------------------
*/
function formatStandardTime(timeStr) {
    if (!timeStr || timeStr === '-' || timeStr === 'null') return '-';
    // Handle ISO date strings (e.g. 2026-10-21T03:55:26.000000Z)
    if (typeof timeStr === 'string' && timeStr.includes('T')) {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        }
    }
    // Handle time strings (e.g. "17:02:05", "17:02", "09:16")
    const parts = String(timeStr).trim().split(':');
    if (parts.length >= 2) {
        let hour = parseInt(parts[0], 10);
        const minute = parts[1].substring(0, 2);
        if (isNaN(hour)) return timeStr;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour}:${minute} ${ampm}`;
    }
    return timeStr;
}
window.formatStandardTime = formatStandardTime;

function formatStandardDate(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr === 'null') return '-';
    const cleanStr = String(dateStr).trim().substring(0, 10);
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
}
window.formatStandardDate = formatStandardDate;

function initRealtimeClock(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    function tick() {
        const now = new Date();
        const datePart = now.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const timePart = now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        el.textContent = `${datePart} • ${timePart}`;
    }
    tick();
    setInterval(tick, 1000);
}
window.initRealtimeClock = initRealtimeClock;

// ==============================================================================
// GLOBAL TOAST NOTIFICATION COMPONENT & WINDOW.ALERT DEPRECATION
// ==============================================================================
function showToast(message, type = 'success', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    } else {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
        <span class="toast-icon">${iconSvg}</span>
        <div class="toast-message">${escapeHtml(message)}</div>
        <button type="button" class="toast-close-btn" aria-label="Close notification">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close-btn');
    function dismiss() {
        if (toast.classList.contains('toast-closing')) return;
        toast.classList.add('toast-closing');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 260);
    }

    closeBtn.onclick = dismiss;

    if (duration > 0) {
        setTimeout(dismiss, duration);
    }

    container.appendChild(toast);

    // Automatically mirror significant module actions into the Global Notification Bell
    if (typeof window.captureToastIntoNotifications === 'function') {
        try { window.captureToastIntoNotifications(message, type); } catch (e) {}
    }
}

window.showToast = showToast;

// Completely deprecate window.alert by routing all alerts to in-app toast
window.alert = function(msg) {
    window.showToast(msg, 'info', 4000);
};

/*
|--------------------------------------------------------------------------
| GLOBAL TOPBAR NOTIFICATION BELL & CROSS-MODULE NOTIFICATION ENGINE
|--------------------------------------------------------------------------
| Connected to ALL modules:
|  - Dashboard Analytics & SLA Command (analytics.html)
|  - Monitor Truck & Mobile Live GPS (trucks.html)
|  - Reports & Issues (reports.html)
|  - CLENRO Historical Data & DSS (clenro-reports.html)
|  - Collection Schedule (schedule.html)
|  - Market Vendors (vendors.html)
|  - Attendance Roster (attendance.html)
|  - Field Employees (employees.html)
|  - Contractor Fleets (contractors.html)
|  - User Management & Activity Logs (users.html / activity-logs.html)
*/
const GLOBAL_NOTIF_STORAGE_KEY = 'clenro_global_notifications_v1';
const GLOBAL_NOTIF_READ_IDS_KEY = 'clenro_global_notif_read_ids_v1';
const GLOBAL_NOTIF_PREFS_KEY = 'clenro_global_notif_prefs_v1';

let globalNotifFilter = 'all';
let globalNotifExpandedAll = false;
let globalNotifSyncTimer = null;

function formatNotifTimestamp(isoOrDate) {
    let d = isoOrDate ? new Date(isoOrDate) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    const datePart = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const timePart = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    return `${datePart} | ${timePart}`;
}

function getNotifReadSet() {
    try {
        const raw = localStorage.getItem(GLOBAL_NOTIF_READ_IDS_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
        return new Set();
    }
}

function saveNotifReadSet(readSet) {
    try {
        localStorage.setItem(GLOBAL_NOTIF_READ_IDS_KEY, JSON.stringify(Array.from(readSet)));
    } catch (e) {}
}

function getNotifPrefs() {
    try {
        const raw = localStorage.getItem(GLOBAL_NOTIF_PREFS_KEY);
        return Object.assign({ liveSync: true, soundBadge: true, showAllModules: true }, raw ? JSON.parse(raw) : {});
    } catch (e) {
        return { liveSync: true, soundBadge: true, showAllModules: true };
    }
}

function saveNotifPrefs(prefs) {
    try {
        localStorage.setItem(GLOBAL_NOTIF_PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {}
}

function detectCurrentModuleMeta() {
    const path = (window.location.pathname || '').toLowerCase();
    if (path.includes('trucks')) return { moduleKey: 'trucks', moduleLabel: 'Monitor Truck', link: 'trucks.html', avatarText: 'MT', avatarClass: 'mod-trucks', badgeEmoji: '🚛' };
    if (path.includes('reports') && !path.includes('clenro-reports')) return { moduleKey: 'reports', moduleLabel: 'Reports & Issues', link: 'reports.html', avatarText: 'RI', avatarClass: 'mod-reports', badgeEmoji: '📋' };
    if (path.includes('clenro-reports')) return { moduleKey: 'dss', moduleLabel: 'CLENRO Historical DSS', link: 'clenro-reports.html', avatarText: 'DS', avatarClass: 'mod-dss', badgeEmoji: '🛡️' };
    if (path.includes('schedule')) return { moduleKey: 'schedule', moduleLabel: 'Collection Schedule', link: 'schedule.html', avatarText: 'CS', avatarClass: 'mod-schedule', badgeEmoji: '📅' };
    if (path.includes('vendors')) return { moduleKey: 'vendors', moduleLabel: 'Market Vendors', link: 'vendors.html', avatarText: 'MV', avatarClass: 'mod-vendors', badgeEmoji: '🏪' };
    if (path.includes('attendance')) return { moduleKey: 'attendance', moduleLabel: 'Attendance Roster', link: 'attendance.html', avatarText: 'AR', avatarClass: 'mod-attendance', badgeEmoji: '✅' };
    if (path.includes('employees')) return { moduleKey: 'employees', moduleLabel: 'Field Employees', link: 'employees.html', avatarText: 'FE', avatarClass: 'mod-employees', badgeEmoji: '👷' };
    if (path.includes('contractors')) return { moduleKey: 'contractors', moduleLabel: 'Contractor Fleets', link: 'contractors.html', avatarText: 'CF', avatarClass: 'mod-contractors', badgeEmoji: '🏢' };
    if (path.includes('users')) return { moduleKey: 'users', moduleLabel: 'User Management', link: 'users.html', avatarText: 'UM', avatarClass: 'mod-users', badgeEmoji: '👤' };
    if (path.includes('barangay-overview')) return { moduleKey: 'analytics', moduleLabel: 'Barangay Overview', link: 'barangay-overview.html', avatarText: 'BO', avatarClass: 'mod-analytics', badgeEmoji: '📍' };
    return { moduleKey: 'analytics', moduleLabel: 'Dashboard Analytics', link: 'analytics.html', avatarText: 'DA', avatarClass: 'mod-analytics', badgeEmoji: '📊' };
}

function getBaselineModuleNotifications() {
    const now = Date.now();
    const items = [
        {
            id: 'notif-live-kal104',
            moduleKey: 'trucks',
            moduleLabel: 'Monitor Truck',
            actor: 'Truck KAL-104',
            handle: '@John_Driver',
            actionText: 'started live GPS route collection in South Poblacion (Brgy 4, 8, 9, 10).',
            timestamp: new Date(now - 2 * 60 * 1000).toISOString(),
            link: 'trucks.html',
            avatarText: 'JD',
            avatarClass: 'mod-trucks',
            badgeEmoji: '🚛'
        },
        {
            id: 'notif-sla-brgy2',
            moduleKey: 'reports',
            moduleLabel: 'Reports & Issues',
            actor: 'Barangay 2 Corridor',
            handle: '@SLA_Monitor',
            actionText: 'flagged 3 uncollected waste pileup incident reports (₱25k SLA penalty risk).',
            timestamp: new Date(now - 9 * 60 * 1000).toISOString(),
            link: 'reports.html',
            avatarText: 'B2',
            avatarClass: 'mod-reports',
            badgeEmoji: '⚠️'
        },
        {
            id: 'notif-market-cogon',
            moduleKey: 'vendors',
            moduleLabel: 'Market Vendors',
            actor: 'Cogon Public Market',
            handle: '@Market_Inspector',
            actionText: 'logged 84.6% corridor compliance across 13 stall inspections (2nd haul ongoing).',
            timestamp: new Date(now - 18 * 60 * 1000).toISOString(),
            link: 'vendors.html',
            avatarText: 'CM',
            avatarClass: 'mod-vendors',
            badgeEmoji: '🏪'
        },
        {
            id: 'notif-attendance-shift',
            moduleKey: 'attendance',
            moduleLabel: 'Attendance Roster',
            actor: 'John Driver & Toky Toky',
            handle: '@Morning_Shift',
            actionText: 'checked in as Active on Shift Crew Deployment (2 of 5 drivers deployed).',
            timestamp: new Date(now - 27 * 60 * 1000).toISOString(),
            link: 'attendance.html',
            avatarText: 'TT',
            avatarClass: 'mod-attendance',
            badgeEmoji: '✅'
        },
        {
            id: 'notif-schedule-route1',
            moduleKey: 'schedule',
            moduleLabel: 'Collection Schedule',
            actor: 'Route 1: City Hall & Riverwall',
            handle: '@KAL_101',
            actionText: 'completed scheduled morning collection run in Barangay 1 & Barangay 2.',
            timestamp: new Date(now - 42 * 60 * 1000).toISOString(),
            link: 'schedule.html',
            avatarText: 'R1',
            avatarClass: 'mod-schedule',
            badgeEmoji: '📅'
        },
        {
            id: 'notif-dss-historical',
            moduleKey: 'dss',
            moduleLabel: 'CLENRO Historical Data',
            actor: 'CLENRO DSS Engine',
            handle: '@SLA_Analytics',
            actionText: 'updated citywide collection rate to 98.4% (+2.1% this week) across 42 sectors.',
            timestamp: new Date(now - 64 * 60 * 1000).toISOString(),
            link: 'clenro-reports.html',
            avatarText: 'CL',
            avatarClass: 'mod-dss',
            badgeEmoji: '🛡️'
        },
        {
            id: 'notif-fleet-contractors',
            moduleKey: 'contractors',
            moduleLabel: 'Contractor Fleets',
            actor: 'CDO EnviroHaul Fleet',
            handle: '@Fleet_Command',
            actionText: 'confirmed 5 / 5 active compactor trucks & 10 field crew members en route.',
            timestamp: new Date(now - 95 * 60 * 1000).toISOString(),
            link: 'contractors.html',
            avatarText: 'EF',
            avatarClass: 'mod-contractors',
            badgeEmoji: '🏢'
        },
        {
            id: 'notif-field-employees',
            moduleKey: 'employees',
            moduleLabel: 'Field Employees',
            actor: 'Field Operations Roster',
            handle: '@CLENRO_HR',
            actionText: 'assigned 5 drivers and 5 barangay sweepers to Poblacion & Market corridors.',
            timestamp: new Date(now - 130 * 60 * 1000).toISOString(),
            link: 'employees.html',
            avatarText: 'FO',
            avatarClass: 'mod-employees',
            badgeEmoji: '👷'
        }
    ];

    // Helper to extract a clean string from potentially nested barangay/sector objects
    const resolveSectorString = (val, fallback = 'Poblacion Sector') => {
        if (!val) return fallback;
        if (typeof val === 'string') return val.includes('[object Object]') ? fallback : val;
        if (typeof val === 'object') return val.name || val.barangay_name || val.sector || val.title || fallback;
        return String(val);
    };

    // Also pull live localStorage events from all modules so custom actions persist across pages
    try {
        const pickupLogs = JSON.parse(localStorage.getItem('clenro_custom_pickup_logs') || '[]');
        pickupLogs.slice(0, 4).forEach((log, idx) => {
            const sectorName = resolveSectorString(log.barangay || log.sector, 'Poblacion');
            items.unshift({
                id: `notif-pickup-${log.id || idx}-${log.truck_code || 'KAL'}`,
                moduleKey: 'trucks',
                moduleLabel: 'Monitor Truck',
                actor: `Truck ${log.truck_code || 'KAL-104'}`,
                handle: `@${String(log.driver_name || 'Driver').replace(/\s+/g, '_')}`,
                actionText: `recorded ${log.weight_tons || log.tons || '4.2'} tons waste pickup in ${sectorName}.`,
                timestamp: log.created_at || new Date(now - (idx + 1) * 60000).toISOString(),
                link: 'trucks.html',
                avatarText: String(log.truck_code || 'TK').slice(-2),
                avatarClass: 'mod-trucks',
                badgeEmoji: '⚖️'
            });
        });
    } catch (e) {}

    try {
        const dssApplied = JSON.parse(localStorage.getItem('clenro_dss_applied_decisions') || '[]');
        dssApplied.slice(0, 4).forEach((dec, idx) => {
            const actorLabel = resolveSectorString(dec.barangay || dec.sector, 'CLENRO DSS');
            items.unshift({
                id: `notif-dss-dec-${dec.id || idx}`,
                moduleKey: 'dss',
                moduleLabel: 'CLENRO Historical Data',
                actor: actorLabel,
                handle: '@DSS_Applied',
                actionText: `applied DSS action: ${dec.action || dec.recommendation || 'Dispatched supplemental compactor unit'}.`,
                timestamp: dec.applied_at || dec.timestamp || new Date(now - (idx + 2) * 90000).toISOString(),
                link: 'clenro-reports.html',
                avatarText: 'DS',
                avatarClass: 'mod-dss',
                badgeEmoji: '⚡'
            });
        });
    } catch (e) {}

    try {
        const dssSchedules = JSON.parse(localStorage.getItem('clenro_dss_schedules') || '[]');
        dssSchedules.slice(0, 3).forEach((sched, idx) => {
            const actorLabel = resolveSectorString(sched.barangay_name || sched.barangay, 'Poblacion Sector');
            const truckHandle = typeof sched.truck === 'object' && sched.truck ? (sched.truck.truck_code || sched.truck.code) : (sched.truck_code || 'KAL-104');
            items.unshift({
                id: `notif-sched-${sched.id || idx}`,
                moduleKey: 'schedule',
                moduleLabel: 'Collection Schedule',
                actor: actorLabel,
                handle: `@${String(truckHandle || 'KAL-104').replace(/\s+/g, '_')}`,
                actionText: `scheduled ${sched.shift || 'Morning'} collection run (${sched.collection_days || 'Daily'}).`,
                timestamp: sched.created_at || new Date(now - (idx + 3) * 120000).toISOString(),
                link: 'schedule.html',
                avatarText: 'SC',
                avatarClass: 'mod-schedule',
                badgeEmoji: '📅'
            });
        });
    } catch (e) {}

    return items;
}

function getStoredCustomNotifications() {
    try {
        const raw = localStorage.getItem(GLOBAL_NOTIF_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed.map(item => {
            if (!item) return item;
            if (typeof item.actor === 'object' || String(item.actor).includes('[object Object]')) {
                item.actor = (item.actor && item.actor.name) ? item.actor.name : (item.moduleLabel || 'Poblacion Sector');
            }
            if (String(item.actionText || '').includes('[object Object]')) {
                item.actionText = String(item.actionText).replace(/\[object Object\]/g, 'Poblacion Sector');
            }
            return item;
        });
    } catch (e) {
        return [];
    }
}

function saveStoredCustomNotifications(list) {
    try {
        localStorage.setItem(GLOBAL_NOTIF_STORAGE_KEY, JSON.stringify(list.slice(0, 40)));
    } catch (e) {}
}

function getAllMergedNotifications() {
    const custom = getStoredCustomNotifications();
    const baseline = getBaselineModuleNotifications();
    const seen = new Set();
    const merged = [];

    [...custom, ...baseline].forEach(item => {
        if (!item || !item.id) return;
        if (seen.has(item.id)) return;
        seen.add(item.id);
        merged.push(item);
    });

    merged.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    return merged;
}

function pushModuleNotification(notif = {}) {
    const modMeta = detectCurrentModuleMeta();
    const entry = {
        id: notif.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        moduleKey: notif.moduleKey || modMeta.moduleKey,
        moduleLabel: notif.moduleLabel || modMeta.moduleLabel,
        actor: notif.actor || modMeta.moduleLabel,
        handle: notif.handle || '@CLENRO_Live',
        actionText: notif.actionText || notif.message || 'updated module records.',
        timestamp: notif.timestamp || new Date().toISOString(),
        link: notif.link || modMeta.link,
        avatarText: notif.avatarText || modMeta.avatarText,
        avatarClass: notif.avatarClass || modMeta.avatarClass,
        badgeEmoji: notif.badgeEmoji || modMeta.badgeEmoji
    };

    const custom = getStoredCustomNotifications();
    // Prevent duplicate consecutive identical messages within 5 seconds
    if (custom.length > 0 && custom[0].actionText === entry.actionText && (Date.now() - new Date(custom[0].timestamp).getTime()) < 5000) {
        return;
    }

    custom.unshift(entry);
    saveStoredCustomNotifications(custom);
    renderGlobalNotifications(true);
}
window.pushModuleNotification = pushModuleNotification;

function captureToastIntoNotifications(message, type) {
    if (!message || typeof message !== 'string') return;
    const clean = message.trim();
    if (!clean) return;
    // Ignore notification dropdown's own toasts to avoid recursion
    if (clean.includes('notifications marked as read') || clean.includes('Notification feed synced')) return;

    const modMeta = detectCurrentModuleMeta();
    const userStr = localStorage.getItem('user');
    let actorName = modMeta.moduleLabel;
    let handleStr = `@${modMeta.moduleKey.toUpperCase()}`;
    if (userStr) {
        try {
            const u = JSON.parse(userStr);
            if (u && u.name) {
                handleStr = `@${String(u.name).replace(/\s+/g, '_')}`;
            }
        } catch (e) {}
    }

    pushModuleNotification({
        moduleKey: modMeta.moduleKey,
        moduleLabel: modMeta.moduleLabel,
        actor: actorName,
        handle: handleStr,
        actionText: clean,
        link: modMeta.link,
        avatarText: modMeta.avatarText,
        avatarClass: modMeta.avatarClass,
        badgeEmoji: type === 'error' ? '⚠️' : modMeta.badgeEmoji
    });
}
window.captureToastIntoNotifications = captureToastIntoNotifications;

function recordApiMutationNotification(endpoint, method, data, result) {
    if (!endpoint) return;
    const ep = String(endpoint).toLowerCase();
    // Skip login/logout or background location ping spam
    if (ep.includes('/login') || ep.includes('/logout') || ep.includes('/notifications')) return;

    let mod = detectCurrentModuleMeta();
    if (ep.includes('truck')) mod = { moduleKey: 'trucks', moduleLabel: 'Monitor Truck', link: 'trucks.html', avatarText: 'MT', avatarClass: 'mod-trucks', badgeEmoji: '🚛' };
    else if (ep.includes('report')) mod = { moduleKey: 'reports', moduleLabel: 'Reports & Issues', link: 'reports.html', avatarText: 'RI', avatarClass: 'mod-reports', badgeEmoji: '📋' };
    else if (ep.includes('schedule')) mod = { moduleKey: 'schedule', moduleLabel: 'Collection Schedule', link: 'schedule.html', avatarText: 'CS', avatarClass: 'mod-schedule', badgeEmoji: '📅' };
    else if (ep.includes('vendor') || ep.includes('market')) mod = { moduleKey: 'vendors', moduleLabel: 'Market Vendors', link: 'vendors.html', avatarText: 'MV', avatarClass: 'mod-vendors', badgeEmoji: '🏪' };
    else if (ep.includes('attendance')) mod = { moduleKey: 'attendance', moduleLabel: 'Attendance Roster', link: 'attendance.html', avatarText: 'AR', avatarClass: 'mod-attendance', badgeEmoji: '✅' };
    else if (ep.includes('employee')) mod = { moduleKey: 'employees', moduleLabel: 'Field Employees', link: 'employees.html', avatarText: 'FE', avatarClass: 'mod-employees', badgeEmoji: '👷' };
    else if (ep.includes('contractor')) mod = { moduleKey: 'contractors', moduleLabel: 'Contractor Fleets', link: 'contractors.html', avatarText: 'CF', avatarClass: 'mod-contractors', badgeEmoji: '🏢' };
    else if (ep.includes('user')) mod = { moduleKey: 'users', moduleLabel: 'User Management', link: 'users.html', avatarText: 'UM', avatarClass: 'mod-users', badgeEmoji: '👤' };

    const verb = method === 'POST' ? 'created a new record in' : (method === 'DELETE' ? 'removed a record from' : 'updated a record in');
    const detail = (result && result.message) ? result.message : `${verb} ${mod.moduleLabel}.`;

    pushModuleNotification({
        moduleKey: mod.moduleKey,
        moduleLabel: mod.moduleLabel,
        actor: mod.moduleLabel,
        handle: `@${method}_Sync`,
        actionText: detail,
        link: mod.link,
        avatarText: mod.avatarText,
        avatarClass: mod.avatarClass,
        badgeEmoji: mod.badgeEmoji
    });
}
window.recordApiMutationNotification = recordApiMutationNotification;

async function syncAllModuleNotifications(silent = true) {
    const token = localStorage.getItem('auth_token');
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        // 1. Check live truck GPS tracking endpoint
        const truckRes = await fetch(`${API_BASE_URL}/public/trucks/live-tracking`, { headers }).catch(() => null);
        if (truckRes && truckRes.ok) {
            const truckData = await truckRes.json();
            const trucks = Array.isArray(truckData.data) ? truckData.data : (Array.isArray(truckData) ? truckData : []);
            trucks.slice(0, 2).forEach(t => {
                if (t && t.truck_code && (t.is_active || t.status === 'on_route')) {
                    const custom = getStoredCustomNotifications();
                    const id = `live-gps-${t.truck_code}`;
                    if (!custom.some(c => c.id === id)) {
                        custom.unshift({
                            id,
                            moduleKey: 'trucks',
                            moduleLabel: 'Monitor Truck',
                            actor: `Truck ${t.truck_code}`,
                            handle: `@${String(t.driver_name || 'Driver').replace(/\s+/g, '_')}`,
                            actionText: `is broadcasting live GPS telemetry along ${t.assigned_route || 'South Poblacion'}.`,
                            timestamp: t.recorded_at || new Date().toISOString(),
                            link: 'trucks.html',
                            avatarText: String(t.truck_code).replace(/[^A-Z0-9]/g, '').slice(-2) || 'TK',
                            avatarClass: 'mod-trucks',
                            badgeEmoji: '📡'
                        });
                        saveStoredCustomNotifications(custom);
                    }
                }
            });
        }

        // 2. Check backend notifications / activity logs if available
        const notifRes = await fetch(`${API_BASE_URL}/public/notifications`, { headers }).catch(() => null);
        if (notifRes && notifRes.ok) {
            const notifJson = await notifRes.json();
            const rows = Array.isArray(notifJson.data) ? notifJson.data : (Array.isArray(notifJson) ? notifJson : []);
            if (rows.length > 0) {
                const custom = getStoredCustomNotifications();
                rows.slice(0, 5).forEach(r => {
                    const id = `api-notif-${r.id || r.created_at}`;
                    if (!custom.some(c => c.id === id)) {
                        custom.push({
                            id,
                            moduleKey: 'analytics',
                            moduleLabel: r.type || 'System Alert',
                            actor: r.title || 'CLENRO Command',
                            handle: '@System_API',
                            actionText: r.message || r.description || 'System notification received.',
                            timestamp: r.created_at || new Date().toISOString(),
                            link: 'activity-logs.html',
                            avatarText: 'CL',
                            avatarClass: 'mod-analytics',
                            badgeEmoji: '🔔'
                        });
                    }
                });
                saveStoredCustomNotifications(custom);
            }
        }
    } catch (e) {}

    renderGlobalNotifications(false);
    if (!silent) {
        showToast('Notification feed synced across all modules.', 'success', 2500);
    }
}
window.syncAllModuleNotifications = syncAllModuleNotifications;

function renderGlobalNotifications(ringBell = false) {
    const listEl = document.getElementById('gnotif-list');
    const badgeEl = document.getElementById('global-notif-badge');
    const bellBtn = document.getElementById('global-notif-bell-btn');
    if (!listEl) return;

    const readSet = getNotifReadSet();
    const allItems = getAllMergedNotifications();

    const unreadCount = allItems.filter(item => !readSet.has(item.id)).length;
    if (badgeEl) {
        if (unreadCount > 0) {
            badgeEl.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.textContent = '0';
            badgeEl.classList.add('hidden');
        }
    }

    if (ringBell && bellBtn) {
        bellBtn.classList.remove('bell-ringing');
        void bellBtn.offsetWidth;
        bellBtn.classList.add('bell-ringing');
    }

    const filtered = globalNotifFilter === 'all'
        ? allItems
        : allItems.filter(item => item.moduleKey === globalNotifFilter);

    const displayItems = globalNotifExpandedAll ? filtered : filtered.slice(0, 5);

    if (displayItems.length === 0) {
        listEl.innerHTML = `<div class="gnotif-empty">No notifications in this module filter yet.</div>`;
        return;
    }

    const cardsHtml = displayItems.map(item => {
        const isRead = readSet.has(item.id);
        const formattedTime = formatNotifTimestamp(item.timestamp);
        return `
            <div class="gnotif-card ${isRead ? 'read' : 'unread'}" onclick="handleGlobalNotifClick('${escapeHtml(item.id)}', '${escapeHtml(item.link || 'analytics.html')}')">
                <div class="gnotif-avatar ${escapeHtml(item.avatarClass || 'mod-analytics')}">
                    <span>${escapeHtml(item.avatarText || 'CL')}</span>
                    <span class="gnotif-avatar-badge" title="${escapeHtml(item.moduleLabel || 'Module')}">${item.badgeEmoji || '🔔'}</span>
                </div>
                <div class="gnotif-content">
                    <div class="gnotif-text">
                        <strong>${escapeHtml(item.actor)}</strong>
                        <span class="gnotif-handle">${escapeHtml(item.handle || '')}</span>
                        ${escapeHtml(item.actionText)}
                    </div>
                    <div class="gnotif-meta">
                        <span>${escapeHtml(formattedTime)}</span>
                        <span>&bull;</span>
                        <span class="gnotif-mod-tag">${escapeHtml(item.moduleLabel)}</span>
                    </div>
                </div>
                ${!isRead ? `<span class="gnotif-unread-dot" title="Unread notification"></span>` : ''}
            </div>
        `;
    }).join('');

    const seeAllRowHtml = `
        <div class="gnotif-see-all-row">
            <button type="button" class="gnotif-mark-read-link" onclick="markAllGlobalNotifsRead(event)">Mark all read</button>
            <a href="activity-logs.html" class="gnotif-see-all-link" onclick="handleSeeAllGlobalNotifs(event)">
                ${globalNotifExpandedAll ? 'Open Activity Logs' : 'See All'} &rarr;
            </a>
        </div>
    `;

    listEl.innerHTML = cardsHtml + seeAllRowHtml;
}

function handleGlobalNotifClick(notifId, targetLink) {
    const readSet = getNotifReadSet();
    if (notifId) {
        readSet.add(notifId);
        saveNotifReadSet(readSet);
    }
    renderGlobalNotifications(false);

    if (targetLink) {
        const currentPage = window.location.pathname.split('/').pop() || 'analytics.html';
        if (currentPage === targetLink) {
            const dropdown = document.getElementById('global-notif-dropdown');
            const bellBtn = document.getElementById('global-notif-bell-btn');
            if (dropdown) dropdown.classList.remove('open');
            if (bellBtn) bellBtn.classList.remove('active');
        } else {
            window.location.href = targetLink;
        }
    }
}
window.handleGlobalNotifClick = handleGlobalNotifClick;

function handleSeeAllGlobalNotifs(event) {
    if (!globalNotifExpandedAll) {
        event.preventDefault();
        event.stopPropagation();
        globalNotifExpandedAll = true;
        renderGlobalNotifications(false);
    }
}
window.handleSeeAllGlobalNotifs = handleSeeAllGlobalNotifs;

function markAllGlobalNotifsRead(event) {
    if (event) event.stopPropagation();
    const readSet = getNotifReadSet();
    getAllMergedNotifications().forEach(item => readSet.add(item.id));
    saveNotifReadSet(readSet);
    renderGlobalNotifications(false);
}
window.markAllGlobalNotifsRead = markAllGlobalNotifsRead;

function setGlobalNotifFilter(filterKey, event) {
    if (event) event.stopPropagation();
    globalNotifFilter = filterKey;
    document.querySelectorAll('.gnotif-chip').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === filterKey);
    });
    renderGlobalNotifSkeletonStage(190, () => {
        renderGlobalNotifications(false);
    });
}
window.setGlobalNotifFilter = setGlobalNotifFilter;

function renderGlobalNotifSkeletonStage(durationMs = 220, onComplete = null) {
    const listEl = document.getElementById('gnotif-list');
    if (!listEl) {
        if (typeof onComplete === 'function') onComplete();
        return;
    }
    listEl.innerHTML = [1, 2, 3].map(() => `
        <div class="gnotif-skeleton-card" aria-hidden="true">
            <div class="gnotif-skeleton-avatar"></div>
            <div class="gnotif-skeleton-lines">
                <div class="gnotif-skeleton-line"></div>
                <div class="gnotif-skeleton-line short"></div>
            </div>
        </div>
    `).join('');

    setTimeout(() => {
        if (typeof onComplete === 'function') onComplete();
    }, durationMs);
}
window.renderGlobalNotifSkeletonStage = renderGlobalNotifSkeletonStage;

function toggleGlobalNotifDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('global-notif-dropdown');
    const bellBtn = document.getElementById('global-notif-bell-btn');
    if (!dropdown || !bellBtn) return;

    const isOpen = dropdown.classList.toggle('open');
    bellBtn.classList.toggle('active', isOpen);
    bellBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    if (isOpen) {
        renderGlobalNotifSkeletonStage(210, () => {
            renderGlobalNotifications(false);
        });
    }
}
window.toggleGlobalNotifDropdown = toggleGlobalNotifDropdown;

function toggleGlobalNotifSettings(event) {
    if (event) event.stopPropagation();
    const panel = document.getElementById('gnotif-settings-panel');
    if (panel) {
        panel.classList.toggle('open');
    }
}
window.toggleGlobalNotifSettings = toggleGlobalNotifSettings;

function initGlobalNotificationBell() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    // Remove legacy single-page notification bell if present so there's never a duplicate bell
    const legacyBell = document.getElementById('notification-bell-wrap');
    if (legacyBell) {
        legacyBell.style.display = 'none';
    }

    if (document.getElementById('global-notif-bell-wrap')) {
        renderGlobalNotifications(false);
        return;
    }

    const userNameEl = document.getElementById('topbar-user');
    let rightContainer = topbar.querySelector('.topbar-right-area') || topbar.querySelector('.topbar-right-cluster');

    if (!rightContainer) {
        rightContainer = document.createElement('div');
        rightContainer.className = 'topbar-right-cluster';
        if (userNameEl && userNameEl.parentNode === topbar) {
            topbar.insertBefore(rightContainer, userNameEl);
            rightContainer.appendChild(userNameEl);
        } else {
            topbar.appendChild(rightContainer);
        }
    }

    const bellWrap = document.createElement('div');
    bellWrap.className = 'global-notif-wrap';
    bellWrap.id = 'global-notif-bell-wrap';

    const isSettingsPage = (window.location.pathname || '').toLowerCase().includes('settings');

    bellWrap.innerHTML = `
        <button type="button" class="global-notif-bell-btn" id="global-notif-bell-btn" onclick="toggleGlobalNotifDropdown(event)" title="Notifications across all modules" aria-label="Notifications" aria-expanded="false">
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" stroke-width="2.2"></path>
            </svg>
            <span class="global-notif-badge hidden" id="global-notif-badge">0</span>
        </button>

        <a href="settings.html" class="global-topbar-settings-btn ${isSettingsPage ? 'active' : ''}" id="global-topbar-settings-btn" title="Settings &amp; Personal Preferences" aria-label="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
        </a>

        <div class="global-notif-dropdown" id="global-notif-dropdown" onclick="event.stopPropagation()">
            <div class="gnotif-header">
                <div class="gnotif-header-title">
                    <span>Notifications</span>
                    <span class="gnotif-live-dot" title="Connected to all modules in real time"></span>
                </div>
                <div class="gnotif-header-actions">
                    <a href="settings.html" class="gnotif-settings-btn" title="Open Settings &amp; Personal Preferences">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                        Settings
                    </a>
                </div>
            </div>

            <div class="gnotif-settings-panel" id="gnotif-settings-panel">
                <div class="gnotif-settings-row">
                    <span>Connected Modules (10 / 10 Active)</span>
                    <button type="button" class="gnotif-mark-read-link" style="color:#4ade80;" onclick="syncAllModuleNotifications(false)">Sync Now</button>
                </div>
                <div class="gnotif-settings-row">
                    <span>Unread Alert Badge</span>
                    <button type="button" class="gnotif-mark-read-link" onclick="markAllGlobalNotifsRead(event)">Reset Unread</button>
                </div>
                <div class="gnotif-settings-row">
                    <span>System Preferences</span>
                    <a href="settings.html" style="color:#38bdf8;text-decoration:none;font-weight:600;">Open Settings &rarr;</a>
                </div>
            </div>

            <div class="gnotif-filter-bar">
                <button type="button" class="gnotif-chip active" data-filter="all" onclick="setGlobalNotifFilter('all', event)">All Modules</button>
                <button type="button" class="gnotif-chip" data-filter="trucks" onclick="setGlobalNotifFilter('trucks', event)">Monitor Truck</button>
                <button type="button" class="gnotif-chip" data-filter="reports" onclick="setGlobalNotifFilter('reports', event)">Reports</button>
                <button type="button" class="gnotif-chip" data-filter="vendors" onclick="setGlobalNotifFilter('vendors', event)">Markets</button>
                <button type="button" class="gnotif-chip" data-filter="attendance" onclick="setGlobalNotifFilter('attendance', event)">Attendance</button>
                <button type="button" class="gnotif-chip" data-filter="schedule" onclick="setGlobalNotifFilter('schedule', event)">Schedule</button>
                <button type="button" class="gnotif-chip" data-filter="dss" onclick="setGlobalNotifFilter('dss', event)">DSS &amp; SLA</button>
            </div>

            <div class="gnotif-body" id="gnotif-list"></div>
        </div>
    `;

    rightContainer.appendChild(bellWrap);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('global-notif-dropdown');
        const bellBtn = document.getElementById('global-notif-bell-btn');
        if (dropdown && dropdown.classList.contains('open')) {
            if (!bellWrap.contains(e.target)) {
                dropdown.classList.remove('open');
                if (bellBtn) bellBtn.classList.remove('active');
            }
        }
    });

    // Listen to storage updates from other tabs or mobile simulation
    window.addEventListener('storage', (e) => {
        if (
            e.key === GLOBAL_NOTIF_STORAGE_KEY ||
            e.key === GLOBAL_NOTIF_READ_IDS_KEY ||
            e.key === 'clenro_custom_pickup_logs' ||
            e.key === 'clenro_dss_applied_decisions' ||
            e.key === 'clenro_dss_schedules' ||
            e.key === 'clenro_trucks_roster'
        ) {
            renderGlobalNotifications(true);
        }
    });

    // Infinite scroll lazy-loading stage inside the notification dropdown
    const listBodyEl = document.getElementById('gnotif-list');
    if (listBodyEl) {
        let isLazyExpanding = false;
        listBodyEl.addEventListener('scroll', () => {
            if (globalNotifExpandedAll || isLazyExpanding) return;
            if (listBodyEl.scrollTop + listBodyEl.clientHeight >= listBodyEl.scrollHeight - 24) {
                isLazyExpanding = true;
                const loader = document.createElement('div');
                loader.className = 'gnotif-lazy-more-indicator';
                loader.innerHTML = `<span class="global-floating-lazy-spinner"></span> Lazy-loading more module notifications...`;
                listBodyEl.appendChild(loader);
                setTimeout(() => {
                    globalNotifExpandedAll = true;
                    isLazyExpanding = false;
                    renderGlobalNotifications(false);
                }, 280);
            }
        });
    }

    renderGlobalNotifications(false);
    syncAllModuleNotifications(true);

    if (globalNotifSyncTimer) clearInterval(globalNotifSyncTimer);
    globalNotifSyncTimer = setInterval(() => {
        syncAllModuleNotifications(true);
    }, 20000);
}
window.initGlobalNotificationBell = initGlobalNotificationBell;

/*
|--------------------------------------------------------------------------
| UNIVERSAL FLOATING BAR LAZY-LOADING STAGE ENGINE (ALL WEBSITE MODULES)
|--------------------------------------------------------------------------
| Automatically applies staged lazy-loading (shimmer skeleton -> viewport
| intersection -> staggered progressive hydration) to all floating bars,
| topbars, executive banners, filter/tab bars, map HUD bars, pagination
| bars, KPI bars, and visual progress bars across all connected modules.
*/
const FLOATING_BAR_SELECTORS = [
    '.topbar',
    '.exec-header-banner',
    '.clenro-header-banner',
    '.filter-bar',
    '.filter-panel',
    '.ops-toolbar',
    '.ops-tabs',
    '.vendor-tabs-bar',
    '.card-filter-row',
    '.exec-map-header',
    '.exec-map-hud-legend',
    '.exec-fleet-deck',
    '.exec-sectors-header',
    '.pagination-container',
    '#pagination-container',
    '.analytics-chart-card',
    '.exec-kpi-card',
    '.sidebar-profile-card',
    '.sidebar-expand-float-btn'
].join(', ');

let lazyProgressActiveCount = 0;
let lazyProgressHideTimer = null;
let floatingBarIntersectionObserver = null;

// Silent background state tracker for floating bar lazy-loading (no visual notification popup)
function ensureGlobalLazyIndicators() {
    const legacyPill = document.getElementById('global-floating-lazy-pill');
    if (legacyPill) legacyPill.remove();
    const legacyWrap = document.getElementById('global-lazy-progress-wrap');
    if (legacyWrap) legacyWrap.remove();
}

function startGlobalLazyProgress() {
    if (isAuthPage()) return;
    ensureGlobalLazyIndicators();
    lazyProgressActiveCount++;
    if (lazyProgressHideTimer) {
        clearTimeout(lazyProgressHideTimer);
        lazyProgressHideTimer = null;
    }
    document.documentElement.setAttribute('data-lazy-stage', 'loading');
}
window.startGlobalLazyProgress = startGlobalLazyProgress;

function finishGlobalLazyProgress() {
    if (isAuthPage()) return;
    lazyProgressActiveCount = Math.max(0, lazyProgressActiveCount - 1);
    if (lazyProgressActiveCount > 0) return;

    lazyProgressHideTimer = setTimeout(() => {
        document.documentElement.setAttribute('data-lazy-stage', 'ready');
    }, 200);
}
window.finishGlobalLazyProgress = finishGlobalLazyProgress;

function hydrateVisualProgressBarsInside(rootEl) {
    const scope = rootEl || document;
    scope.querySelectorAll('.visual-bar-fill, .stacked-bar-segment').forEach((barEl, idx) => {
        if (barEl.dataset.lazyWidthHydrated === 'true') return;
        barEl.dataset.lazyWidthHydrated = 'true';
        barEl.classList.add('lazy-bar-hold');
        setTimeout(() => {
            barEl.classList.remove('lazy-bar-hold');
            barEl.classList.add('lazy-bar-animate');
        }, 90 + idx * 45);
    });
}

function triggerFloatingBarLazyStage(el, durationMs = 240) {
    if (!el || !(el instanceof HTMLElement)) return;
    el.classList.add('lazy-floating-bar', 'lazy-stage-loading');
    el.classList.remove('lazy-stage-ready');

    setTimeout(() => {
        el.classList.remove('lazy-stage-loading');
        el.classList.add('lazy-stage-ready');
        hydrateVisualProgressBarsInside(el);
    }, durationMs);
}
window.triggerFloatingBarLazyStage = triggerFloatingBarLazyStage;

function observeFloatingBarElement(el, staggerIndex = 0) {
    if (!el || !(el instanceof HTMLElement)) return;
    if (el.dataset.lazyFloatingRegistered === 'true') return;
    el.dataset.lazyFloatingRegistered = 'true';
    el.classList.add('lazy-floating-bar', 'lazy-stage-loading');

    const delay = Math.min(420, 110 + staggerIndex * 45);

    if (floatingBarIntersectionObserver) {
        el.dataset.lazyDelayMs = String(delay);
        floatingBarIntersectionObserver.observe(el);
    } else {
        triggerFloatingBarLazyStage(el, delay);
    }
}

function initGlobalFloatingBarLazyLoading() {
    if (isAuthPage()) return;
    ensureGlobalLazyIndicators();

    const modMeta = typeof detectCurrentModuleMeta === 'function' ? detectCurrentModuleMeta() : { moduleLabel: 'Module' };
    startGlobalLazyProgress(`Lazy-loading ${modMeta.moduleLabel} floating bars...`);

    if ('IntersectionObserver' in window && !floatingBarIntersectionObserver) {
        floatingBarIntersectionObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    const delay = parseInt(target.dataset.lazyDelayMs || '180', 10);
                    triggerFloatingBarLazyStage(target, delay);
                    observer.unobserve(target);
                }
            });
        }, {
            root: null,
            rootMargin: '100px 0px',
            threshold: 0.05
        });
    }

    const bars = Array.from(document.querySelectorAll(FLOATING_BAR_SELECTORS));
    bars.forEach((el, index) => {
        observeFloatingBarElement(el, index);
    });

    // Also stage any standalone progress bars on the page
    hydrateVisualProgressBarsInside(document);

    // Watch for dynamically rendered floating bars, pagination controls, or modals across modules
    const mainContent = document.querySelector('.main-content') || document.body;
    if ('MutationObserver' in window && mainContent) {
        const mutObserver = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (!(node instanceof HTMLElement)) return;
                    if (node.matches && node.matches(FLOATING_BAR_SELECTORS)) {
                        observeFloatingBarElement(node, 1);
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll(FLOATING_BAR_SELECTORS).forEach((child, idx) => {
                            observeFloatingBarElement(child, idx + 1);
                        });
                    }
                });
            });
        });
        mutObserver.observe(mainContent, { childList: true, subtree: true });
    }

    // Trigger floating bar lazy-loading stage when switching module tabs or filter buttons
    document.addEventListener('click', (e) => {
        const tabOrFilterBtn = e.target.closest('.ops-tab-btn, .vendor-tab-btn, .exec-filter-btn, .page-btn');
        if (tabOrFilterBtn) {
            startGlobalLazyProgress(`Updating ${modMeta.moduleLabel} view...`);
            const parentBar = tabOrFilterBtn.closest('.ops-toolbar, .vendor-tabs-bar, .exec-sectors-container, .card');
            if (parentBar) {
                triggerFloatingBarLazyStage(parentBar, 190);
            }
            setTimeout(() => {
                finishGlobalLazyProgress();
            }, 240);
        }
    });

    setTimeout(() => {
        finishGlobalLazyProgress();
    }, 340);
}
window.initGlobalFloatingBarLazyLoading = initGlobalFloatingBarLazyLoading;

// Run auth check on load
checkAuth();

document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthPage()) {
        loadSidebar();
    }
    initResponsiveLayout();
    if (!isAuthPage()) {
        initGlobalNotificationBell();
        initGlobalFloatingBarLazyLoading();
    }
});



