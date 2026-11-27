(() => {
      const builtInLayouts = Array.from({ length: 6 }, (_, index) => ({
        id: `builtin-${index + 1}`,
        name: `Layout ${index + 1}`,
        src: `parkview/layout${index + 1}.jpg`,
        type: 'Project drawing',
        uploaded: false
      }));

      const stage = document.getElementById('planStage');
      const image = document.getElementById('planImage');
      const markerLayer = document.getElementById('markerLayer');
      const markerEditor = document.getElementById('markerEditor');
      const markerToggle = document.getElementById('markerToggle');
      const moveMarkerToggle = document.getElementById('moveMarkerToggle');
      const markerClose = document.getElementById('markerClose');
      const markerDetailsView = document.getElementById('markerDetailsView');
      const markerEditFields = document.getElementById('markerEditFields');
      const markerEdit = document.getElementById('markerEdit');
      const markerEditorActions = document.getElementById('markerEditorActions');
      const sidebar = document.querySelector('.app-sidebar');
      const layoutList = document.getElementById('layoutList');
      const appShell = document.querySelector('.app-shell');
      const loginScreen = document.getElementById('loginScreen');
      const accountMenu = document.getElementById('accountMenu');
      const accountButton = document.getElementById('accountButton');
      const accountPopover = document.getElementById('accountPopover');
      const accountName = document.getElementById('accountName');
      const accountDescription = document.getElementById('accountDescription');
      const accountSignIn = document.getElementById('accountSignIn');
      const accountSignOut = document.getElementById('accountSignOut');
      const loginForm = document.getElementById('loginForm');
      const loginUsername = document.getElementById('loginUsername');
      const loginPassword = document.getElementById('loginPassword');
      const loginFeedback = document.getElementById('loginFeedback');
      const loginSubmit = document.getElementById('loginSubmit');
      const loginSubmitLabel = document.getElementById('loginSubmitLabel');
      const markerPhotoInput = document.getElementById('markerPhoto');
      const markerPhotoGallery = document.getElementById('markerPhotoGallery');
      const photoViewer = document.getElementById('photoViewer');
      const photoViewerImage = document.getElementById('photoViewerImage');
      const photoViewerStage = document.getElementById('photoViewerStage');
      const list = document.getElementById('layoutList');
      const fileInput = document.getElementById('fileInput');
      const layoutConfirm = document.getElementById('layoutConfirm');
      const layoutRenameDialog = document.getElementById('layoutRenameDialog');
      const layoutRenameForm = document.getElementById('layoutRenameForm');
      const layoutRenameInput = document.getElementById('layoutRenameInput');
      const toast = document.getElementById('toast');
      const markersByLayout = new Map();
      const sessionMarkerPhotos = new Map();
      const markerCloudConfig = window.PARKVIEW_SUPABASE;
      const currentHostname = window.location.hostname.toLowerCase();
      const markerCloudSiteId = (markerCloudConfig.siteIds || {})[currentHostname] ||
        'parkviewdashboard';
      const legacyMarkerStorageKey = 'mquest-parkview-markers';
      const markerStorageKey = `${legacyMarkerStorageKey}:${markerCloudSiteId}`;
      const authSessionStorageKey = `mquest-parkview-auth:${markerCloudSiteId}`;
      const authBaseUrl = markerCloudConfig.restUrl.replace(/\/rest\/v1\/?$/, '');
      const defaultProjectId = 'park-view-label';
      const projectStorageKey = `mquest-parkview-projects:${markerCloudSiteId}`;
      const activeProjectStorageKey = `mquest-parkview-active-project:${markerCloudSiteId}`;
      const projects = [{
        id: defaultProjectId,
        name: 'Park View Label',
        layouts: [...builtInLayouts]
      }];
      try {
        const savedProjects = JSON.parse(localStorage.getItem(projectStorageKey) || '[]');
        if (!Array.isArray(savedProjects)) throw new Error('Saved projects have an invalid format.');
        savedProjects.forEach((project) => {
          if (!project || typeof project.id !== 'string' || typeof project.name !== 'string') {
            throw new Error('A saved project has an invalid format.');
          }
          const existing = projects.find((item) => item.id === project.id);
          if (existing) {
            existing.name = project.name;
            existing.updatedAt = project.updatedAt;
            existing.deleted = project.deleted === true;
          } else {
            projects.push({
              id: project.id,
              name: project.name,
              updatedAt: project.updatedAt,
              deleted: project.deleted === true,
              layouts: []
            });
          }
        });
      } catch (error) {
        console.error('Unable to restore saved projects:', error);
      }
      let savedActiveProjectId = null;
      try {
        savedActiveProjectId = localStorage.getItem(activeProjectStorageKey);
      } catch (error) {
        console.error('Unable to restore the active project:', error);
      }
      let activeProject = projects.find((project) =>
        project.id === savedActiveProjectId && !project.deleted
      ) || projects.find((project) => !project.deleted) || projects[0];
      let layouts = activeProject.layouts;
      const getMarkerCloudRestUrl = () => markerCloudConfig.restUrl.endsWith('/')
        ? markerCloudConfig.restUrl.slice(0, -1)
        : markerCloudConfig.restUrl;
      let selectedIndex = 0;
      let zoom = 1;
      let panX = 0;
      let panY = 0;
      let drag = null;
      let markerMode = false;
      let markerMoveMode = false;
      let movingMarkerId = null;
      let authSession = null;
      let authRefreshTimer = null;
      let presenceUserId = null;
      let presenceDisplayName = null;
      let presenceRole = null;
      let presenceHeartbeatTimer = null;
      let guestId = null;
      let draftMarkerPoint = null;
      let editingMarkerId = null;
      let markerPanelPoint = null;
      let toastTimer;
      let database = null;
      let databasePromise = null;
      let markerSyncPromise = Promise.resolve();
      let layoutSyncPromise = Promise.resolve();
      let layoutSyncInProgress = false;
      let projectSyncInProgress = false;
      let projectSyncErrorAnnounced = false;
      let projectCloudSyncAvailable = false;
      let layoutToRename = null;
      let projectToRename = null;
      let projectToDelete = null;
      let layoutToDelete = null;
      let pinch = null;
      const activePointers = new Map();
      let markerCloudBaseline = new Map();
      let markerPhotoMigrationOccurred = false;
      let markerCloudInitialized = false;
      let markerSyncInProgress = false;
      let markerSaveInProgress = false;
      let markerCloudDirty = false;
      let markerSyncErrorAnnounced = false;
      let lastCloudSyncAt = 0;
      let lastCloudSyncFailed = false;
      let pendingMarkerPhotos = [];
      let removedMarkerPhotoIds = new Set();
      let photoLoadToken = 0;
      let photoZoom = 1;
      let photoViewerReturnFocus = null;
      const photoViewerResizeObserver = new ResizeObserver(() => fitPhotoToStage());
      photoViewerResizeObserver.observe(photoViewerStage);
      const clockTime = document.getElementById('clockTime');
      const clockDate = document.getElementById('clockDate');
      const updateClock = () => {
        const now = new Date();
        clockTime.textContent = new Intl.DateTimeFormat('en-SG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23'
        }).format(now);
        clockDate.textContent = new Intl.DateTimeFormat('en-SG', {
          weekday: 'short',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }).format(now);
      };
      updateClock();
      setInterval(updateClock, 1000);

      const themeToggle = document.getElementById('themeToggle');
      const themeToggleLabel = document.getElementById('themeToggleLabel');
      const themeStorageKey = 'mquest-parkview-theme';
      const setTheme = (theme) => {
        const isDark = theme === 'dark';
        document.body.dataset.theme = isDark ? 'dark' : 'light';
        themeToggle.setAttribute('aria-pressed', String(isDark));
        themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
        themeToggleLabel.textContent = isDark ? 'Dark mode' : 'Light mode';
      };
      let savedTheme = 'light';
      try {
        savedTheme = localStorage.getItem(themeStorageKey) || 'light';
      } catch (error) {
        console.error('Unable to restore the color theme:', error);
      }
      setTheme(savedTheme === 'dark' ? 'dark' : 'light');
      themeToggle.addEventListener('click', () => {
        const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
        try {
          localStorage.setItem(themeStorageKey, nextTheme);
        } catch (error) {
          console.error('Unable to save the color theme:', error);
          announce('Theme changed, but the preference could not be saved.', true);
        }
      });

      const announce = (message, isError = false) => {
        toast.textContent = message;
        toast.classList.toggle('error', isError);
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
      };

      const authRequest = async (path, payload, accessToken, method = 'POST') => {
        const headers = {
          apikey: markerCloudConfig.anonKey,
          'Content-Type': 'application/json'
        };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        let response;
        try {
          response = await fetch(`${authBaseUrl}${path}`, {
            method,
            headers,
            body: JSON.stringify(payload)
          });
        } catch (error) {
          throw new Error('Could not reach the secure sign-in service. Check your connection and try again.');
        }

        let result;
        try {
          result = await response.json();
        } catch (error) {
          throw new Error('The sign-in service returned an invalid response. Please try again.');
        }
        if (!result || typeof result !== 'object') {
          throw new Error('The sign-in service returned an invalid response. Please try again.');
        }
        if (!response.ok) {
          const message = result.msg || result.message || result.error_description || result.error;
          const authError = new Error(typeof message === 'string' ? message : 'Sign in failed. Please try again.');
          authError.status = response.status;
          throw authError;
        }
        return result;
      };

      const getSupabaseHeaders = (headers = {}) => ({
        apikey: markerCloudConfig.anonKey,
        ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}),
        ...headers
      });

      // Every request to the Supabase database/storage goes through here, so the
      // signed-in user's token is attached (the database security rules check it)
      // and is refreshed first if it is about to expire.
      const supabaseFetch = async (url, options = {}) => {
        if (authSession && authSession.expires_at - Date.now() < 30000) {
          await refreshAuthSession();
        }
        return fetch(url, { ...options, headers: getSupabaseHeaders(options.headers || {}) });
      };

      const createAuthSession = (result, previousSession) => {
        const user = result.user || (previousSession && previousSession.user);
        const expiresIn = Number(result.expires_in);
        if (typeof result.access_token !== 'string' || typeof result.refresh_token !== 'string' ||
          !user || typeof user.email !== 'string' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
          throw new Error('The sign-in service returned incomplete session details.');
        }
        return {
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          expires_at: Date.now() + expiresIn * 1000,
          user: {
            id: typeof user.id === 'string' ? user.id : '',
            email: user.email,
            role: user.app_metadata && ['owner', 'editor'].includes(user.app_metadata.parkview_role)
              ? user.app_metadata.parkview_role
              : 'viewer'
          }
        };
      };

      const isWorkspaceEditor = () =>
        Boolean(authSession && ['owner', 'editor'].includes(authSession.user.role));
      const isWorkspaceOwner = () => Boolean(authSession && authSession.user.role === 'owner');
      const requireWorkspaceEditor = () => {
        if (isWorkspaceEditor()) return true;
        announce('Sign in with an MQuest editor account to make changes.', true);
        return false;
      };

      const displayNameFromEmail = (email) => {
        if (!email) return '';
        const localPart = String(email).split('@')[0];
        return localPart || email;
      };

      const updateAccountMenu = () => {
        const isSignedIn = Boolean(authSession);
        const role = isSignedIn ? authSession.user.role : 'guest';
        document.body.dataset.workspaceRole = role;
        const displayName = isSignedIn
          ? (displayNameFromEmail(authSession.user.email) || 'User')
          : 'Guest';
        accountName.textContent = displayName;
        accountDescription.textContent = role === 'owner'
          ? 'Workspace owner'
          : role === 'editor'
            ? 'Project editor'
            : isSignedIn ? 'View-only account' : 'Guest access to the project workspace';
        accountSignIn.hidden = isSignedIn;
        accountSignOut.hidden = !isSignedIn;
        accountButton.setAttribute('aria-label', isSignedIn
          ? `Open account menu for ${displayName}`
          : 'Open guest account menu');
        if (panelRoleHook) panelRoleHook();
      };

      const setLoginFeedback = (message) => {
        loginFeedback.textContent = message;
        loginFeedback.hidden = !message;
      };

      const closeAccountPopover = () => {
        accountPopover.hidden = true;
        accountButton.setAttribute('aria-expanded', 'false');
      };

      const showLoginScreen = () => {
        closeAccountPopover();
        loginForm.reset();
        setLoginFeedback('');
        setLoginMode('signin');
        appShell.hidden = true;
        loginScreen.hidden = false;
        window.requestAnimationFrame(() => loginUsername.focus());
      };

      const showProjectWorkspace = () => {
        loginScreen.hidden = true;
        appShell.hidden = false;
        accountButton.focus();
      };

      // ---- Presence & usage tracking ------------------------------------------
      // Every open, visible tab sends a heartbeat. The database adds up active
      // time per user / guest (see parkview_heartbeat in supabase.sql).
      const presenceRestUrl = () => `${getMarkerCloudRestUrl()}/parkview_presence`;
      const usersRestUrl = () => `${getMarkerCloudRestUrl()}/parkview_users`;
      const presenceStaleMs = 45000;
      const presenceHeartbeatMs = 15000;
      const presenceFetchMs = 5000;
      const guestIdKey = `mquest-parkview-guest-id:${markerCloudSiteId}`;
      let presenceFetchTimer = null;
      let heartbeatWarned = false;

      const randomId = () => (window.crypto && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

      // A private random ID per browser; the database numbers guests (Guest #1, #2 …).
      const ensureGuestId = () => {
        if (guestId) return guestId;
        try { guestId = localStorage.getItem(guestIdKey); } catch (error) { guestId = null; }
        if (!guestId || !/^guest-[A-Za-z0-9-]{8,64}$/.test(guestId)) {
          guestId = `guest-${randomId()}`;
          try { localStorage.setItem(guestIdKey, guestId); } catch (error) { /* private mode */ }
        }
        return guestId;
      };

      // A one-way hash of hardware / OS traits, so the same computer is
      // recognised as the same guest even in a private window, another
      // browser, another website address or after clearing site data.
      // Only the hash is sent; the raw traits never leave the browser.
      let deviceKeyPromise = null;
      const getDeviceKey = () => {
        if (deviceKeyPromise) return deviceKeyPromise;
        deviceKeyPromise = (async () => {
          try {
            if (!window.crypto || !crypto.subtle) return null;
            let gpu = '';
            try {
              const canvas = document.createElement('canvas');
              const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
              if (gl) {
                const info = gl.getExtension('WEBGL_debug_renderer_info');
                gpu = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
                gl.getExtension('WEBGL_lose_context')?.loseContext();
              }
            } catch (error) { gpu = ''; }
            // Normalise the GPU name so different browsers on one machine agree.
            gpu = gpu.toLowerCase()
              .replace(/^angle \(/, '').replace(/\)$/, '')
              .replace(/direct3d.*|vs_\d.*|opengl.*|metal.*|, or similar/g, '')
              .replace(/\(r\)|\(tm\)|0x[0-9a-f]+/g, '')
              .split(',').map((part) => part.trim()).filter(Boolean).pop() || gpu;
            const isTouch = (navigator.maxTouchPoints || 0) > 0;
            const traits = [
              navigator.platform || '',
              Intl.DateTimeFormat().resolvedOptions().timeZone || '',
              navigator.hardwareConcurrency || 0,
              navigator.maxTouchPoints || 0,
              gpu.replace(/\s+/g, ' ').trim(),
              // Phones/tablets have a fixed screen; desktops can move between monitors.
              isTouch ? `${Math.max(screen.width, screen.height)}x${Math.min(screen.width, screen.height)}@${window.devicePixelRatio || 1}` : ''
            ].join('|');
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`parkview-device:${traits}`));
            const hex = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
            return `dev-${hex.slice(0, 40)}`;
          } catch (error) {
            return null;
          }
        })();
        return deviceKeyPromise;
      };

      const adoptGuestId = (id) => {
        if (!id || id === guestId || !/^guest-[A-Za-z0-9-]{8,64}$/.test(id)) return;
        guestId = id;
        try { localStorage.setItem(guestIdKey, id); } catch (error) { /* private mode */ }
      };

      const nameColorHash = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
          hash |= 0;
        }
        // Stay within the blue family (red is reserved for alerts).
        return `hsl(${195 + (Math.abs(hash) % 40)}, 72%, ${38 + (Math.abs(hash >> 4) % 16)}%)`;
      };

      const currentLocation = () => {
        const project = activeProject || { id: defaultProjectId, name: 'Park View Label' };
        const layout = layouts[selectedIndex] || { id: 'none', name: 'No layout' };
        return { project, layout };
      };

      const sendHeartbeat = async () => {
        if (document.hidden) return;
        const { project, layout } = currentLocation();
        const isGuest = !authSession;
        const payload = {
          p_client_id: isGuest ? ensureGuestId() : null,
          p_project_id: project.id,
          p_project_name: project.name,
          p_layout_id: layout.id,
          p_layout_name: layout.name
        };
        if (isGuest) {
          const deviceKey = await getDeviceKey();
          if (deviceKey) payload.p_device_key = deviceKey;
        }
        const post = (body) => supabaseFetch(`${getMarkerCloudRestUrl()}/rpc/parkview_heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        try {
          let response = await post(payload);
          // Database not updated yet? Fall back to the previous version of the call.
          if (!response.ok && payload.p_device_key && (response.status === 404 || response.status === 300)) {
            const { p_device_key: unused, ...legacyPayload } = payload;
            response = await post(legacyPayload);
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const result = await response.json();
          if (result && typeof result.user_id === 'string') {
            // The database may recognise this computer as an existing guest.
            if (isGuest && !authSession) {
              if (result.user_id !== guestId && presenceUserId && presenceUserId !== result.user_id) {
                deletePresence(presenceUserId);
              }
              adoptGuestId(result.user_id);
            }
            presenceUserId = result.user_id;
            presenceDisplayName = result.display_name;
          }
        } catch (error) {
          if (!heartbeatWarned) {
            console.warn('Online status is not being recorded. Run the latest supabase.sql.', error.message);
            heartbeatWarned = true;
          }
        }
      };

      const deletePresence = (userId) => supabaseFetch(
        `${presenceRestUrl()}?user_id=eq.${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      ).catch((error) => console.error('Unable to clear online status:', error));

      const fetchPresence = async () => {
        try {
          const cutoff = new Date(Date.now() - presenceStaleMs).toISOString();
          const response = await supabaseFetch(
            `${presenceRestUrl()}?updated_at=gt.${encodeURIComponent(cutoff)}&order=updated_at.desc`
          );
          if (!response.ok) return [];
          const rows = await response.json();
          return Array.isArray(rows) ? rows : [];
        } catch (error) {
          return [];
        }
      };

      const fetchAllUsers = async () => {
        const response = await supabaseFetch(`${usersRestUrl()}?order=last_seen_at.desc`);
        if (!response.ok) throw new Error(`Could not load users (${response.status}). Run the latest supabase.sql.`);
        const rows = await response.json();
        return Array.isArray(rows) ? rows : [];
      };

      const stopPresenceTimers = () => {
        clearInterval(presenceHeartbeatTimer);
        clearInterval(presenceFetchTimer);
        presenceHeartbeatTimer = null;
        presenceFetchTimer = null;
      };

      const startPresence = () => {
        stopPresenceTimers();
        presenceUserId = authSession ? authSession.user.id : ensureGuestId();
        presenceRole = authSession ? authSession.user.role : 'guest';
        sendHeartbeat().then(refreshPresenceUI);
        presenceHeartbeatTimer = setInterval(sendHeartbeat, presenceHeartbeatMs);
        presenceFetchTimer = setInterval(refreshPresenceUI, presenceFetchMs);
      };

      // Remove this browser's online row (sent while the current token is still attached).
      const stopPresence = () => {
        stopPresenceTimers();
        if (presenceUserId) deletePresence(presenceUserId);
        presenceUserId = null;
        presenceDisplayName = null;
        presenceRole = null;
      };

      const updatePresenceLocation = () => {
        if (!presenceUserId) return;
        sendHeartbeat().then(refreshPresenceUI);
      };

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && presenceUserId) sendHeartbeat();
      });

      const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      let latestPresenceRows = [];
      let onPresenceUpdated = null; // set by the Users panel
      let panelDataHook = null; // set by the sidebar panels
      let panelRoleHook = null;
      const refreshPresenceUI = async () => {
        latestPresenceRows = await fetchPresence();
        renderPresenceAvatars(latestPresenceRows);
        if (onPresenceUpdated) onPresenceUpdated(latestPresenceRows);
      };

      const isRowMe = (row) => row.user_id === presenceUserId;
      const avatarInitial = (name) => {
        const text = String(name || 'U');
        return /^Guest #/.test(text) ? 'G' : text.charAt(0).toUpperCase();
      };
      const makeAvatar = (row, className) => {
        const avatar = document.createElement('span');
        avatar.className = `${className}${isRowMe(row) ? ' is-me' : ''}${row.role === 'guest' ? ' is-guest' : ''}`;
        avatar.style.background = nameColorHash(row.display_name || row.user_id);
        avatar.textContent = avatarInitial(row.display_name);
        avatar.title = isRowMe(row) ? `${row.display_name} (you)` : row.display_name;
        return avatar;
      };
      const describePeople = (rows) => rows.map((row) => (isRowMe(row) ? `${row.display_name} (you)` : row.display_name)).join(', ');

      // Avatars on the plan, on each layout / project in the sidebar, and the live count.
      const renderPresenceAvatars = (rows) => {
        const layer = document.getElementById('presenceLayer');
        layer.replaceChildren();
        const currentLayout = layouts[selectedIndex];
        if (currentLayout && activeProject) {
          const here = rows.filter((row) => row.project_id === activeProject.id &&
            row.layout_id === currentLayout.id && !isRowMe(row));
          here.slice(0, 6).forEach((row) => {
            const avatar = makeAvatar(row, 'presence-avatar');
            avatar.title = `${row.display_name} is viewing this layout`;
            layer.appendChild(avatar);
          });
          if (here.length) layer.removeAttribute('aria-hidden');
          else layer.setAttribute('aria-hidden', 'true');
        } else {
          layer.setAttribute('aria-hidden', 'true');
        }

        // Sidebar → Layouts: who is on each layout (you included)
        document.querySelectorAll('#layoutList .layout-item').forEach((item) => {
          item.querySelector('.layout-presence-avatars')?.remove();
          const usersHere = activeProject ? rows.filter((row) => row.project_id === activeProject.id &&
            row.layout_id === item.dataset.layoutId) : [];
          item.dataset.liveCount = String(usersHere.length);
          item.classList.toggle('has-live-users', usersHere.length > 0);
          if (!usersHere.length) return;
          const wrap = document.createElement('span');
          wrap.className = 'layout-presence-avatars';
          wrap.title = `On this layout: ${describePeople(usersHere)}`;
          wrap.setAttribute('aria-label', `${usersHere.length} on this layout: ${describePeople(usersHere)}`);
          const ordered = usersHere.slice().sort((a, b) => Number(isRowMe(b)) - Number(isRowMe(a)));
          ordered.slice(0, 3).forEach((row) => wrap.appendChild(makeAvatar(row, 'layout-presence-avatar')));
          if (usersHere.length > 3) {
            const more = document.createElement('span');
            more.className = 'layout-presence-avatar more';
            more.textContent = `+${usersHere.length - 3}`;
            wrap.appendChild(more);
          }
          // Sits under the layout name, next to the device count, so the
          // rename / delete buttons never cover it.
          (item.querySelector('.layout-item-copy') || item).appendChild(wrap);
        });

        // Sidebar → Projects: how many people are in each project
        document.querySelectorAll('#projectList .sidebar-item').forEach((button) => {
          button.querySelector('.project-live-count')?.remove();
          const inProject = rows.filter((row) => row.project_id === button.dataset.projectId);
          if (!inProject.length) return;
          const badge = document.createElement('span');
          badge.className = 'project-live-count';
          badge.title = `In this project: ${describePeople(inProject)}`;
          badge.setAttribute('aria-label', `${inProject.length} live in this project`);
          badge.textContent = String(inProject.length);
          button.appendChild(badge);
        });

        renderLiveUsers(rows);
      };

      // ---- Top bar: live users (signed-in users only) -------------------------
      const liveUsersButton = document.getElementById('liveUsersButton');
      const liveUsersPopover = document.getElementById('liveUsersPopover');
      const liveUserCount = document.getElementById('liveUserCount');

      const goToLayout = (projectId, layoutId) => {
        const project = getActiveProjects().find((item) => item.id === projectId);
        if (!project) return false;
        if (project !== activeProject) selectProject(project.id);
        const index = layouts.findIndex((layout) => layout.id === layoutId);
        if (index === -1) return false;
        if (index !== selectedIndex) selectLayout(index);
        return true;
      };

      const renderLiveUsers = (rows) => {
        const signedIn = rows.filter((row) => row.role !== 'guest').length;
        const guests = rows.length - signedIn;
        liveUserCount.textContent = String(rows.length);
        liveUsersButton.setAttribute('aria-label', `${rows.length} live ${rows.length === 1 ? 'user' : 'users'}. Show who is online.`);
        liveUsersButton.classList.toggle('is-busy', rows.length > 1);
        document.getElementById('liveUsersSubtitle').textContent =
          `${signedIn} signed in · ${guests} ${guests === 1 ? 'guest' : 'guests'}`;
        const body = document.getElementById('liveUsersBody');
        body.replaceChildren();
        if (!rows.length) {
          const empty = document.createElement('p');
          empty.className = 'live-users-empty';
          empty.textContent = 'Nobody else is online right now.';
          body.append(empty);
          return;
        }
        // Group people by where they are
        const groups = new Map();
        rows.forEach((row) => {
          const key = `${row.project_id}\u0000${row.layout_id}`;
          if (!groups.has(key)) groups.set(key, { row, people: [] });
          groups.get(key).people.push(row);
        });
        Array.from(groups.values())
          .sort((a, b) => b.people.length - a.people.length)
          .forEach(({ row, people }) => {
            const section = document.createElement('section');
            section.className = 'live-group';
            const head = document.createElement('button');
            head.type = 'button';
            head.className = 'live-group-head';
            const isHere = activeProject && row.project_id === activeProject.id &&
              layouts[selectedIndex] && row.layout_id === layouts[selectedIndex].id;
            const where = document.createElement('span');
            where.className = 'live-group-where';
            const projectName = document.createElement('small');
            projectName.textContent = row.project_name || 'Project';
            const layoutName = document.createElement('strong');
            layoutName.textContent = row.layout_name || 'Layout';
            where.append(projectName, layoutName);
            const go = document.createElement('span');
            go.className = 'live-group-go';
            go.textContent = isHere ? 'You are here' : 'Go to layout';
            head.append(where, go);
            head.disabled = Boolean(isHere);
            head.addEventListener('click', () => {
              if (goToLayout(row.project_id, row.layout_id)) closeLiveUsers();
              else announce('That layout is not available on this device.', true);
            });
            const list = document.createElement('ul');
            list.className = 'live-group-people';
            people.sort((a, b) => Number(isRowMe(b)) - Number(isRowMe(a))).forEach((person) => {
              const li = document.createElement('li');
              const name = document.createElement('span');
              name.className = 'live-person-name';
              name.textContent = person.display_name;
              const role = document.createElement('small');
              role.className = 'live-person-role';
              role.textContent = isRowMe(person) ? 'You'
                : person.role === 'guest' ? 'Guest' : person.role.charAt(0).toUpperCase() + person.role.slice(1);
              li.append(makeAvatar(person, 'live-person-avatar'), name, role);
              list.append(li);
            });
            section.append(head, list);
            body.append(section);
          });
      };

      const closeLiveUsers = () => {
        liveUsersPopover.hidden = true;
        liveUsersButton.setAttribute('aria-expanded', 'false');
      };
      liveUsersButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const open = liveUsersPopover.hidden;
        closeAccountPopover();
        liveUsersPopover.hidden = !open;
        liveUsersButton.setAttribute('aria-expanded', String(open));
        if (open) refreshPresenceUI();
      });
      document.addEventListener('click', (event) => {
        if (!liveUsersPopover.hidden && !liveUsersPopover.contains(event.target)) closeLiveUsers();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !liveUsersPopover.hidden) {
          closeLiveUsers();
          liveUsersButton.focus();
        }
      });

      const setAuthSession = (session) => {
        if (presenceUserId) stopPresence();
        authSession = session;
        updateAccountMenu();
        startPresence();
        let sessionSaved = true;
        try {
          localStorage.setItem(authSessionStorageKey, JSON.stringify(session));
        } catch (error) {
          console.error('Unable to save the sign-in session:', error);
          announce('Signed in, but this browser could not save your session. You may need to sign in again.', true);
          sessionSaved = false;
        }
        scheduleAuthRefresh();
        return sessionSaved;
      };

      const clearAuthSession = () => {
        const previousSession = authSession;
        if (previousSession) stopPresence();
        authSession = null;
        clearTimeout(authRefreshTimer);
        authRefreshTimer = null;
        updateAccountMenu();
        if (!presenceUserId) startPresence();
        try {
          localStorage.removeItem(authSessionStorageKey);
        } catch (error) {
          console.error('Unable to clear the saved sign-in session:', error);
          announce('Signed out here, but the saved session could not be cleared from this browser.', true);
        }
      };

      let authRefreshPromise = null;
      const refreshAuthSession = () => {
        if (!authSession) return Promise.resolve();
        if (!authRefreshPromise) {
          authRefreshPromise = runAuthRefresh().finally(() => { authRefreshPromise = null; });
        }
        return authRefreshPromise;
      };

      const runAuthRefresh = async () => {
        const previousSession = authSession;
        try {
          const result = await authRequest(
            '/auth/v1/token?grant_type=refresh_token',
            { refresh_token: previousSession.refresh_token }
          );
          if (authSession === previousSession) {
            setAuthSession(createAuthSession(result, previousSession));
          }
        } catch (error) {
          console.error('Unable to refresh the sign-in session:', error);
          if (authSession === previousSession) {
            if (error.status === 400 || error.status === 401 || Date.now() >= previousSession.expires_at) {
              clearAuthSession();
              announce('Your MQuest session expired. Please sign in again.', true);
            } else {
              const retryDelay = Math.min(15000, Math.max(1000, previousSession.expires_at - Date.now()));
              authRefreshTimer = setTimeout(refreshAuthSession, retryDelay);
            }
          }
        }
      };

      const scheduleAuthRefresh = () => {
        clearTimeout(authRefreshTimer);
        if (!authSession) return;
        const refreshDelay = Math.max(0, authSession.expires_at - Date.now() - 60000);
        authRefreshTimer = setTimeout(refreshAuthSession, refreshDelay);
      };

      const restoreAuthSession = () => {
        let savedSession;
        try {
          const savedValue = localStorage.getItem(authSessionStorageKey);
          if (!savedValue) {
            updateAccountMenu();
            startPresence();
            return;
          }
          savedSession = JSON.parse(savedValue);
          if (!savedSession || typeof savedSession.access_token !== 'string' ||
            typeof savedSession.refresh_token !== 'string' || !Number.isFinite(savedSession.expires_at) ||
            !savedSession.user || typeof savedSession.user.email !== 'string') {
            throw new Error('The saved sign-in session has an invalid format.');
          }
        } catch (error) {
          console.error('Unable to restore the sign-in session:', error);
          clearAuthSession();
          announce('The saved sign-in session could not be restored. Please sign in again.', true);
          return;
        }

        authSession = savedSession;
        if (!['owner', 'editor'].includes(authSession.user.role)) authSession.user.role = 'viewer';
        updateAccountMenu();
        startPresence();
        if (authSession.expires_at <= Date.now() + 60000) {
          refreshAuthSession();
        } else {
          scheduleAuthRefresh();
        }
      };

      const getProjectForLayoutId = (layoutId) =>
        projects.find((project) => project.id !== defaultProjectId && layoutId.startsWith(`${project.id}--`)) ||
        projects[0];

      const getActiveProjects = () => projects.filter((project) => !project.deleted);

      const ensureActiveProject = () => {
        if (getActiveProjects().length) return;
        const defaultProject = projects.find((project) => project.id === defaultProjectId);
        if (defaultProject) {
          defaultProject.deleted = false;
          defaultProject.updatedAt = new Date().toISOString();
          return;
        }
        projects.unshift({
          id: defaultProjectId,
          name: 'Park View Label',
          layouts: [...builtInLayouts]
        });
      };

      const persistProjects = () => {
        try {
          localStorage.setItem(projectStorageKey, JSON.stringify(projects.map(({ id, name, updatedAt, deleted }) => ({
            id,
            name,
            updatedAt,
            deleted: deleted === true
          }))));
          return true;
        } catch (error) {
          console.error('Unable to save projects:', error);
          return false;
        }
      };

      const updateProjectControls = () => {
        ensureActiveProject();
        document.getElementById('pageTitle').textContent = activeProject.name;
        document.title = `${activeProject.name} | MQuest`;
        const renameButton = document.getElementById('projectRename');
        renameButton.setAttribute('aria-label', `Rename ${activeProject.name}`);
        renameButton.title = `Rename ${activeProject.name}`;
        const deleteButton = document.getElementById('projectDelete');
        const cannotDeleteLastProject = getActiveProjects().length <= 1;
        deleteButton.disabled = cannotDeleteLastProject;
        deleteButton.setAttribute('aria-label', `Delete ${activeProject.name}`);
        deleteButton.title = cannotDeleteLastProject
          ? 'At least one project must remain'
          : `Delete ${activeProject.name}`;
        renderProjectList();
      };

      // Sidebar → Projects
      const renderProjectList = () => {
        const projectList = document.getElementById('projectList');
        projectList.replaceChildren();
        getActiveProjects().forEach((project) => {
          const isActive = project === activeProject;
          const li = document.createElement('li');
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `sidebar-item${isActive ? ' active' : ''}`;
          button.setAttribute('aria-current', isActive ? 'true' : 'false');
          button.title = project.name;
          button.dataset.projectId = project.id;
          const dot = document.createElement('span');
          dot.className = 'sidebar-item-dot';
          dot.setAttribute('aria-hidden', 'true');
          dot.textContent = project.name.trim().charAt(0).toUpperCase() || 'P';
          const copy = document.createElement('span');
          copy.className = 'sidebar-item-copy nav-label';
          const name = document.createElement('span');
          name.className = 'sidebar-item-title';
          name.textContent = project.name;
          const meta = document.createElement('span');
          meta.className = 'sidebar-item-meta';
          const layoutTotal = project.layouts.length;
          const deviceTotal = project.layouts.reduce((sum, layout) => sum + (markersByLayout.get(layout.id) || []).length, 0);
          meta.textContent = `${layoutTotal} ${layoutTotal === 1 ? 'layout' : 'layouts'} · ${deviceTotal} ${deviceTotal === 1 ? 'device' : 'devices'}`;
          copy.append(name, meta);
          button.append(dot, copy);
          button.addEventListener('click', () => {
            selectProject(project.id);
            if (sidebarIsDrawer()) setSidebarOpen(false);
          });
          li.append(button);
          projectList.append(li);
        });
        renderPresenceAvatars(latestPresenceRows);
      };

      const selectProject = (projectId) => {
        const project = projects.find((item) => item.id === projectId && !item.deleted);
        if (!project || project === activeProject) return;
        closeMarkerEditor();
        activeProject = project;
        layouts = activeProject.layouts;
        selectedIndex = 0;
        try {
          localStorage.setItem(activeProjectStorageKey, project.id);
        } catch (error) {
          console.error('Unable to remember the active project:', error);
          announce('Project opened, but the selected project could not be remembered.', true);
        }
        resetView();
        updateProjectControls();
        updateSelectedLayout();
        updatePresenceLocation();
      };

      const updateTransform = () => {
        stage.style.setProperty('--zoom', zoom);
        stage.style.setProperty('--pan-x', `${panX}px`);
        stage.style.setProperty('--pan-y', `${panY}px`);
        document.getElementById('zoomLevel').textContent = `${Math.round(zoom * 100)}%`;
        stage.classList.toggle('can-pan', zoom > 1);
      };

      const resetView = () => {
        zoom = 1;
        panX = 0;
        panY = 0;
        updateTransform();
      };

      const getCurrentMarkers = () => {
        const layoutId = layouts[selectedIndex].id;
        if (!markersByLayout.has(layoutId)) markersByLayout.set(layoutId, []);
        return markersByLayout.get(layoutId);
      };

      const restoreMarkers = () => {
        try {
          const savedMarkers = JSON.parse(
            localStorage.getItem(markerStorageKey) ||
            localStorage.getItem(legacyMarkerStorageKey) ||
            '{}'
          );
          if (!savedMarkers || typeof savedMarkers !== 'object' || Array.isArray(savedMarkers)) {
            throw new Error('Saved marker data has an invalid format.');
          }
          Object.entries(savedMarkers).forEach(([layoutId, markers]) => {
            if (!Array.isArray(markers)) throw new Error(`Saved markers for ${layoutId} have an invalid format.`);
            markers.forEach((marker) => {
              if (!Array.isArray(marker.photos)) {
                marker.photos = marker.photoId
                  ? [{ id: marker.photoId, name: marker.photoName || 'Saved image' }]
                  : [];
              }
            });
            markersByLayout.set(layoutId, markers);
          });
        } catch (error) {
          console.error('Unable to restore saved markers:', error);
          announce('Saved markers could not be restored.', true);
        }
      };

      const persistMarkers = () => {
        try {
          localStorage.setItem(markerStorageKey, JSON.stringify(Object.fromEntries(markersByLayout)));
          return true;
        } catch (error) {
          console.error('Unable to save markers:', error);
          return false;
        }
      };

      const cloudMarkerData = (marker) => ({
        ...(marker.markerType ? { markerType: marker.markerType } : {}),
        id: marker.id,
        x: marker.x,
        y: marker.y,
        deviceId: marker.deviceId || '',
        deviceType: marker.deviceType || '',
        floorLevel: marker.floorLevel || '',
        product: marker.product || '',
        location: marker.location || '',
        serviceDate: marker.serviceDate || '',
        manufacturingDate: marker.manufacturingDate || '',
        photos: (Array.isArray(marker.photos) ? marker.photos : []).map((photo) => ({
          id: photo.id,
          name: photo.name || 'Marker image',
          path: photo.path || null
        }))
      });

      const getMarkerPhotoPath = (photoId) => `${markerCloudSiteId}/${photoId}`;
      const getMarkerPhotoPublicUrl = (path) =>
        `${getMarkerCloudRestUrl().replace('/rest/v1', '')}/storage/v1/object/public/parkview-marker-photos/${encodeStoragePath(path)}`;

      const uploadCloudMarkerPhoto = async (photoId, file) => {
        const path = getMarkerPhotoPath(photoId);
        const response = await supabaseFetch(
          `${getMarkerCloudRestUrl().replace('/rest/v1', '')}/storage/v1/object/parkview-marker-photos/${encodeStoragePath(path)}`,
          {
            method: 'POST',
            headers: {
              apikey: markerCloudConfig.anonKey,
              'Content-Type': file.type || 'application/octet-stream',
              'x-upsert': 'true'
            },
            body: file
          }
        );
        if (!response.ok) throw new Error(`Supabase marker photo upload failed (${response.status}).`);
        return path;
      };

      const deleteCloudMarkerPhoto = async (photo) => {
        if (!photo.path) return;
        const response = await supabaseFetch(
          `${getMarkerCloudRestUrl().replace('/rest/v1', '')}/storage/v1/object/parkview-marker-photos/${encodeStoragePath(photo.path)}`,
          {
            method: 'DELETE',
            headers: { apikey: markerCloudConfig.anonKey }
          }
        );
        if (!response.ok && response.status !== 404) {
          throw new Error(`Supabase marker photo delete failed (${response.status}).`);
        }
      };

      const migrateLocalMarkerPhotos = async (marker) => {
        const photos = Array.isArray(marker.photos) ? marker.photos : [];
        for (const photo of photos) {
          if (photo.path) continue;
          try {
            await openDatabase();
            const savedPhoto = await getMarkerPhoto(photo.id);
            if (savedPhoto && savedPhoto.blob) {
              photo.path = await uploadCloudMarkerPhoto(photo.id, savedPhoto.blob);
              markerPhotoMigrationOccurred = true;
            }
          } catch (error) {
            console.error('Unable to migrate a local marker photo to shared storage:', error);
          }
        }
        marker.photos = photos;
        return marker;
      };

      const markerRowsFromMap = (markersMap) => Array.from(markersMap, ([layoutId, markers]) =>
        markers.map((marker) => ({
          site_id: markerCloudSiteId,
          layout_id: layoutId,
          marker_id: marker.id,
          marker: cloudMarkerData(marker)
        }))
      ).flat();

      const cloneCloudBaseline = (markersMap) => new Map(
        Array.from(markersMap, ([layoutId, markers]) => [
          layoutId,
          markers.map(cloudMarkerData)
        ])
      );

      const cloudMarkerSnapshotsMatch = (left, right) => {
        const snapshot = (markersMap) => markerRowsFromMap(markersMap)
          .map(({ layout_id, marker_id, marker }) => ({ layout_id, marker_id, marker }))
          .sort((a, b) => `${a.layout_id}:${a.marker_id}`.localeCompare(`${b.layout_id}:${b.marker_id}`));
        return JSON.stringify(snapshot(left)) === JSON.stringify(snapshot(right));
      };

      const fetchCloudMarkerRows = async () => {
        if (!markerCloudConfig || !markerCloudConfig.restUrl || !markerCloudConfig.anonKey) {
          throw new Error('Supabase marker sync is not configured.');
        }
        const response = await supabaseFetch(
          `${getMarkerCloudRestUrl()}/parkview_markers?site_id=eq.${encodeURIComponent(markerCloudSiteId)}&select=site_id,layout_id,marker_id,marker`,
          {
            headers: { apikey: markerCloudConfig.anonKey }
          }
        );
        if (!response.ok) throw new Error(`Supabase marker load failed (${response.status}).`);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('Saved cloud markers have an invalid format.');
        return rows;
      };

      const fetchCloudSiteInitialized = async () => {
        const query = new URLSearchParams({
          site_id: `eq.${markerCloudSiteId}`,
          select: 'site_id'
        });
        const response = await supabaseFetch(`${getMarkerCloudRestUrl()}/parkview_marker_sites?${query}`, {
          headers: { apikey: markerCloudConfig.anonKey }
        });
        if (!response.ok) throw new Error(`Supabase marker sync status failed (${response.status}).`);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('Saved cloud marker status has an invalid format.');
        return rows.length > 0;
      };

      const markCloudSiteInitialized = async () => {
        const response = await supabaseFetch(`${getMarkerCloudRestUrl()}/parkview_marker_sites?on_conflict=site_id`, {
          method: 'POST',
          headers: {
            apikey: markerCloudConfig.anonKey,
            'Content-Type': 'application/json',
            Prefer: 'resolution=ignore-duplicates,return=minimal'
          },
          body: JSON.stringify({ site_id: markerCloudSiteId })
        });
        if (!response.ok) throw new Error(`Supabase marker sync status save failed (${response.status}).`);
      };

      const fetchLegacyCloudMarkers = async () => {
        const response = await supabaseFetch(
          `${getMarkerCloudRestUrl()}/parkview_marker_state?project_id=eq.parkview-dashboard&select=markers`,
          { headers: { apikey: markerCloudConfig.anonKey } }
        );
        if (!response.ok) throw new Error(`Legacy marker migration failed (${response.status}).`);
        const rows = await response.json();
        if (!Array.isArray(rows) || !rows.length) return null;
        const legacyMarkers = rows[0].markers;
        if (!legacyMarkers || typeof legacyMarkers !== 'object' || Array.isArray(legacyMarkers)) {
          throw new Error('Legacy cloud markers have an invalid format.');
        }
        return legacyMarkers;
      };

      const upsertCloudMarker = async (row) => {
        const response = await supabaseFetch(
          `${getMarkerCloudRestUrl()}/parkview_markers?on_conflict=site_id,layout_id,marker_id`,
          {
            method: 'POST',
            headers: {
              apikey: markerCloudConfig.anonKey,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(row)
          }
        );
        if (!response.ok) throw new Error(`Supabase marker save failed (${response.status}).`);
      };

      const deleteCloudMarker = async (layoutId, markerId) => {
        const query = new URLSearchParams({
          site_id: `eq.${markerCloudSiteId}`,
          layout_id: `eq.${layoutId}`,
          marker_id: `eq.${markerId}`
        });
        const response = await supabaseFetch(`${getMarkerCloudRestUrl()}/parkview_markers?${query}`, {
          method: 'DELETE',
          headers: { apikey: markerCloudConfig.anonKey }
        });
        if (!response.ok) throw new Error(`Supabase marker delete failed (${response.status}).`);
      };

      const fetchCloudMarkersForLayout = async (layoutId) => {
        const query = new URLSearchParams({
          site_id: `eq.${markerCloudSiteId}`,
          layout_id: `eq.${layoutId}`,
          select: 'marker_id,marker'
        });
        const response = await supabaseFetch(`${getMarkerCloudRestUrl()}/parkview_markers?${query}`, {
          headers: { apikey: markerCloudConfig.anonKey }
        });
        if (!response.ok) throw new Error(`Could not load markers for layout ${layoutId} (${response.status}).`);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error(`Cloud markers for layout ${layoutId} have an invalid format.`);
        return rows;
      };

      const saveCloudMarkerChanges = async () => {
        const currentRows = markerRowsFromMap(markersByLayout);
        const currentByKey = new Map(currentRows.map((row) => [
          `${row.layout_id}\u0000${row.marker_id}`,
          row
        ]));
        const baselineRows = markerRowsFromMap(markerCloudBaseline);
        const baselineByKey = new Map(baselineRows.map((row) => [
          `${row.layout_id}\u0000${row.marker_id}`,
          row
        ]));

        for (const [key, row] of baselineByKey) {
          if (!currentByKey.has(key)) await deleteCloudMarker(row.layout_id, row.marker_id);
        }
        for (const [key, row] of currentByKey) {
          const previous = baselineByKey.get(key);
          if (!previous || JSON.stringify(previous.marker) !== JSON.stringify(row.marker)) {
            await upsertCloudMarker(row);
          }
        }
        await markCloudSiteInitialized();
        markerCloudBaseline = cloneCloudBaseline(markersByLayout);
      };

      const syncMarkersFromCloud = async () => {
        if (markerCloudDirty) {
          await saveCloudMarkerChanges();
          markerCloudDirty = false;
        }
        const [rows, siteInitialized] = await Promise.all([
          fetchCloudMarkerRows(),
          fetchCloudSiteInitialized()
        ]);
        const localMarkers = new Map(markersByLayout);
        if (!rows.length && !siteInitialized) {
          let initialMarkers = Object.fromEntries(localMarkers);
          let foundLegacyState = false;
          if (markerCloudSiteId === 'parkviewdashboard') {
            const legacyMarkers = await fetchLegacyCloudMarkers();
            if (legacyMarkers) {
              initialMarkers = legacyMarkers;
              foundLegacyState = true;
            }
          }
          const initialMap = new Map();
          for (const [layoutId, markers] of Object.entries(initialMarkers)) {
            if (!Array.isArray(markers)) throw new Error(`Cloud markers for ${layoutId} have an invalid format.`);
            initialMap.set(layoutId, await Promise.all(markers.map(async (marker) => {
              if (!marker || typeof marker.id !== 'string') throw new Error(`A cloud marker for ${layoutId} is invalid.`);
              const localMarker = (localMarkers.get(layoutId) || []).find((item) => item.id === marker.id);
              return await migrateLocalMarkerPhotos({
                ...marker,
                photos: localMarker ? localMarker.photos || [] : []
              });
            })));
          }
          if (!cloudMarkerSnapshotsMatch(markersByLayout, initialMap)) {
            markersByLayout.clear();
            initialMap.forEach((markers, layoutId) => markersByLayout.set(layoutId, markers));
            persistMarkers();
            renderMarkers();
          }
          markerCloudBaseline = new Map();
          if (markerRowsFromMap(initialMap).length || foundLegacyState) {
            markersByLayout.clear();
            initialMap.forEach((markers, layoutId) => markersByLayout.set(layoutId, markers));
            await saveCloudMarkerChanges();
            markerPhotoMigrationOccurred = false;
          }
        } else {
          const remoteMarkers = new Map();
          for (const row of rows) {
            if (typeof row.layout_id !== 'string' || typeof row.marker_id !== 'string' ||
              !row.marker || typeof row.marker !== 'object' || Array.isArray(row.marker) ||
              row.marker.id !== row.marker_id) {
              throw new Error('A saved cloud marker has an invalid format.');
            }
            if (!remoteMarkers.has(row.layout_id)) remoteMarkers.set(row.layout_id, []);
            const localMarker = (localMarkers.get(row.layout_id) || []).find((item) => item.id === row.marker_id);
            const marker = {
              ...row.marker,
              photos: Array.isArray(row.marker.photos)
                ? row.marker.photos
                : localMarker ? localMarker.photos || [] : []
            };
            remoteMarkers.get(row.layout_id).push(await migrateLocalMarkerPhotos(marker));
          }
          if (!cloudMarkerSnapshotsMatch(markersByLayout, remoteMarkers)) {
            markersByLayout.clear();
            remoteMarkers.forEach((markers, layoutId) => markersByLayout.set(layoutId, markers));
            persistMarkers();
            renderMarkers();
          }
          markerCloudBaseline = cloneCloudBaseline(remoteMarkers);
          if (markerPhotoMigrationOccurred) {
            markerCloudBaseline = new Map();
            await saveCloudMarkerChanges();
            markerPhotoMigrationOccurred = false;
          }
          if (rows.length && !siteInitialized) await markCloudSiteInitialized();
        }
        markerCloudInitialized = true;
      };

      const persistMarkersEverywhere = async () => {
        const localSaved = persistMarkers();
        if (!localSaved) return { localSaved: false, cloudSaved: false };
        markerSaveInProgress = true;
        try {
          await saveCloudMarkerChanges();
          markerCloudDirty = false;
          return { localSaved: true, cloudSaved: true };
        } catch (error) {
          console.error('Unable to sync markers to Supabase:', error);
          markerCloudDirty = true;
          return { localSaved: true, cloudSaved: false };
        } finally {
          markerSaveInProgress = false;
        }
      };

      const refreshSharedMarkers = async () => {
        if (markerSyncInProgress || markerSaveInProgress || !markerEditor.hidden) return;
        markerSyncInProgress = true;
        try {
          await syncMarkersFromCloud();
          markerSyncErrorAnnounced = false;
          lastCloudSyncAt = Date.now();
          lastCloudSyncFailed = false;
          markerSyncInProgress = false;
          await migrateLegacyMarkerTypes();
        } catch (error) {
          console.error('Unable to sync shared markers:', error);
          lastCloudSyncFailed = true;
          if (!markerCloudInitialized && !markerSyncErrorAnnounced) {
            announce('Could not sync shared markers. Showing markers saved on this device.', true);
            markerSyncErrorAnnounced = true;
          }
        } finally {
          markerSyncInProgress = false;
        }
      };

      const getImageBounds = () => {
        if (!image.naturalWidth || !image.naturalHeight) return null;
        const stageWidth = stage.clientWidth;
        const stageHeight = stage.clientHeight;
        const scale = Math.min(stageWidth / image.naturalWidth, stageHeight / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        return {
          left: (stageWidth - width) / 2,
          top: (stageHeight - height) / 2,
          width,
          height
        };
      };

      // =====================================================================
      // Marker types — each device type has its own shape, colour and code.
      // Change names / codes here; the shapes are drawn in markerSvgMarkup().
      // =====================================================================
      const MARKER_TYPES = {
        fx: { code: 'FX', label: 'Fire Extinguisher', shape: 'Extinguisher' },
        ex: { code: 'EX', label: 'Exit Sign', shape: 'Exit sign' },
        smd: { code: 'EMD', label: 'Emergency Detector Light', shape: 'Detector' }, // key stays 'smd' (saved data)
        emt: { code: 'EMT', label: 'Emergency Train Light', shape: 'Twin lamp' }
      };
      const MARKER_TYPE_ORDER = ['fx', 'ex', 'smd', 'emt'];
      const lastMarkerTypeKey = 'mquest-parkview-last-marker-type';

      // Older markers have no type yet: work it out from their "Device Type" text.
      const inferMarkerType = (text) => {
        const t = String(text || '').toLowerCase();
        if (/extinguish|\bfx\b/.test(t)) return 'fx';
        if (/\bexit\b|\bex\b/.test(t)) return 'ex';
        if (/detector|smoke|\bsmd\b|\bemd\b/.test(t)) return 'smd';
        if (/\bemt\b|emergency|train light|twin/.test(t)) return 'emt';
        return '';
      };
      const markerTypeOf = (marker) => {
        if (!marker) return '';
        if (MARKER_TYPES[marker.markerType]) return marker.markerType;
        if (marker.markerType === 'pin') return ''; // "Other" was chosen on purpose
        // Markers from before types existed were fire extinguishers.
        return inferMarkerType(marker.deviceType) || 'fx';
      };

      // Save a type on markers created before types existed (editors / owners, once).
      let legacyTypeMigrationDone = false;
      const migrateLegacyMarkerTypes = async () => {
        if (legacyTypeMigrationDone || !isWorkspaceEditor() || !markerCloudInitialized) return;
        legacyTypeMigrationDone = true;
        let changed = 0;
        markersByLayout.forEach((markers) => markers.forEach((marker) => {
          if (MARKER_TYPES[marker.markerType] || marker.markerType === 'pin') return;
          marker.markerType = markerTypeOf(marker);
          changed += 1;
        }));
        if (!changed) return;
        const result = await persistMarkersEverywhere();
        if (result.cloudSaved) {
          renderMarkers();
          announce(`Updated ${changed} older ${changed === 1 ? 'marker' : 'markers'} to the new marker icons.`);
        } else {
          legacyTypeMigrationDone = false; // try again on the next sync
        }
      };

      // Device ID text that always fits the space it is given.
      const markerIdText = (id, x, y, maxWidth, baseSize) => {
        if (!id) return '';
        const size = id.length <= 2 ? baseSize * 1.12 : id.length === 3 ? baseSize : baseSize * 0.92;
        const natural = id.length * size * 0.6;
        const fit = natural > maxWidth || id.length >= 5
          ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : '';
        return `<text class="mk-id" x="${x}" y="${y}" font-size="${size.toFixed(1)}" text-anchor="middle" dominant-baseline="central"${fit}>${escapeHtml(id)}</text>`;
      };
      const markerCodeText = (code, x, y, size, maxWidth) =>
        `<text class="mk-code" x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central"${code.length >= 3 ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : ''}>${code}</text>`;

      // SVG for a marker. mini = small icon (code only) for buttons and legends.
      const markerSvgMarkup = (type, deviceId = '', { mini = false } = {}) => {
        const id = mini ? '' : String(deviceId || '').trim();
        const svg = (viewBox, body) =>
          `<svg class="map-marker-pin mk-svg mk-${type || 'pin'}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;
        switch (type) {
          case 'fx': // fire extinguisher: valve, handle, nozzle, body with label
            return svg('0 0 48 68', `
              <path class="mk-ink-line" d="M18 8.5H11.5L7 13"/>
              <path class="mk-ink-line" d="M23 5.5H35.5L41 2.5"/>
              <rect class="mk-ink" x="17.5" y="4" width="13" height="10" rx="2.5"/>
              <rect class="mk-fill mk-outline" x="6" y="12" width="36" height="54" rx="12"/>
              <rect class="mk-shine" x="9.5" y="17" width="3.2" height="42" rx="1.6"/>
              <rect class="mk-label" x="11" y="21" width="26" height="36" rx="6"/>
              ${id ? markerCodeText('FX', 24, 30.5, 11, 18) + markerIdText(id, 24, 46.5, 22, 10.5)
                   : markerCodeText('FX', 24, 39, 13, 20)}`);
          case 'smd': // round ceiling detector with vent ring and pointer
            return svg('0 0 48 60', `
              <path class="mk-fill mk-outline" d="M15.5 41 24 58.5 32.5 41Z"/>
              <circle class="mk-fill mk-outline" cx="24" cy="24" r="22"/>
              <circle class="mk-vents" cx="24" cy="24" r="19.3"/>
              <circle class="mk-label" cx="24" cy="24" r="15.8"/>
              ${id ? markerCodeText('EMD', 24, 18.4, 8.4, 17) + markerIdText(id, 24, 29.8, 25, 10.5)
                   : markerCodeText('EMD', 24, 24.5, 10.5, 22)}`);
          case 'emt': // twin-lamp emergency light
            return svg('0 0 52 62', `
              <circle class="mk-fill mk-outline" cx="13" cy="12" r="9.5"/>
              <circle class="mk-fill mk-outline" cx="39" cy="12" r="9.5"/>
              <circle class="mk-lens" cx="13" cy="11" r="5"/>
              <circle class="mk-lens" cx="39" cy="11" r="5"/>
              <path class="mk-fill mk-outline" d="M19 50 26 61 33 50Z"/>
              <rect class="mk-fill mk-outline" x="3" y="16" width="46" height="36" rx="9"/>
              <rect class="mk-label" x="8" y="21" width="36" height="26" rx="5.5"/>
              ${id ? markerCodeText('EMT', 26, 29.3, 8.8, 19) + markerIdText(id, 26, 40.2, 30, 10.5)
                   : markerCodeText('EMT', 26, 34.5, 11, 25)}`);
          case 'ex': // exit sign board with door and arrow
            return svg('0 0 64 50', `
              <path class="mk-fill mk-outline" d="M26.5 36 32 48.5 37.5 36Z"/>
              <rect class="mk-fill mk-outline" x="2" y="2" width="60" height="36" rx="7"/>
              <rect class="mk-frame" x="5.5" y="5.5" width="53" height="29" rx="4.5"/>
              <rect class="mk-door" x="9.5" y="11.5" width="8" height="17" rx="1.2"/>
              <circle class="mk-knob" cx="15.6" cy="20.5" r="1.1"/>
              <path class="mk-arrow" d="M46.5 14.5 52.5 20 46.5 25.5M41 20H52"/>
              ${id ? markerCodeText('EX', 29.5, 14.5, 11, 16) + markerIdText(id, 29.5, 27.6, 22, 10)
                   : markerCodeText('EX', 29.5, 20.5, 13.5, 18)}`);
          default: { // classic location pin
            const pinId = id ? (() => {
              const sizes = [17, 17, 15, 12.5, 10.5];
              const fit = id.length >= 4 ? ` textLength="${id.length === 4 ? 26 : 28}" lengthAdjust="spacingAndGlyphs"` : '';
              return `<text class="map-marker-label" x="24" y="23.6" font-size="${sizes[id.length] || 10.5}" text-anchor="middle" dominant-baseline="central"${fit}>${escapeHtml(id)}</text>`;
            })() : `<circle class="map-marker-dot" cx="24" cy="23" r="5"/>`;
            return svg('0 0 48 60', `
              <path class="map-marker-body" d="M24 1.5C12 1.5 2.5 11 2.5 23c0 14.6 18.4 31.9 20.4 33.7a1.6 1.6 0 0 0 2.2 0C27.1 54.9 45.5 37.6 45.5 23 45.5 11 36 1.5 24 1.5Z"/>
              <circle class="map-marker-core" cx="24" cy="23" r="16.5"/>
              ${pinId}`);
          }
        }
      };
      // Small coloured icon (used in buttons, the legend and lists).
      const markerTypeIcon = (type) =>
        `<span class="mk-swatch type-${type || 'pin'}" aria-hidden="true">${markerSvgMarkup(type, '', { mini: true })}</span>`;

      // Types hidden from the plan using the legend.
      const hiddenMarkerTypes = new Set();

      // Legend on the plan: one chip per type on this layout, tap to hide/show.
      const renderMarkerLegend = () => {
        const legend = document.getElementById('markerLegend');
        const markers = layouts.length ? getCurrentMarkers() : [];
        const counts = new Map();
        markers.forEach((marker) => {
          const type = markerTypeOf(marker) || 'pin';
          counts.set(type, (counts.get(type) || 0) + 1);
        });
        legend.replaceChildren();
        legend.hidden = counts.size === 0;
        [...MARKER_TYPE_ORDER, 'pin'].forEach((type) => {
          if (!counts.has(type)) return;
          const definition = MARKER_TYPES[type] || { code: 'PIN', label: 'Other markers' };
          const visible = !hiddenMarkerTypes.has(type);
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = `legend-chip type-${type}${visible ? '' : ' is-off'}`;
          chip.setAttribute('aria-pressed', String(visible));
          chip.title = `${visible ? 'Hide' : 'Show'} ${definition.label.toLowerCase()} markers`;
          chip.innerHTML = `${markerTypeIcon(type === 'pin' ? '' : type)}<span class="legend-code">${definition.code}</span><span class="legend-count">${counts.get(type)}</span>`;
          chip.addEventListener('click', (event) => {
            event.stopPropagation();
            if (hiddenMarkerTypes.has(type)) hiddenMarkerTypes.delete(type);
            else hiddenMarkerTypes.add(type);
            renderMarkers();
          });
          legend.append(chip);
        });
      };

      // ---- Marker type picker (Add / Edit marker form) ----------------------
      let selectedMarkerType = '';
      const markerEditorIcon = document.querySelector('.marker-editor-icon');
      const defaultEditorIconMarkup = markerEditorIcon ? markerEditorIcon.innerHTML : '';
      const setEditorHeaderIcon = (type) => {
        if (!markerEditorIcon) return;
        markerEditorIcon.className = `marker-editor-icon${type ? ` has-type type-${type}` : ''}`;
        markerEditorIcon.innerHTML = type ? markerSvgMarkup(type, '', { mini: true }) : defaultEditorIconMarkup;
      };

      // Built once; selecting a type only updates the buttons (keeps keyboard focus).
      const renderMarkerTypePicker = () => {
        const box = document.getElementById('markerTypeOptions');
        if (box.children.length) {
          box.querySelectorAll('.marker-type-option').forEach((option) => {
            const selected = option.dataset.type === selectedMarkerType;
            option.classList.toggle('is-selected', selected);
            option.setAttribute('aria-checked', String(selected));
            option.tabIndex = selected ? 0 : -1;
          });
          return;
        }
        [...MARKER_TYPE_ORDER, ''].forEach((type) => {
          const definition = MARKER_TYPES[type] || { code: 'PIN', label: 'Other device' };
          const selected = selectedMarkerType === type;
          const option = document.createElement('button');
          option.type = 'button';
          option.className = `marker-type-option type-${type || 'pin'}${selected ? ' is-selected' : ''}`;
          option.setAttribute('role', 'radio');
          option.setAttribute('aria-checked', String(selected));
          option.tabIndex = selected ? 0 : -1;
          option.dataset.type = type;
          option.title = definition.label;
          option.innerHTML = `${markerTypeIcon(type)}<span class="marker-type-text"><strong>${definition.code}</strong><small>${escapeHtml(definition.label)}</small></span>`;
          option.addEventListener('click', () => setSelectedMarkerType(type, true));
          option.addEventListener('keydown', (event) => {
            const order = [...MARKER_TYPE_ORDER, ''];
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
            if (!step) return;
            event.preventDefault();
            event.stopPropagation(); // don't let ← / → switch layouts
            const next = order[(order.indexOf(type) + step + order.length) % order.length];
            setSelectedMarkerType(next, true);
            box.querySelector(`[data-type="${next}"]`)?.focus();
          });
          box.append(option);
        });
      };

      const setSelectedMarkerType = (type, fromUser = false) => {
        const previous = selectedMarkerType;
        selectedMarkerType = MARKER_TYPES[type] ? type : '';
        if (fromUser) {
          // Fill in "Device Type" for you when it is empty or still the previous type's name.
          const input = document.getElementById('markerDeviceType');
          const current = input.value.trim();
          const previousLabel = MARKER_TYPES[previous] ? MARKER_TYPES[previous].label : '';
          if (MARKER_TYPES[selectedMarkerType] && (!current || current === previousLabel)) {
            input.value = MARKER_TYPES[selectedMarkerType].label;
          } else if (!MARKER_TYPES[selectedMarkerType] && previousLabel && current === previousLabel) {
            input.value = '';
          }
          try { localStorage.setItem(lastMarkerTypeKey, selectedMarkerType || 'pin'); } catch (error) { /* ignore */ }
        }
        renderMarkerTypePicker();
        setEditorHeaderIcon(selectedMarkerType);
      };

      // Records a change in the shared activity log (editors / owners only).
      const logActivity = (action, summary, { project = activeProject, layout = null, marker = null } = {}) => {
        if (!isWorkspaceEditor()) return;
        supabaseFetch(`${getMarkerCloudRestUrl()}/parkview_activity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            site_id: markerCloudSiteId,
            user_id: '',
            user_name: '',
            action,
            project_id: project ? project.id : null,
            project_name: project ? project.name : null,
            layout_id: layout ? layout.id : null,
            layout_name: layout ? layout.name : null,
            marker_id: marker ? marker.id : null,
            device_id: marker && marker.deviceId ? String(marker.deviceId) : null,
            summary
          })
        }).then((response) => {
          if (!response.ok) console.warn(`Activity was not recorded (${response.status}). Run the latest supabase.sql.`);
        }).catch((error) => console.warn('Activity was not recorded:', error.message));
      };
      const describeDevice = (marker) => {
        const id = marker && marker.deviceId ? `device ${marker.deviceId}` : 'a device';
        return marker && marker.product ? `${id} (${marker.product})` : id;
      };

      // Expanding ring at a marker's tip — the "ping" when it is tapped.
      const spawnMarkerRipple = (pin) => {
        const ripple = document.createElement('span');
        ripple.className = 'marker-ripple';
        ripple.style.left = pin.style.left;
        ripple.style.top = pin.style.top;
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
        markerLayer.append(ripple);
        setTimeout(() => ripple.remove(), 1200);
      };

const renderMarkers = () => {
    markerLayer.replaceChildren();
    renderMarkerLegend();

    if (!layouts.length) return;

    const bounds = getImageBounds();
    if (!bounds) return;

    getCurrentMarkers().forEach((marker) => {
        if (hiddenMarkerTypes.has(markerTypeOf(marker) || 'pin')) return;

        // Create marker button
        const pin = document.createElement('button');

        pin.type = 'button';
        pin.className = 'map-marker';
        pin.dataset.markerId = marker.id;

        // Selected marker when moving
        if (markerMoveMode) {
            const isSelected = marker.id === movingMarkerId;

            pin.classList.toggle('is-selected', isSelected);
            pin.setAttribute('aria-pressed', String(isSelected));
        }

        // Preserve original marker positioning
        pin.style.left = `${bounds.left + marker.x * bounds.width}px`;
        pin.style.top = `${bounds.top + marker.y * bounds.height}px`;

        // Marker accessibility and tooltip
        const markerName = marker.product || marker.location || 'Layout detail';

        pin.setAttribute(
            'aria-label',
            `Marker: ${markerName}${marker.deviceId ? `, device ID ${marker.deviceId}` : ''}`
        );

        pin.title = marker.product || marker.location || 'Layout marker';

        // Each device type has its own shape; the Device ID sits inside it,
        // scales with it and stays centred on every device.
        const markerType = markerTypeOf(marker);
        const deviceId = String(marker.deviceId ?? '').trim();
        pin.classList.add(`type-${markerType || 'pin'}`);
        if (markerType) {
          pin.classList.add('is-typed');
          pin.title = `${MARKER_TYPES[markerType].label}${deviceId ? ` ${deviceId}` : ''}${marker.product ? ` · ${marker.product}` : ''}`;
          pin.setAttribute('aria-label', `${MARKER_TYPES[markerType].label} marker${deviceId ? `, device ID ${deviceId}` : ''}${marker.product ? `, ${marker.product}` : ''}`);
        }
        pin.insertAdjacentHTML('beforeend', markerSvgMarkup(markerType, deviceId));

        if (!markerMoveMode && marker.id === editingMarkerId && !markerEditor.hidden) {
          pin.classList.add('is-active');
        }

        // Original marker click functionality
        pin.addEventListener('click', (event) => {

            event.stopPropagation();

            if (markerMoveMode) {

                movingMarkerId = marker.id;

                markerLayer.querySelectorAll('.map-marker').forEach((existingPin) => {

                    const isSelected = existingPin === pin;

                    existingPin.classList.toggle('is-selected', isSelected);

                    existingPin.setAttribute('aria-pressed', String(isSelected));

                });

                announce(`Selected ${markerName}. Click its new position on the layout.`);

                return;
            }

            const markerX = bounds.left + marker.x * bounds.width;
            const markerY = bounds.top + marker.y * bounds.height;

            const screenX =
                stage.clientWidth / 2 +
                (markerX - stage.clientWidth / 2) * zoom +
                panX;

            const screenY =
                stage.clientHeight / 2 +
                (markerY - stage.clientHeight / 2) * zoom +
                panY;

            setMarkerMode(false);

            markerLayer.querySelectorAll('.map-marker.is-active').forEach((other) => other.classList.remove('is-active'));
            pin.classList.remove('is-bouncing');
            void pin.offsetWidth; // restart the bounce animation
            pin.classList.add('is-active', 'is-bouncing');
            pin.addEventListener('animationend', () => pin.classList.remove('is-bouncing'), { once: true });
            spawnMarkerRipple(pin);

            showMarkerDetails(screenX, screenY, marker);

        });

        // Add marker to layout
        markerLayer.append(pin);

    });
    if (panelDataHook) panelDataHook();
};

      const setMarkerMode = (enabled) => {
        markerMode = enabled;
        markerToggle.setAttribute('aria-pressed', String(enabled));
        markerToggle.setAttribute('aria-label', enabled ? 'Cancel marker placement' : 'Place marker');
        markerToggle.title = enabled ? 'Cancel marker placement' : 'Place marker';
        stage.classList.toggle('marker-placement-mode', enabled);
      };

      const setMarkerMoveMode = (enabled) => {
        markerMoveMode = enabled;
        movingMarkerId = null;
        moveMarkerToggle.setAttribute('aria-pressed', String(enabled));
        moveMarkerToggle.setAttribute('aria-label', enabled ? 'Cancel marker move' : 'Move marker');
        moveMarkerToggle.title = enabled ? 'Cancel marker move' : 'Move marker';
        stage.classList.toggle('marker-move-mode', enabled);
        renderMarkers();
      };

      const setPhotoZoom = (nextZoom) => {
        photoZoom = Math.min(5, Math.max(1, nextZoom));
        photoViewerImage.style.transform = `scale(${photoZoom})`;
        document.getElementById('photoZoomLevel').textContent = `${Math.round(photoZoom * 100)}%`;
        photoViewerStage.classList.toggle('is-zoomed', photoZoom > 1);
      };

      const fitPhotoToStage = () => {
        if (!photoViewerImage.naturalWidth || !photoViewerImage.naturalHeight || photoViewer.hidden) return;
        const scale = Math.min(
          photoViewerStage.clientWidth / photoViewerImage.naturalWidth,
          photoViewerStage.clientHeight / photoViewerImage.naturalHeight,
          1
        );
        photoViewerImage.style.width = `${photoViewerImage.naturalWidth * scale}px`;
        photoViewerImage.style.height = `${photoViewerImage.naturalHeight * scale}px`;
      };

      const openPhotoViewer = (url) => {
        photoViewerReturnFocus = document.activeElement;
        document.getElementById('photoViewerTitle').textContent = 'Image preview';
        photoViewerImage.alt = 'Full-size marker image';
        photoViewerImage.onload = () => fitPhotoToStage();
        photoViewerImage.src = url;
        setPhotoZoom(1);
        photoViewer.hidden = false;
        fitPhotoToStage();
        document.getElementById('photoViewerClose').focus();
      };

      const closePhotoViewer = () => {
        if (photoViewer.hidden) return;
        photoViewer.hidden = true;
        photoViewerImage.onload = null;
        photoViewerImage.removeAttribute('src');
        if (photoViewerReturnFocus instanceof HTMLElement && photoViewerReturnFocus.isConnected) {
          photoViewerReturnFocus.focus();
        }
        photoViewerReturnFocus = null;
      };

      // ---- Marker popup animation helpers --------------------------------
      // The popup grows out of (and shrinks back into) the marker that opened it.
      let markerEditorCloseTimer = null;
      const MARKER_EDITOR_CLOSE_MS = 280;

      const positionMarkerEditor = (x, y) => {
        const left = Math.max(8, Math.min(x + 12, stage.clientWidth - markerEditor.offsetWidth - 8));
        const top = Math.max(8, Math.min(y + 12, stage.clientHeight - markerEditor.offsetHeight - 8));
        markerEditor.style.left = `${left}px`;
        markerEditor.style.top = `${top}px`;
        markerEditor.style.setProperty('--origin-x', `${x - left}px`);
        markerEditor.style.setProperty('--origin-y', `${y - top}px`);
      };

      const playMarkerEditorOpen = (wasOpen) => {
        clearTimeout(markerEditorCloseTimer);
        markerEditorCloseTimer = null;
        markerEditor.classList.remove('is-closing', 'is-opening', 'is-swapping');
        void markerEditor.offsetWidth; // restart CSS animations
        markerEditor.classList.add(wasOpen ? 'is-swapping' : 'is-opening');
      };

      const isMarkerEditorShowing = () => !markerEditor.hidden && !markerEditor.classList.contains('is-closing');

      // Keep the popup inside the stage when its content (e.g. photos) changes size.
      if ('ResizeObserver' in window) {
        new ResizeObserver(() => {
          if (markerPanelPoint && isMarkerEditorShowing()) positionMarkerEditor(markerPanelPoint.x, markerPanelPoint.y);
        }).observe(markerEditor);
      }

      const clearMarkerEditorContent = () => {
        markerPhotoGallery.replaceChildren();
        document.getElementById('markerDetailsGrid').replaceChildren();
        document.getElementById('markerDetailsPhotos').replaceChildren();
      };

      const closeMarkerEditor = () => {
        photoLoadToken += 1;
        closePhotoViewer();
        pendingMarkerPhotos.forEach((photo) => {
          if (sessionMarkerPhotos.get(photo.id) !== photo.url) URL.revokeObjectURL(photo.url);
        });
        editingMarkerId = null;
        markerPanelPoint = null;
        draftMarkerPoint = null;
        pendingMarkerPhotos = [];
        removedMarkerPhotoIds = new Set();
        markerPhotoInput.value = '';
        markerLayer.querySelectorAll('.map-marker.is-active').forEach((pin) => pin.classList.remove('is-active'));
        setMarkerMode(false);

        if (markerEditor.hidden || markerEditor.classList.contains('is-closing')) {
          if (markerEditor.hidden) clearMarkerEditorContent();
          return;
        }
        // Shrink the popup to zero, then actually hide it.
        markerEditor.classList.remove('is-opening', 'is-swapping');
        markerEditor.classList.add('is-closing');
        markerEditorCloseTimer = setTimeout(() => {
          markerEditorCloseTimer = null;
          markerEditor.classList.remove('is-closing');
          markerEditor.hidden = true;
          clearMarkerEditorContent();
        }, MARKER_EDITOR_CLOSE_MS);
      };

      const createPhotoCard = (photo, url, isPending = false, canRemove = true) => {
        const card = document.createElement('div');
        card.className = `marker-photo-card${isPending ? ' marker-photo-pending' : ''}`;
        const preview = document.createElement('img');
        preview.src = url;
        preview.alt = '';
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'marker-photo-open';
        open.setAttribute('aria-label', 'View image');
        open.append(preview);
        open.addEventListener('click', () => openPhotoViewer(url));
        if (!canRemove) {
          card.append(open);
          return card;
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'marker-photo-remove';
        remove.setAttribute('aria-label', 'Remove image');
        remove.title = 'Remove image';
        remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 14h11l1-14M9 7V4h6v3"/></svg>';
        remove.addEventListener('click', () => {
          if (photoViewerReturnFocus === remove) closePhotoViewer();
          if (isPending) {
            const index = pendingMarkerPhotos.findIndex((item) => item.id === photo.id);
            if (index !== -1) {
              URL.revokeObjectURL(pendingMarkerPhotos[index].url);
              pendingMarkerPhotos.splice(index, 1);
            }
          } else {
            removedMarkerPhotoIds.add(photo.id);
          }
          renderMarkerPhotos(editingMarkerId ? getCurrentMarkers().find((item) => item.id === editingMarkerId) : null);
        });
        card.append(open, remove);
        return card;
      };

      const renderMarkerPhotos = (marker, gallery = markerPhotoGallery, canRemove = true, includePending = true) => {
        gallery.replaceChildren();
        const currentPhotoLoad = photoLoadToken;
        if (!marker) {
          if (includePending) pendingMarkerPhotos.forEach((photo) => gallery.append(createPhotoCard(photo, photo.url, true, canRemove)));
          return;
        }

        const photos = Array.isArray(marker.photos)
          ? marker.photos
          : marker.photoId ? [{ id: marker.photoId, name: marker.photoName || 'Saved image' }] : [];
        if (!photos.length && gallery === document.getElementById('markerDetailsPhotos')) {
          const emptyMessage = document.createElement('p');
          emptyMessage.className = 'marker-details-empty';
          emptyMessage.textContent = 'No images attached.';
          gallery.append(emptyMessage);
        }
        photos.filter((photo) => !removedMarkerPhotoIds.has(photo.id)).forEach((photo) => {
          const cachedUrl = sessionMarkerPhotos.get(photo.id);
          if (cachedUrl) {
            gallery.append(createPhotoCard(photo, cachedUrl, false, canRemove));
            return;
          }
          if (photo.path) {
            gallery.append(createPhotoCard(photo, getMarkerPhotoPublicUrl(photo.path), false, canRemove));
            return;
          }
          const placeholder = document.createElement('div');
          placeholder.className = 'marker-photo-card marker-photo-loading';
          placeholder.textContent = 'Loading image…';
          gallery.append(placeholder);
          openDatabase()
            .then(() => getMarkerPhoto(photo.id))
            .then((savedPhoto) => {
              if (currentPhotoLoad !== photoLoadToken || markerEditor.hidden || editingMarkerId !== marker.id) return;
              if (!savedPhoto || !savedPhoto.blob) throw new Error(`Could not find ${photo.name || 'a saved marker image'}.`);
              const url = URL.createObjectURL(savedPhoto.blob);
              sessionMarkerPhotos.set(photo.id, url);
              placeholder.replaceWith(createPhotoCard(photo, url, false, canRemove));
            })
            .catch((error) => {
              if (currentPhotoLoad !== photoLoadToken || markerEditor.hidden || editingMarkerId !== marker.id) return;
              console.error('Unable to load marker photo:', error);
              placeholder.textContent = 'Image unavailable';
              announce(error.message || 'Could not load a saved marker image.', true);
            });
        });
        if (includePending) pendingMarkerPhotos.forEach((photo) => gallery.append(createPhotoCard(photo, photo.url, true, canRemove)));
      };

      const formatMonthYear = (value) => {
        if (!value) return '';
        const monthYear = value.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
        if (monthYear) return `${monthYear[2]}/${monthYear[1]}`;
        return value;
      };

      const storeMonthYear = (value) => {
        const monthYear = value.trim();
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(monthYear)) return monthYear;
        const formattedMonthYear = monthYear.match(/^(0[1-9]|1[0-2])\/(\d{4})$/);
        return formattedMonthYear ? `${formattedMonthYear[2]}-${formattedMonthYear[1]}` : '';
      };

      const monthInputValue = (value) => {
        const storedMonthYear = value.match(/^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/);
        if (storedMonthYear) return `${storedMonthYear[1]}-${storedMonthYear[2]}`;
        const formattedMonthYear = value.match(/^(0[1-9]|1[0-2])\/(\d{4})$/);
        return formattedMonthYear ? `${formattedMonthYear[2]}-${formattedMonthYear[1]}` : '';
      };

      const showMarkerDetails = (x, y, marker) => {
        const wasOpen = isMarkerEditorShowing();
        photoLoadToken += 1;
        editingMarkerId = marker.id;
        markerPanelPoint = { x, y };
        const detailsType = markerTypeOf(marker);
        document.getElementById('markerEditorTitle').textContent = detailsType ? MARKER_TYPES[detailsType].label : 'Marker Details';
        document.querySelector('.marker-editor-heading p').textContent = detailsType
          ? `${MARKER_TYPES[detailsType].code}${marker.deviceId ? ` · Device ${marker.deviceId}` : ''}`
          : 'Device details';
        setEditorHeaderIcon(detailsType);
        document.getElementById('markerDetailsView').hidden = false;
        document.getElementById('markerEditFields').hidden = true;
        document.getElementById('markerEdit').hidden = false;
        document.getElementById('markerEditorActions').hidden = true;
        const detailsGrid = document.getElementById('markerDetailsGrid');
        detailsGrid.replaceChildren();
        [
          ['Device ID', marker.deviceId],
          ['Device Name', marker.product],
          ['Floor Level', marker.floorLevel],
          ['Venue', marker.location],
          ['Device Type', marker.deviceType],
          ['Next Inspection Date', formatMonthYear(marker.serviceDate)],
          ['Manufacturing Date', formatMonthYear(marker.manufacturingDate)]
        ].forEach(([label, value], index) => {
          const item = document.createElement('div');
          item.className = 'marker-detail-item';
          item.style.setProperty('--i', String(index));
          const itemLabel = document.createElement('span');
          itemLabel.textContent = label;
          const itemValue = document.createElement('strong');
          itemValue.textContent = value || '—';
          item.append(itemLabel, itemValue);
          if (label === 'Device ID') item.classList.add('is-primary');
          detailsGrid.append(item);
        });
        markerEditor.hidden = false;
        removedMarkerPhotoIds = new Set();
        renderMarkerPhotos(marker, document.getElementById('markerDetailsPhotos'), false, false);
        positionMarkerEditor(x, y);
        playMarkerEditorOpen(wasOpen);
        requestAnimationFrame(() => positionMarkerEditor(x, y));
      };

      const showMarkerEditor = (x, y, marker = null) => {
        const wasOpen = isMarkerEditorShowing();
        photoLoadToken += 1;
        pendingMarkerPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
        editingMarkerId = marker ? marker.id : null;
        markerPanelPoint = { x, y };
        draftMarkerPoint = marker ? null : { x: draftMarkerPoint.x, y: draftMarkerPoint.y };
        pendingMarkerPhotos = [];
        removedMarkerPhotoIds = new Set();
        markerPhotoInput.value = '';
        document.getElementById('markerEditorTitle').textContent = marker ? 'Edit marker' : 'Add a marker';
        document.querySelector('.marker-editor-heading p').textContent = marker
          ? 'Change the type or details for this device.'
          : 'Choose the device type, then enter its details.';
        document.getElementById('markerDetailsView').hidden = true;
        document.getElementById('markerEditFields').hidden = false;
        document.getElementById('markerEdit').hidden = true;
        document.getElementById('markerEditorActions').hidden = false;
        document.getElementById('markerDeviceId').value = marker ? marker.deviceId || '' : '';
        document.getElementById('markerProduct').value = marker ? marker.product : '';
        document.getElementById('markerDeviceType').value = marker ? marker.deviceType || '' : '';
        document.getElementById('markerFloorLevel').value = marker ? marker.floorLevel || '' : '';
        document.getElementById('markerLocation').value = marker ? marker.location : '';
        document.getElementById('markerServiceDate').value = marker ? monthInputValue(marker.serviceDate || '') : '';
        document.getElementById('markerManufacturingDate').value = marker ? monthInputValue(marker.manufacturingDate || '') : '';
        document.getElementById('markerDelete').hidden = !marker;
        let startType = '';
        if (marker) {
          startType = markerTypeOf(marker);
        } else {
          try {
            const saved = localStorage.getItem(lastMarkerTypeKey);
            startType = saved === null ? 'fx' : (MARKER_TYPES[saved] ? saved : '');
          } catch (error) { startType = 'fx'; }
        }
        selectedMarkerType = startType;
        if (!marker && MARKER_TYPES[startType]) {
          document.getElementById('markerDeviceType').value = MARKER_TYPES[startType].label;
        }
        renderMarkerTypePicker();
        setEditorHeaderIcon(startType);
        markerEditor.hidden = false;
        photoLoadToken += 1;
        renderMarkerPhotos(marker);
        positionMarkerEditor(x, y);
        playMarkerEditorOpen(wasOpen);
        requestAnimationFrame(() => {
          positionMarkerEditor(x, y);
          document.getElementById('markerProduct').focus({ preventScroll: true });
        });
      };

      const renderList = () => {
        list.replaceChildren();
        layouts.forEach((layout, index) => {
          const row = document.createElement('div');
          row.className = 'layout-row';
          const item = document.createElement('button');
          item.type = 'button';
          item.dataset.layoutId = layout.id;
          item.title = layout.name;
          item.className = `layout-item${index === selectedIndex ? ' active' : ''}`;
          item.setAttribute('aria-current', index === selectedIndex ? 'true' : 'false');
          item.setAttribute('aria-label', `Show ${layout.name}`);

          const thumb = document.createElement('img');
          thumb.className = 'layout-thumb';
          thumb.src = layout.src;
          thumb.alt = '';
          thumb.loading = 'lazy';

          const copy = document.createElement('span');
          copy.className = 'layout-item-copy nav-label';
          const title = document.createElement('span');
          title.className = 'layout-item-title';
          title.textContent = layout.name;
          const meta = document.createElement('span');
          meta.className = 'layout-item-meta';
          const deviceTotal = (markersByLayout.get(layout.id) || []).length;
          meta.textContent = `${deviceTotal} ${deviceTotal === 1 ? 'device' : 'devices'}`;
          copy.append(title, meta);
          item.append(thumb, copy);
          item.addEventListener('click', () => {
            selectLayout(index);
            if (sidebarIsDrawer()) setSidebarOpen(false);
          });

          const actions = document.createElement('div');
          actions.className = 'layout-item-actions editor-only';
          const rename = document.createElement('button');
          rename.type = 'button';
          rename.className = 'layout-action rename';
          rename.setAttribute('aria-label', `Rename ${layout.name}`);
          rename.title = 'Rename layout';
          rename.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
          rename.addEventListener('click', () => {
            projectToRename = null;
            document.getElementById('layoutRenameTitle').textContent = 'Rename layout';
            document.getElementById('layoutRenameLabel').textContent = 'Layout name';
            layoutToRename = layout;
            layoutRenameInput.value = layout.name;
            layoutRenameDialog.hidden = false;
            layoutRenameInput.focus();
            layoutRenameInput.select();
          });
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'layout-action delete';
          remove.setAttribute('aria-label', `Delete ${layout.name}`);
          remove.title = 'Delete layout';
          remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v7m6-7v7"/></svg>';
          remove.addEventListener('click', () => {
            projectToDelete = null;
            layoutToDelete = layout;
            document.getElementById('layoutConfirmTitle').textContent = `Delete "${layout.name}"?`;
            document.getElementById('layoutConfirmMessage').textContent =
              'This layout and its markers will be removed from this site on all devices.';
            layoutConfirm.hidden = false;
            document.getElementById('layoutDeleteCancel').focus();
          });
          actions.append(rename, remove);
          row.append(item, actions);
          list.append(row);
        });

        document.getElementById('layoutCount').textContent = String(layouts.length);

        // Phones: swipeable strip of layouts under the plan
        const strip = document.getElementById('layoutStrip');
        strip.replaceChildren();
        layouts.forEach((layout, index) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = `layout-chip${index === selectedIndex ? ' active' : ''}`;
          chip.setAttribute('aria-current', index === selectedIndex ? 'true' : 'false');
          const chipThumb = document.createElement('img');
          chipThumb.src = layout.src;
          chipThumb.alt = '';
          chipThumb.loading = 'lazy';
          const chipName = document.createElement('span');
          chipName.textContent = layout.name;
          const chipMeta = document.createElement('small');
          const total = (markersByLayout.get(layout.id) || []).length;
          chipMeta.textContent = `${total} ${total === 1 ? 'device' : 'devices'}`;
          chip.append(chipThumb, chipName, chipMeta);
          chip.addEventListener('click', () => selectLayout(index));
          strip.append(chip);
        });
        const activeChip = strip.querySelector('.layout-chip.active');
        if (activeChip && strip.clientWidth) {
          strip.scrollTo({ left: activeChip.offsetLeft - (strip.clientWidth - activeChip.offsetWidth) / 2, behavior: 'smooth' });
        }
        renderPresenceAvatars(latestPresenceRows);
      };

      const updateSelectedLayout = () => {
        updateProjectControls();
        if (!layouts.length) {
          selectedIndex = 0;
          image.removeAttribute('src');
          image.alt = '';
          document.getElementById('sheetTitle').textContent = 'No layouts';
          document.getElementById('sheetType').textContent = 'Add a layout to get started';
          document.getElementById('sheetCounter').textContent = '00 / 00';
          document.getElementById('breadcrumbLayout').textContent = 'No layouts';
          document.getElementById('prevLayout').disabled = true;
          document.getElementById('nextLayout').disabled = true;
          markerToggle.disabled = true;
          moveMarkerToggle.disabled = true;
          setMarkerMoveMode(false);
          renderList();
          renderMarkers();
          return;
        }
        markerToggle.disabled = false;
        moveMarkerToggle.disabled = false;
        const layout = layouts[selectedIndex];
        image.src = layout.src;
        image.alt = `${activeProject.name} ${layout.name}`;
        document.getElementById('sheetTitle').textContent = layout.name;
        document.getElementById('sheetType').textContent = layout.uploaded ? 'Added image' : 'Project drawing';
        document.getElementById('sheetCounter').textContent =
          `${String(selectedIndex + 1).padStart(2, '0')} / ${String(layouts.length).padStart(2, '0')}`;
        document.getElementById('breadcrumbLayout').textContent = layout.name;
        document.getElementById('prevLayout').disabled = selectedIndex === 0;
        document.getElementById('nextLayout').disabled = selectedIndex === layouts.length - 1;
        renderList();
        renderMarkers();
      };

      const selectLayout = (index) => {
        closeMarkerEditor();
        setMarkerMoveMode(false);
        if (!layouts.length) {
          updateSelectedLayout();
          return;
        }
        if (index < 0 || index >= layouts.length) return;
        selectedIndex = index;
        resetView();
        updateSelectedLayout();
        updatePresenceLocation();
      };

      const zoomAt = (nextZoom, clientX, clientY) => {
        const clampedZoom = Math.min(5, Math.max(1, nextZoom));
        if (clampedZoom === zoom) return;
        const bounds = stage.getBoundingClientRect();
        const pointX = clientX === undefined ? 0 : clientX - bounds.left - bounds.width / 2;
        const pointY = clientY === undefined ? 0 : clientY - bounds.top - bounds.height / 2;
        const ratio = clampedZoom / zoom;
        panX = pointX - (pointX - panX) * ratio;
        panY = pointY - (pointY - panY) * ratio;
        zoom = clampedZoom;
        updateTransform();
      };

      const openDatabase = () => {
        if (!('indexedDB' in window)) {
          return Promise.reject(new Error('This browser does not support local image storage.'));
        }
        if (database) {
          return Promise.resolve(database);
        }
        if (databasePromise) return databasePromise;
        databasePromise = new Promise((resolve, reject) => {
          const request = indexedDB.open('mquest-parkview-layouts', 2);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('uploads')) db.createObjectStore('uploads', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('markerPhotos')) db.createObjectStore('markerPhotos', { keyPath: 'id' });
          };
          request.onsuccess = () => {
            database = request.result;
            resolve(database);
          };
          request.onerror = () => reject(request.error || new Error('Could not open local image storage.'));
          request.onblocked = () => reject(new Error('Close other open dashboard tabs to enable image storage.'));
        }).catch((error) => {
          databasePromise = null;
          throw error;
        });
        return databasePromise;
      };

      const getSavedUploads = () => new Promise((resolve, reject) => {
        const request = database.transaction('uploads', 'readonly').objectStore('uploads').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Could not read saved layouts.'));
      });

      const saveUpload = (upload) => new Promise((resolve, reject) => {
        const transaction = database.transaction('uploads', 'readwrite');
        transaction.objectStore('uploads').put(upload);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not save this image.'));
        transaction.onabort = () => reject(transaction.error || new Error('Saving this image was cancelled.'));
      });

      const addLayoutsToProject = async (project, files) => {
        let storageFailureCount = 0;
        let cloudFailureCount = 0;
        let lastAddedIndex = project.layouts.length - 1;
        for (const file of files) {
          const prefix = project.id === defaultProjectId ? '' : `${project.id}--`;
          const id = `${prefix}upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const upload = { id, name: file.name, blob: file, createdAt: Date.now() };
          const layout = {
            id,
            name: file.name,
            src: URL.createObjectURL(file),
            type: 'Added image',
            uploaded: true
          };
          project.layouts.push(layout);
          lastAddedIndex = project.layouts.length - 1;
          try {
            await openDatabase();
            await saveUpload(upload);
          } catch (error) {
            console.error('Unable to save uploaded layout:', error);
            storageFailureCount += 1;
          }
          try {
            await saveCloudLayoutState(layout, { imageFile: file });
          } catch (error) {
            console.error('Unable to sync uploaded layout:', error);
            cloudFailureCount += 1;
          }
        }
        return { lastAddedIndex, storageFailureCount, cloudFailureCount };
      };

      const deleteUpload = (id) => new Promise((resolve, reject) => {
        const transaction = database.transaction('uploads', 'readwrite');
        transaction.objectStore('uploads').delete(id);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not delete the saved layout image.'));
        transaction.onabort = () => reject(transaction.error || new Error('Deleting the saved layout image was cancelled.'));
      });

      const encodeStoragePath = (path) => path.split('/').map(encodeURIComponent).join('/');
      const getLayoutStoragePath = (layoutId) => `${markerCloudSiteId}/${layoutId}`;
      const getLayoutPublicUrl = (path, version = '') => {
        const url = `${getMarkerCloudRestUrl().replace('/rest/v1', '')}/storage/v1/object/public/parkview-layouts/${encodeStoragePath(path)}`;
        return version ? `${url}?v=${encodeURIComponent(version)}` : url;
      };

      const uploadCloudLayoutImage = async (layoutId, file) => {
        const path = getLayoutStoragePath(layoutId);
        const response = await supabaseFetch(
          `${getMarkerCloudRestUrl().replace('/rest/v1', '')}/storage/v1/object/parkview-layouts/${encodeStoragePath(path)}`,
          {
            method: 'POST',
            headers: {
              apikey: markerCloudConfig.anonKey,
              'Content-Type': file.type || 'application/octet-stream',
              'x-upsert': 'true'
            },
            body: file
          }
        );
        if (!response.ok) throw new Error(`Supabase layout image upload failed (${response.status}).`);
        return path;
      };

      const saveCloudLayoutState = async (layout, { imageFile = null, deleted = false } = {}) => {
        let imagePath = layout.imagePath || null;
        if (imageFile) imagePath = await uploadCloudLayoutImage(layout.id, imageFile);
        const updatedAt = new Date().toISOString();
        const response = await supabaseFetch(
          `${getMarkerCloudRestUrl()}/parkview_layouts?on_conflict=site_id,layout_id`,
          {
            method: 'POST',
            headers: {
              apikey: markerCloudConfig.anonKey,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify({
              site_id: markerCloudSiteId,
              layout_id: layout.id,
              name: layout.name,
              is_uploaded: layout.uploaded,
              deleted,
              image_path: imagePath,
              updated_at: updatedAt
            })
          }
        );
        if (!response.ok) throw new Error(`Supabase layout save failed (${response.status}).`);
        layout.imagePath = imagePath;
        layout.updatedAt = updatedAt;
      };

      const deleteCloudLayoutImage = async (path) => {
        if (!path) return;
        const response = await supabaseFetch(
          `${getMarkerCloudRestUrl().replace('/rest/v1', '')}/storage/v1/object/parkview-layouts/${encodeStoragePath(path)}`,
          {
            method: 'DELETE',
            headers: { apikey: markerCloudConfig.anonKey }
          }
        );
        if (!response.ok && response.status !== 404) {
          throw new Error(`Supabase layout image delete failed (${response.status}).`);
        }
      };

      const fetchCloudLayouts = async () => {
        const response = await supabaseFetch(
          `${getMarkerCloudRestUrl()}/parkview_layouts?site_id=eq.${encodeURIComponent(markerCloudSiteId)}&select=site_id,layout_id,name,is_uploaded,deleted,image_path,updated_at`,
          { headers: { apikey: markerCloudConfig.anonKey } }
        );
        if (!response.ok) throw new Error(`Supabase layouts load failed (${response.status}).`);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('Saved cloud layouts have an invalid format.');
        return rows;
      };

      const saveCloudProject = async (project) => {
        const response = await supabaseFetch(`${getMarkerCloudRestUrl()}/parkview_projects?on_conflict=site_id,project_id`, {
          method: 'POST',
          headers: {
            apikey: markerCloudConfig.anonKey,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify({
            site_id: markerCloudSiteId,
            project_id: project.id,
            name: project.name,
            deleted: project.deleted === true,
            updated_at: project.updatedAt || new Date().toISOString()
          })
        });
        if (!response.ok) throw new Error(`Supabase project save failed (${response.status}).`);
      };

      const deleteProjectData = async (project) => {
        await layoutSyncPromise;
        await markerSyncPromise;
        const cloudLayouts = await fetchCloudLayouts();
        const layoutsToDelete = new Map(project.layouts.map((layout) => [layout.id, { ...layout }]));
        cloudLayouts.forEach((row) => {
          if (getProjectForLayoutId(row.layout_id) !== project) return;
          const layout = layoutsToDelete.get(row.layout_id) || {
            id: row.layout_id,
            name: row.name,
            uploaded: row.is_uploaded,
            src: '',
            imagePath: row.image_path,
            updatedAt: row.updated_at
          };
          layout.imagePath = row.image_path;
          layout.uploaded = row.is_uploaded;
          layoutsToDelete.set(row.layout_id, layout);
        });

        const localPhotos = [];
        for (const layout of layoutsToDelete.values()) {
          const remoteMarkers = await fetchCloudMarkersForLayout(layout.id);
          const layoutMarkers = markersByLayout.get(layout.id) || [];
          const layoutLocalPhotos = layoutMarkers.flatMap((marker) => Array.isArray(marker.photos)
            ? marker.photos
            : marker.photoId ? [{ id: marker.photoId, name: marker.photoName || 'Saved image' }] : []);
          localPhotos.push(...layoutLocalPhotos);
          const cloudPhotos = remoteMarkers.flatMap((row) => {
            const marker = row.marker || {};
            return Array.isArray(marker.photos)
              ? marker.photos
              : marker.photoId ? [{ id: marker.photoId, name: marker.photoName || 'Saved image' }] : [];
          });
          const photosById = new Map([...layoutLocalPhotos, ...cloudPhotos]
            .filter((photo) => photo && (photo.id || photo.path))
            .map((photo) => [photo.id || photo.path, photo]));
          for (const photo of photosById.values()) await deleteCloudMarkerPhoto(photo);

          await saveCloudLayoutState(layout, { deleted: true });
          const markerQuery = new URLSearchParams({
            site_id: `eq.${markerCloudSiteId}`,
            layout_id: `eq.${layout.id}`
          });
          const markerResponse = await supabaseFetch(`${getMarkerCloudRestUrl()}/parkview_markers?${markerQuery}`, {
            method: 'DELETE',
            headers: { apikey: markerCloudConfig.anonKey }
          });
          if (!markerResponse.ok) throw new Error(`Could not delete markers for ${layout.name} (${markerResponse.status}).`);
          await deleteCloudLayoutImage(layout.imagePath);
        }

        const deletedProject = {
          ...project,
          deleted: true,
          updatedAt: new Date().toISOString()
        };
        await saveCloudProject(deletedProject);
        project.deleted = true;
        project.updatedAt = deletedProject.updatedAt;
        let localCleanupFailed = false;
        try {
          if (layoutsToDelete.size || localPhotos.length) await openDatabase();
          for (const layout of layoutsToDelete.values()) {
            if (layout.uploaded) await deleteUpload(layout.id);
          }
          for (const photo of localPhotos) {
            if (photo.id) await deleteMarkerPhoto(photo.id);
          }
        } catch (error) {
          console.error('Unable to remove the deleted project from local image storage:', error);
          localCleanupFailed = true;
        }
        for (const photo of localPhotos) {
          const cachedUrl = sessionMarkerPhotos.get(photo.id);
          if (cachedUrl) URL.revokeObjectURL(cachedUrl);
          sessionMarkerPhotos.delete(photo.id);
        }
        for (const layout of layoutsToDelete.values()) {
          if (layout.src && layout.src.startsWith('blob:')) URL.revokeObjectURL(layout.src);
          markersByLayout.delete(layout.id);
          markerCloudBaseline.delete(layout.id);
        }
        const projectIndex = projects.indexOf(project);
        if (projectIndex !== -1) projects.splice(projectIndex, 1);
        const markersSavedLocally = persistMarkers();
        const projectsSavedLocally = persistProjects();
        activeProject = getActiveProjects()[0];
        layouts = activeProject.layouts;
        selectedIndex = 0;
        resetView();
        try {
          localStorage.setItem(activeProjectStorageKey, activeProject.id);
        } catch (error) {
          console.error('Unable to remember the active project:', error);
          localCleanupFailed = true;
        }
        updateSelectedLayout();
        if (!projectsSavedLocally || !markersSavedLocally || localCleanupFailed) {
          announce('Project deleted from this site. Some browser data could not be removed.', true);
        } else {
          announce(`Project "${project.name}" and its layouts were deleted from this site.`);
        }
      };

      const fetchCloudProjects = async () => {
        const response = await supabaseFetch(
          `${getMarkerCloudRestUrl()}/parkview_projects?site_id=eq.${encodeURIComponent(markerCloudSiteId)}&select=project_id,name,deleted,updated_at`,
          { headers: { apikey: markerCloudConfig.anonKey } }
        );
        if (!response.ok) throw new Error(`Supabase projects load failed (${response.status}).`);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('Saved cloud projects have an invalid format.');
        return rows;
      };

      const syncProjectsFromCloud = async () => {
        if (projectSyncInProgress) return;
        projectSyncInProgress = true;
        try {
          const remoteProjects = await fetchCloudProjects();
          const remoteProjectsById = new Map();
          remoteProjects.forEach((row) => {
            if (typeof row.project_id !== 'string' || typeof row.name !== 'string') {
              throw new Error('A saved cloud project has an invalid format.');
            }
            remoteProjectsById.set(row.project_id, row);
            const existing = projects.find((project) => project.id === row.project_id);
            if (existing) {
              const localIsNewer = Date.parse(existing.updatedAt || '') > Date.parse(row.updated_at || '');
              if (!localIsNewer) {
                existing.name = row.name;
                existing.deleted = row.deleted === true;
                existing.updatedAt = row.updated_at;
              }
            } else {
              projects.push({
                id: row.project_id,
                name: row.name,
                updatedAt: row.updated_at,
                deleted: row.deleted === true,
                layouts: []
              });
            }
          });
          for (const project of projects) {
            const remoteProject = remoteProjectsById.get(project.id);
            const localIsNewer = remoteProject && Date.parse(project.updatedAt || '') > Date.parse(remoteProject.updated_at || '');
            if (!remoteProject || localIsNewer) await saveCloudProject(project);
          }
          ensureActiveProject();
          if (activeProject.deleted) {
            activeProject = getActiveProjects()[0];
            layouts = activeProject.layouts;
            selectedIndex = 0;
            resetView();
            updateSelectedLayout();
          }
          if (!persistProjects()) throw new Error('Project names could not be saved in browser storage.');
          updateProjectControls();
          projectSyncErrorAnnounced = false;
          projectCloudSyncAvailable = true;
        } finally {
          projectSyncInProgress = false;
        }
      };

      const syncLayoutsFromCloud = async () => {
        if (layoutSyncInProgress || !markerEditor.hidden) return;
        layoutSyncInProgress = true;
        try {
          const remoteRows = await fetchCloudLayouts();
          const selectedLayoutId = layouts[selectedIndex] && layouts[selectedIndex].id;
          let selectedLayoutChanged = false;
          let structureChanged = false;
          const knownRemoteLayouts = new Set(remoteRows.map((row) => row.layout_id));
          for (const row of remoteRows) {
            if (typeof row.layout_id !== 'string' || typeof row.name !== 'string') {
              throw new Error('A saved cloud layout has an invalid format.');
            }
            const project = getProjectForLayoutId(row.layout_id);
            const projectLayouts = project.layouts;
            const existingIndex = projectLayouts.findIndex((layout) => layout.id === row.layout_id);
            if (project.deleted) {
              if (existingIndex !== -1) {
                const [removedLayout] = projectLayouts.splice(existingIndex, 1);
                if (removedLayout.src.startsWith('blob:')) URL.revokeObjectURL(removedLayout.src);
              }
              continue;
            }
            if (row.deleted) {
              if (existingIndex !== -1) {
                if (project === activeProject) {
                  removeLayoutLocally(existingIndex);
                  structureChanged = true;
                } else {
                  const [removedLayout] = projectLayouts.splice(existingIndex, 1);
                  if (removedLayout.src.startsWith('blob:')) URL.revokeObjectURL(removedLayout.src);
                }
              }
              if (row.is_uploaded) {
                try {
                  await openDatabase();
                  await deleteUpload(row.layout_id);
                } catch (error) {
                  console.error('Unable to remove a deleted local layout image:', error);
                }
              }
              continue;
            }
            const imageUrl = row.image_path ? getLayoutPublicUrl(row.image_path, row.updated_at) : null;
            if (existingIndex === -1) {
              if (!row.is_uploaded || !imageUrl) continue;
              projectLayouts.push({
                id: row.layout_id,
                name: row.name,
                src: imageUrl,
                type: 'Added image',
                uploaded: true,
                imagePath: row.image_path,
                updatedAt: row.updated_at
              });
              if (project === activeProject) structureChanged = true;
            } else {
              const layout = projectLayouts[existingIndex];
              const imageChanged = Boolean(imageUrl &&
                (layout.imagePath !== row.image_path || layout.updatedAt !== row.updated_at));
              if (layout.name !== row.name || imageChanged) {
                if (project === activeProject && layout.id === selectedLayoutId) selectedLayoutChanged = true;
              }
              layout.name = row.name;
              layout.imagePath = row.image_path;
              layout.updatedAt = row.updated_at;
              if (imageChanged) layout.src = imageUrl;
            }
          }

          for (const project of projects) {
            for (const layout of project.layouts) {
              if (knownRemoteLayouts.has(layout.id)) continue;
              if (layout.uploaded && layout.src.startsWith('blob:')) {
                const upload = (await getSavedUploads()).find((saved) => saved.id === layout.id);
                if (upload) await saveCloudLayoutState(layout, { imageFile: upload.blob });
              }
            }
          }
          if (selectedIndex >= layouts.length) selectedIndex = Math.max(0, layouts.length - 1);
          if (selectedLayoutId && !layouts.some((layout) => layout.id === selectedLayoutId)) {
            selectLayout(selectedIndex);
          } else {
            if (selectedLayoutId) {
              selectedIndex = layouts.findIndex((layout) => layout.id === selectedLayoutId);
            }
            if (selectedLayoutChanged || structureChanged) updateSelectedLayout();
          }
        } finally {
          layoutSyncInProgress = false;
        }
      };

      const removeLayoutLocally = (index) => {
        const [layout] = layouts.splice(index, 1);
        if (layout && layout.src.startsWith('blob:')) URL.revokeObjectURL(layout.src);
        if (selectedIndex > index) selectedIndex -= 1;
        else if (selectedIndex >= layouts.length) selectedIndex = Math.max(0, layouts.length - 1);
      };

      const getMarkerPhoto = (id) => new Promise((resolve, reject) => {
        const request = database.transaction('markerPhotos', 'readonly').objectStore('markerPhotos').get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Could not read the marker photo.'));
      });

      const saveMarkerPhoto = (id, file) => new Promise((resolve, reject) => {
        const transaction = database.transaction('markerPhotos', 'readwrite');
        transaction.objectStore('markerPhotos').put({ id, name: file.name, blob: file });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not save the marker photo.'));
        transaction.onabort = () => reject(transaction.error || new Error('Saving the marker photo was cancelled.'));
      });

      const deleteMarkerPhoto = (id) => new Promise((resolve, reject) => {
        const transaction = database.transaction('markerPhotos', 'readwrite');
        transaction.objectStore('markerPhotos').delete(id);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not remove the marker photo.'));
        transaction.onabort = () => reject(transaction.error || new Error('Removing the marker photo was cancelled.'));
      });

      const restoreUploads = async () => {
        try {
          database = await openDatabase();
          const uploads = await getSavedUploads();
          uploads.sort((a, b) => a.createdAt - b.createdAt).forEach((upload) => {
            const project = getProjectForLayoutId(upload.id);
            if (project.deleted) return;
            if (project.layouts.some((layout) => layout.id === upload.id)) return;
            project.layouts.push({
              id: upload.id,
              name: upload.name,
              src: URL.createObjectURL(upload.blob),
              type: 'Added image',
              uploaded: true
            });
          });
          selectLayout(selectedIndex);
        } catch (error) {
          console.error('Unable to restore saved layouts:', error);
          announce('Saved uploads could not be restored. You can still add images for this session.', true);
        }
      };

      fileInput.addEventListener('change', async (event) => {
        const files = Array.from(event.target.files || []);
        const imageFiles = files.filter((file) => file.type.startsWith('image/'));
        const rejectedCount = files.length - imageFiles.length;
        if (files.length === 0) return;
        const { lastAddedIndex, storageFailureCount, cloudFailureCount } =
          await addLayoutsToProject(activeProject, imageFiles);
        if (imageFiles.length) selectLayout(lastAddedIndex);
        if (storageFailureCount) {
          announce(`${imageFiles.length} ${imageFiles.length === 1 ? 'layout was' : 'layouts were'} added for this session; ${storageFailureCount} could not be saved.`, true);
        } else if (cloudFailureCount) {
          announce(`${imageFiles.length} ${imageFiles.length === 1 ? 'layout was' : 'layouts were'} added on this device, but ${cloudFailureCount} could not sync to other devices.`, true);
        } else if (imageFiles.length && rejectedCount) {
          announce(`${imageFiles.length} ${imageFiles.length === 1 ? 'layout' : 'layouts'} added; ${rejectedCount} non-image ${rejectedCount === 1 ? 'file was' : 'files were'} skipped.`, true);
        } else if (imageFiles.length) {
          announce(`${imageFiles.length} ${imageFiles.length === 1 ? 'layout' : 'layouts'} added.`);
        }
        if (imageFiles.length && !cloudFailureCount) {
          logActivity('layout.add', `Added ${imageFiles.length === 1 ? `layout "${imageFiles[0].name}"` : `${imageFiles.length} layouts`}`,
            { layout: imageFiles.length === 1 ? layouts[lastAddedIndex] : null });
        } else if (rejectedCount) {
          announce('Only image files can be added.', true);
        }
        fileInput.value = '';
      });


      const projectCreateDialog = document.getElementById('projectCreateDialog');
      const projectCreateForm = document.getElementById('projectCreateForm');
      const projectNameInput = document.getElementById('projectNameInput');
      const projectLayoutsInput = document.getElementById('projectLayoutsInput');
      document.getElementById('newProjectButton').addEventListener('click', () => {
        projectCreateForm.reset();
        projectCreateDialog.hidden = false;
        projectNameInput.focus();
      });
      document.getElementById('projectCreateCancel').addEventListener('click', () => {
        projectCreateDialog.hidden = true;
      });
      projectCreateDialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') projectCreateDialog.hidden = true;
      });
      projectCreateForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = projectNameInput.value.trim();
        const files = Array.from(projectLayoutsInput.files || []).filter((file) => file.type.startsWith('image/'));
        if (!name || !files.length) {
          announce('Enter a project name and choose at least one image layout.', true);
          return;
        }
        const createButton = document.getElementById('projectCreateSave');
        createButton.disabled = true;
        const project = {
          id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          updatedAt: new Date().toISOString(),
          layouts: []
        };
        projects.push(project);
        const projectSavedLocally = persistProjects();
        let projectSavedToCloud = true;
        try {
          await saveCloudProject(project);
          projectCloudSyncAvailable = true;
          projectSyncErrorAnnounced = false;
        } catch (error) {
          console.error('Unable to sync new project:', error);
          projectSavedToCloud = false;
        }
        const result = await addLayoutsToProject(project, files);
        projectCreateDialog.hidden = true;
        activeProject = project;
        layouts = project.layouts;
        selectedIndex = result.lastAddedIndex;
        try {
          localStorage.setItem(activeProjectStorageKey, project.id);
        } catch (error) {
          console.error('Unable to remember the active project:', error);
        }
        resetView();
        updateSelectedLayout();
        if (!projectSavedLocally || !projectSavedToCloud || result.storageFailureCount || result.cloudFailureCount) {
          const issues = [];
          if (!projectSavedLocally) issues.push('project name could not be saved in browser storage');
          if (!projectSavedToCloud) issues.push('project name could not sync to other devices');
          if (result.storageFailureCount) issues.push(`${result.storageFailureCount} layout image(s) could not be saved locally`);
          if (result.cloudFailureCount) issues.push(`${result.cloudFailureCount} layout image(s) could not sync`);
          announce(`Project created with ${files.length} layout(s), but ${issues.join('; ')}.`, true);
        } else {
          announce(`Project "${project.name}" created with ${files.length} layout(s).`);
          logActivity('project.create', `Created project "${project.name}" with ${files.length} layout(s)`, { project });
        }
        createButton.disabled = false;
      });

      document.getElementById('projectRename').addEventListener('click', () => {
        projectToRename = activeProject;
        layoutToRename = null;
        document.getElementById('layoutRenameTitle').textContent = 'Rename project';
        document.getElementById('layoutRenameLabel').textContent = 'Project name';
        layoutRenameInput.value = activeProject.name;
        layoutRenameDialog.hidden = false;
        layoutRenameInput.focus();
        layoutRenameInput.select();
      });

      document.getElementById('projectDelete').addEventListener('click', () => {
        if (getActiveProjects().length <= 1) {
          announce('At least one project must remain. Create another project before deleting this one.', true);
          return;
        }
        projectToDelete = activeProject;
        layoutToDelete = null;
        document.getElementById('layoutConfirmTitle').textContent = `Delete "${activeProject.name}"?`;
        document.getElementById('layoutConfirmMessage').textContent =
          'This project, all of its layouts, markers and images will be deleted from this site on all devices.';
        document.getElementById('layoutDeleteConfirm').textContent = 'Delete project';
        layoutConfirm.hidden = false;
        document.getElementById('layoutDeleteCancel').focus();
      });

      layoutRenameForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (projectToRename) {
          const project = projectToRename;
          const name = layoutRenameInput.value.trim();
          if (!name) {
            layoutRenameInput.focus();
            return;
          }
          const saveButton = document.getElementById('layoutRenameSave');
          saveButton.disabled = true;
          const previousProjectName = project.name;
          project.name = name;
          project.updatedAt = new Date().toISOString();
          layoutRenameDialog.hidden = true;
          projectToRename = null;
          const projectSavedLocally = persistProjects();
          updateProjectControls();
          try {
            await saveCloudProject(project);
            projectCloudSyncAvailable = true;
            projectSyncErrorAnnounced = false;
            announce(`Project renamed to "${name}" and synced across devices.`);
            logActivity('project.rename', `Renamed project "${previousProjectName}" to "${name}"`, { project });
          } catch (error) {
            console.error('Unable to sync project name:', error);
            announce(projectSavedLocally
              ? `Project renamed on this device, but cloud sync failed (${error.message}).`
              : `Project renamed, but saving failed (${error.message}).`, true);
          } finally {
            saveButton.disabled = false;
          }
          return;
        }
        const layout = layoutToRename;
        const name = layoutRenameInput.value.trim();
        if (!layout || !name) {
          layoutRenameInput.focus();
          return;
        }
        const saveButton = document.getElementById('layoutRenameSave');
        saveButton.disabled = true;
        try {
          const updatedLayout = { ...layout, name };
          const previousLayoutName = layout.name;
          await saveCloudLayoutState(updatedLayout);
          layout.name = updatedLayout.name;
          layout.imagePath = updatedLayout.imagePath;
          layout.updatedAt = updatedLayout.updatedAt;
          let localCacheFailed = false;
          if (layout.uploaded) {
            try {
              await openDatabase();
              const upload = (await getSavedUploads()).find((item) => item.id === layout.id);
              if (upload) await saveUpload({ ...upload, name });
            } catch (error) {
              console.error('Unable to update the local layout name:', error);
              localCacheFailed = true;
            }
          }
          layoutRenameDialog.hidden = true;
          layoutToRename = null;
          if (layouts[selectedIndex] === layout) updateSelectedLayout();
          else renderList();
          announce(localCacheFailed
            ? 'Layout renamed on other devices, but its local saved name could not be updated.'
            : 'Layout renamed on all devices for this site.');
          logActivity('layout.rename', `Renamed layout "${previousLayoutName}" to "${name}"`, { layout });
        } catch (error) {
          console.error('Unable to rename layout:', error);
          announce(error.message || 'Could not rename the layout.', true);
        } finally {
          saveButton.disabled = false;
        }
      });

      document.getElementById('layoutRenameCancel').addEventListener('click', () => {
        layoutRenameDialog.hidden = true;
        layoutToRename = null;
        projectToRename = null;
        document.getElementById('layoutRenameTitle').textContent = 'Rename layout';
        document.getElementById('layoutRenameLabel').textContent = 'Layout name';
      });
      layoutRenameDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        layoutRenameDialog.hidden = true;
        layoutToRename = null;
        projectToRename = null;
        document.getElementById('layoutRenameTitle').textContent = 'Rename layout';
        document.getElementById('layoutRenameLabel').textContent = 'Layout name';
      });

      document.getElementById('layoutDeleteCancel').addEventListener('click', () => {
        layoutConfirm.hidden = true;
        layoutToDelete = null;
        projectToDelete = null;
        document.getElementById('layoutDeleteConfirm').textContent = 'Delete layout';
      });
      document.getElementById('layoutDeleteConfirm').addEventListener('click', async (event) => {
        if (projectToDelete) {
          const deleteButton = event.currentTarget;
          const project = projectToDelete;
          if (getActiveProjects().length <= 1) {
            layoutConfirm.hidden = true;
            projectToDelete = null;
            deleteButton.textContent = 'Delete layout';
            updateProjectControls();
            announce('At least one project must remain.', true);
            return;
          }
          deleteButton.disabled = true;
          try {
            await deleteProjectData(project);
            logActivity('project.delete', `Deleted project "${project.name}"`, { project });
            layoutConfirm.hidden = true;
            projectToDelete = null;
            deleteButton.textContent = 'Delete layout';
          } catch (error) {
            console.error('Unable to delete project:', error);
            announce(error.message || 'Could not delete the project. Its data has not been fully removed.', true);
          } finally {
            deleteButton.disabled = false;
          }
          return;
        }
        if (!layoutToDelete) return;
        const deleteButton = event.currentTarget;
        deleteButton.disabled = true;
        const layout = layoutToDelete;
        const layoutIndex = layouts.findIndex((item) => item.id === layout.id);
        try {
          await saveCloudLayoutState(layout, { deleted: true });
          const query = new URLSearchParams({
            site_id: `eq.${markerCloudSiteId}`,
            layout_id: `eq.${layout.id}`
          });
          const markerResponse = await supabaseFetch(`${getMarkerCloudRestUrl()}/parkview_markers?${query}`, {
            method: 'DELETE',
            headers: { apikey: markerCloudConfig.anonKey }
          });
          if (!markerResponse.ok) throw new Error(`Could not delete the layout markers (${markerResponse.status}).`);
          await deleteCloudLayoutImage(layout.imagePath);
          if (layout.uploaded) {
            await openDatabase();
            await deleteUpload(layout.id);
          }
          markersByLayout.delete(layout.id);
          persistMarkers();
          if (layoutIndex !== -1) removeLayoutLocally(layoutIndex);
          layoutConfirm.hidden = true;
          layoutToDelete = null;
          selectLayout(Math.min(selectedIndex, layouts.length - 1));
          announce('Layout deleted from this site on all devices.');
          logActivity('layout.delete', `Deleted layout "${layout.name}"`, { layout });
        } catch (error) {
          console.error('Unable to delete layout:', error);
          announce(error.message || 'Could not delete the layout.', true);
        } finally {
          deleteButton.disabled = false;
        }
      });

      document.getElementById('prevLayout').addEventListener('click', () => selectLayout(selectedIndex - 1));
      document.getElementById('nextLayout').addEventListener('click', () => selectLayout(selectedIndex + 1));
      document.getElementById('zoomIn').addEventListener('click', () => zoomAt(zoom * 1.25));
      document.getElementById('zoomOut').addEventListener('click', () => zoomAt(zoom / 1.25));
      document.getElementById('resetZoom').addEventListener('click', resetView);
      markerToggle.addEventListener('click', () => {
        if (markerMode) {
          setMarkerMode(false);
          announce('Marker placement cancelled.');
          return;
        }
        closeMarkerEditor();
        setMarkerMoveMode(false);
        setMarkerMode(true);
        announce('Marker mode is on. Click a spot on the layout to add a marker.');
      });

      moveMarkerToggle.addEventListener('click', () => {
        if (markerMoveMode) {
          setMarkerMoveMode(false);
          announce('Marker move cancelled.');
          return;
        }
        if (!getCurrentMarkers().length) {
          announce('Add a marker before moving it.', true);
          return;
        }
        closeMarkerEditor();
        setMarkerMode(false);
        setMarkerMoveMode(true);
        announce('Move marker mode is on. Select a marker, then click its new position on the layout.');
      });

      stage.addEventListener('click', async (event) => {
        if ((!markerMode && !markerMoveMode) || event.target.closest('button, .marker-editor')) return;
        if (markerMoveMode && !movingMarkerId) {
          announce('Select the marker you want to move first.', true);
          return;
        }
        const bounds = getImageBounds();
        if (!bounds) {
          announce('Wait for the layout image to finish loading before placing a marker.', true);
          return;
        }
        const stageRect = stage.getBoundingClientRect();
        const localX = (event.clientX - stageRect.left - stage.clientWidth / 2 - panX) / zoom + stage.clientWidth / 2;
        const localY = (event.clientY - stageRect.top - stage.clientHeight / 2 - panY) / zoom + stage.clientHeight / 2;
        const x = (localX - bounds.left) / bounds.width;
        const y = (localY - bounds.top) / bounds.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) {
          announce('Place the marker on the layout image.', true);
          return;
        }
        if (markerMoveMode) {
          const marker = getCurrentMarkers().find((item) => item.id === movingMarkerId);
          if (!marker) {
            setMarkerMoveMode(false);
            announce('Could not find the selected marker. Please try again.', true);
            return;
          }
          marker.x = x;
          marker.y = y;
          setMarkerMoveMode(false);
          const saveResult = await persistMarkersEverywhere();
          if (!saveResult.localSaved) {
            announce('Marker moved for this session, but the change could not be saved to browser storage.', true);
          } else if (!saveResult.cloudSaved) {
            announce('Marker moved on this device, but it could not sync to your other devices.', true);
          } else {
            announce('Marker moved and synced across devices.');
            logActivity('marker.move', `Moved ${describeDevice(marker)}`, { layout: layouts[selectedIndex], marker });
          }
          return;
        }
        draftMarkerPoint = { x, y };
        setMarkerMode(false);
        showMarkerEditor(event.clientX - stageRect.left, event.clientY - stageRect.top);
      });

      markerPhotoInput.addEventListener('change', () => {
        const files = Array.from(markerPhotoInput.files || []);
        markerPhotoInput.value = '';
        const imageFiles = files.filter((file) => file.type.startsWith('image/'));
        const rejectedCount = files.length - imageFiles.length;
        imageFiles.forEach((file) => {
          pendingMarkerPhotos.push({
            id: `marker-photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name: file.name,
            file,
            url: URL.createObjectURL(file)
          });
        });
        if (rejectedCount) announce('Only image files can be added to a marker.', true);
        if (imageFiles.length) {
          renderMarkerPhotos(editingMarkerId ? getCurrentMarkers().find((item) => item.id === editingMarkerId) : null);
        }
      });

      markerEditor.addEventListener('submit', async (event) => {
        event.preventDefault();
        const saveButton = markerEditor.querySelector('.marker-save');
        saveButton.disabled = true;
        const wasEditing = Boolean(editingMarkerId);
        await markerSyncPromise;
        const markers = getCurrentMarkers();
        const details = {
          deviceId: document.getElementById('markerDeviceId').value.trim(),
          product: document.getElementById('markerProduct').value.trim(),
          deviceType: document.getElementById('markerDeviceType').value.trim(),
          floorLevel: document.getElementById('markerFloorLevel').value.trim(),
          location: document.getElementById('markerLocation').value.trim(),
          serviceDate: storeMonthYear(document.getElementById('markerServiceDate').value),
          manufacturingDate: storeMonthYear(document.getElementById('markerManufacturingDate').value),
          markerType: selectedMarkerType || 'pin'
        };
        const markerId = editingMarkerId || `marker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const existingMarker = markers.find((item) => item.id === markerId);
        const existingPhotos = existingMarker
          ? Array.isArray(existingMarker.photos)
            ? existingMarker.photos
            : existingMarker.photoId
              ? [{ id: existingMarker.photoId, name: existingMarker.photoName || 'Saved image' }]
              : []
          : [];
        const photos = existingPhotos.filter((photo) => !removedMarkerPhotoIds.has(photo.id));
        let photoStorageFailed = false;

        for (const photo of pendingMarkerPhotos) {
          try {
            await openDatabase();
            await saveMarkerPhoto(photo.id, photo.file);
            sessionMarkerPhotos.set(photo.id, photo.url);
            const path = await uploadCloudMarkerPhoto(photo.id, photo.file);
            photos.push({ id: photo.id, name: photo.name, path });
          } catch (error) {
            console.error('Unable to save and sync marker photo:', error);
            photoStorageFailed = true;
            sessionMarkerPhotos.set(photo.id, photo.url);
            photos.push({ id: photo.id, name: photo.name, path: null });
          }
        }

        for (const photoId of removedMarkerPhotoIds) {
          try {
            const removedPhoto = existingPhotos.find((photo) => photo.id === photoId);
            if (removedPhoto) await deleteCloudMarkerPhoto(removedPhoto);
            await openDatabase();
            await deleteMarkerPhoto(photoId);
            const cachedUrl = sessionMarkerPhotos.get(photoId);
            if (cachedUrl) URL.revokeObjectURL(cachedUrl);
            sessionMarkerPhotos.delete(photoId);
          } catch (error) {
            console.error('Unable to remove marker photo:', error);
            saveButton.disabled = false;
            announce(error.message || 'Could not remove the marker photo.', true);
            return;
          }
        }

        if (editingMarkerId) {
          if (existingMarker) Object.assign(existingMarker, details, { photos });
        } else if (draftMarkerPoint) {
          markers.push({
            id: markerId,
            ...draftMarkerPoint,
            ...details,
            photos
          });
        }
        closeMarkerEditor();
        renderMarkers();
        const saveResult = await persistMarkersEverywhere();
        if (!saveResult.localSaved) {
          announce('Marker saved for this session, but its details could not be saved to browser storage.', true);
        } else if (!saveResult.cloudSaved) {
          announce('Marker saved on this device, but cloud sync failed. It may not appear on your other devices.', true);
        } else if (photoStorageFailed) {
          announce('Marker synced. Its photo is only available on this device.', true);
        } else {
          announce('Marker synced across devices.');
        }
        if (saveResult.cloudSaved) {
          const savedMarker = markers.find((item) => item.id === markerId);
          logActivity(wasEditing ? 'marker.edit' : 'marker.add',
            `${wasEditing ? 'Edited' : 'Added'} ${describeDevice(savedMarker)}`,
            { layout: layouts[selectedIndex], marker: savedMarker });
        }
        saveButton.disabled = false;
      });

      document.getElementById('markerClose').addEventListener('click', closeMarkerEditor);
      document.getElementById('markerEdit').addEventListener('click', () => {
        const marker = getCurrentMarkers().find((item) => item.id === editingMarkerId);
        if (!marker || !markerPanelPoint) {
          announce('Could not find this marker to edit. Close the details and try again.', true);
          return;
        }
        showMarkerEditor(markerPanelPoint.x, markerPanelPoint.y, marker);
      });
      document.getElementById('photoViewerClose').addEventListener('click', closePhotoViewer);
      document.getElementById('photoZoomIn').addEventListener('click', () => setPhotoZoom(photoZoom * 1.25));
      document.getElementById('photoZoomOut').addEventListener('click', () => setPhotoZoom(photoZoom / 1.25));
      document.getElementById('photoZoomReset').addEventListener('click', () => setPhotoZoom(1));
      photoViewer.addEventListener('click', (event) => {
        if (event.target === photoViewer) closePhotoViewer();
      });
      photoViewerStage.addEventListener('click', () => {
        setPhotoZoom(photoZoom === 1 ? 2 : 1);
      });
      photoViewerStage.addEventListener('wheel', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setPhotoZoom(photoZoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
      }, { passive: false });
      document.getElementById('markerDelete').addEventListener('click', async () => {
        if (!editingMarkerId) return;
        await markerSyncPromise;
        const markers = getCurrentMarkers();
        const markerIndex = markers.findIndex((marker) => marker.id === editingMarkerId);
        const marker = markers[markerIndex];
        const markerPhotos = marker
          ? Array.isArray(marker.photos)
            ? marker.photos
            : marker.photoId ? [{ id: marker.photoId }] : []
          : [];
        try {
          if (markerPhotos.length) await openDatabase();
          for (const photo of markerPhotos) {
            await deleteCloudMarkerPhoto(photo);
            if (photo.id) await deleteMarkerPhoto(photo.id);
          }
        } catch (error) {
          console.error('Unable to delete marker photos:', error);
          announce(error.message || 'Could not delete the marker photos.', true);
          return;
        }
        markerPhotos.forEach((photo) => {
          const cachedUrl = sessionMarkerPhotos.get(photo.id);
          if (cachedUrl) URL.revokeObjectURL(cachedUrl);
          sessionMarkerPhotos.delete(photo.id);
        });
        if (markerIndex !== -1) markers.splice(markerIndex, 1);
        closeMarkerEditor();
        renderMarkers();
        const saveResult = await persistMarkersEverywhere();
        if (!saveResult.localSaved) {
          announce('Marker removed for this session, but the change could not be saved.', true);
        } else if (!saveResult.cloudSaved) {
          announce('Marker removed on this device, but the change could not sync to your other devices.', true);
        } else {
          announce('Marker removed from this layout on all devices.');
          if (marker) logActivity('marker.delete', `Deleted ${describeDevice(marker)}`, { layout: layouts[selectedIndex], marker });
        }
      });

      markerEditor.addEventListener('wheel', (event) => {
        event.stopPropagation();
      }, { passive: true });

      stage.addEventListener('wheel', (event) => {
        if (event.target.closest('.marker-editor')) return;
        event.preventDefault();
        zoomAt(zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15), event.clientX, event.clientY);
      }, { passive: false });

      stage.addEventListener('pointerdown', (event) => {
        if (markerMode || event.button !== 0 ||
          event.target.closest('button, input, select, textarea, label, .marker-editor')) return;
        if (event.pointerType === 'touch') {
          activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          stage.setPointerCapture(event.pointerId);
          if (activePointers.size === 2) {
            drag = null;
            stage.classList.remove('is-dragging');
            const [first, second] = Array.from(activePointers.values());
            const centerX = (first.x + second.x) / 2;
            const centerY = (first.y + second.y) / 2;
            const bounds = stage.getBoundingClientRect();
            const distance = Math.hypot(first.x - second.x, first.y - second.y);
            if (distance > 0) {
              const centerOffsetX = centerX - bounds.left - stage.clientWidth / 2;
              const centerOffsetY = centerY - bounds.top - stage.clientHeight / 2;
              pinch = {
                distance,
                zoom,
                contentX: (centerOffsetX - panX) / zoom,
                contentY: (centerOffsetY - panY) / zoom
              };
            }
            return;
          }
        }
        if (zoom <= 1) return;
        drag = { x: event.clientX, y: event.clientY, panX, panY };
        stage.classList.add('is-dragging');
        stage.setPointerCapture(event.pointerId);
      });
      stage.addEventListener('pointermove', (event) => {
        if (activePointers.has(event.pointerId)) {
          activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pinch && activePointers.size >= 2) {
            const [first, second] = Array.from(activePointers.values());
            const distance = Math.hypot(first.x - second.x, first.y - second.y);
            const centerX = (first.x + second.x) / 2;
            const centerY = (first.y + second.y) / 2;
            const bounds = stage.getBoundingClientRect();
            zoom = Math.min(5, Math.max(1, pinch.zoom * distance / pinch.distance));
            if (zoom === 1) {
              panX = 0;
              panY = 0;
            } else {
              panX = centerX - bounds.left - stage.clientWidth / 2 - pinch.contentX * zoom;
              panY = centerY - bounds.top - stage.clientHeight / 2 - pinch.contentY * zoom;
            }
            updateTransform();
            return;
          }
        }
        if (!drag) return;
        panX = drag.panX + event.clientX - drag.x;
        panY = drag.panY + event.clientY - drag.y;
        updateTransform();
      });
      const endDrag = (event) => {
        if (event && activePointers.has(event.pointerId)) activePointers.delete(event.pointerId);
        pinch = null;
        drag = null;
        stage.classList.remove('is-dragging');
      };
      stage.addEventListener('pointerup', endDrag);
      stage.addEventListener('pointercancel', endDrag);

      accountButton.addEventListener('click', () => {
        const shouldOpen = accountPopover.hidden;
        accountPopover.hidden = !shouldOpen;
        accountButton.setAttribute('aria-expanded', String(shouldOpen));
      });
      accountSignIn.addEventListener('click', showLoginScreen);
      accountSignOut.addEventListener('click', async () => {
        const session = authSession;
        closeAccountPopover();
        clearAuthSession();
        if (!session) return;
        accountSignOut.disabled = true;
        try {
          const response = await fetch(`${authBaseUrl}/auth/v1/logout`, {
            method: 'POST',
            headers: {
              apikey: markerCloudConfig.anonKey,
              Authorization: `Bearer ${session.access_token}`
            }
          });
          if (!response.ok) throw new Error(`The sign-in service returned HTTP ${response.status}.`);
          announce('Signed out of your MQuest account.');
        } catch (error) {
          console.error('Unable to revoke the sign-in session:', error);
          announce('Signed out on this device, but the server could not revoke the session.', true);
        } finally {
          accountSignOut.disabled = false;
        }
      });


      // ---- Sign-in screen: modes, password reset, lockout ---------------------
      const loginTitle = document.getElementById('loginTitle');
      const loginIntro = document.getElementById('loginIntro');
      const loginGuestOptions = document.getElementById('loginGuestOptions');
      const resetRequestForm = document.getElementById('resetRequestForm');
      const resetEmail = document.getElementById('resetEmail');
      const resetRequestFeedback = document.getElementById('resetRequestFeedback');
      const resetRequestSubmit = document.getElementById('resetRequestSubmit');
      const newPasswordForm = document.getElementById('newPasswordForm');
      const newPassword = document.getElementById('newPassword');
      const confirmPassword = document.getElementById('confirmPassword');
      const newPasswordFeedback = document.getElementById('newPasswordFeedback');
      const newPasswordSubmit = document.getElementById('newPasswordSubmit');
      const capsLockHint = document.getElementById('capsLockHint');
      let recoverySession = null;

      const loginModes = {
        signin: {
          title: 'Sign in to your workspace',
          intro: 'Enter your MQuest account details to continue to your project dashboard.',
          form: loginForm
        },
        reset: {
          title: 'Reset your password',
          intro: 'Enter the email for your MQuest account and we will send you a link to choose a new password.',
          form: resetRequestForm
        },
        'new-password': {
          title: 'Choose a new password',
          intro: 'Use at least 8 characters. You will be signed in once it is saved.',
          form: newPasswordForm
        }
      };

      const setFeedback = (element, message, kind = 'error') => {
        element.textContent = message;
        element.hidden = !message;
        element.classList.toggle('is-success', kind === 'success');
      };

      function setLoginMode(mode) {
        const config = loginModes[mode] || loginModes.signin;
        Object.values(loginModes).forEach(({ form }) => { form.hidden = form !== config.form; });
        loginTitle.textContent = config.title;
        loginIntro.textContent = config.intro;
        loginGuestOptions.hidden = mode !== 'signin';
        setLoginFeedback('');
        setFeedback(resetRequestFeedback, '');
        setFeedback(newPasswordFeedback, '');
        capsLockHint.hidden = true;
        document.querySelectorAll('[data-password-toggle]').forEach((button) => {
          document.getElementById(button.dataset.passwordToggle).type = 'password';
          button.setAttribute('aria-pressed', 'false');
          button.setAttribute('aria-label', 'Show password');
        });
        const focusTarget = mode === 'reset' ? resetEmail : mode === 'new-password' ? newPassword : loginUsername;
        window.requestAnimationFrame(() => focusTarget.focus());
      }

      const friendlyAuthError = (error) => {
        const message = String((error && error.message) || '');
        if (error && error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
        if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.';
        if (/email not confirmed/i.test(message)) return 'This account has not been confirmed yet. Please contact your workspace administrator.';
        if (/same.*password|different from the old/i.test(message)) return 'Please choose a password you have not used before.';
        if (/weak|at least/i.test(message)) return message;
        return message || 'Something went wrong. Please try again.';
      };

      // Show / hide password buttons
      document.querySelectorAll('[data-password-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
          const input = document.getElementById(button.dataset.passwordToggle);
          const show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          button.setAttribute('aria-pressed', String(show));
          button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
          input.focus();
        });
      });

      const updateCapsLockHint = (event) => {
        if (typeof event.getModifierState !== 'function') return;
        capsLockHint.hidden = !event.getModifierState('CapsLock');
      };
      loginPassword.addEventListener('keydown', updateCapsLockHint);
      loginPassword.addEventListener('keyup', updateCapsLockHint);
      loginPassword.addEventListener('blur', () => { capsLockHint.hidden = true; });

      // Brief lockout after repeated failed sign-ins (Supabase also rate-limits on the server).
      const loginLockKey = `mquest-parkview-login-lock:${markerCloudSiteId}`;
      const maxLoginAttempts = 5;
      const loginLockMs = 60000;
      let loginLockTimer = null;
      const readLoginLock = () => {
        try {
          const value = JSON.parse(localStorage.getItem(loginLockKey) || '{}');
          return { failures: Number(value.failures) || 0, until: Number(value.until) || 0 };
        } catch (error) {
          return { failures: 0, until: 0 };
        }
      };
      const writeLoginLock = (value) => {
        try { localStorage.setItem(loginLockKey, JSON.stringify(value)); } catch (error) { /* private mode */ }
      };
      const applyLoginLock = () => {
        clearInterval(loginLockTimer);
        const tick = () => {
          const remaining = readLoginLock().until - Date.now();
          if (remaining <= 0) {
            clearInterval(loginLockTimer);
            loginSubmit.disabled = false;
            if (loginFeedback.dataset.lock === 'true') setLoginFeedback('');
            delete loginFeedback.dataset.lock;
            return;
          }
          loginSubmit.disabled = true;
          loginFeedback.dataset.lock = 'true';
          setLoginFeedback(`Too many incorrect attempts. Try again in ${Math.ceil(remaining / 1000)}s.`);
        };
        tick();
        if (readLoginLock().until > Date.now()) loginLockTimer = setInterval(tick, 1000);
      };
      const recordLoginFailure = () => {
        const lock = readLoginLock();
        const failures = lock.failures + 1;
        if (failures >= maxLoginAttempts) {
          writeLoginLock({ failures: 0, until: Date.now() + loginLockMs });
          return true;
        }
        writeLoginLock({ failures, until: 0 });
        return false;
      };

      document.getElementById('forgotPasswordButton').addEventListener('click', () => {
        const typedEmail = loginUsername.value.trim();
        setLoginMode('reset');
        if (typedEmail) resetEmail.value = typedEmail;
      });
      document.querySelectorAll('[data-login-back]').forEach((button) => {
        button.addEventListener('click', () => setLoginMode('signin'));
      });

      resetRequestForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = resetEmail.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setFeedback(resetRequestFeedback, 'Enter a valid email address.');
          return;
        }
        resetRequestSubmit.disabled = true;
        setFeedback(resetRequestFeedback, '');
        try {
          const redirectTo = `${window.location.origin}${window.location.pathname}`;
          await authRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email });
          setFeedback(resetRequestFeedback,
            'If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).', 'success');
        } catch (error) {
          console.error('Unable to request a password reset:', error);
          setFeedback(resetRequestFeedback, friendlyAuthError(error));
        } finally {
          resetRequestSubmit.disabled = false;
        }
      });

      newPasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!recoverySession) {
          setFeedback(newPasswordFeedback, 'This reset link is no longer valid. Request a new one from the sign-in screen.');
          return;
        }
        if (newPassword.value.length < 8) {
          setFeedback(newPasswordFeedback, 'Use at least 8 characters.');
          return;
        }
        if (newPassword.value !== confirmPassword.value) {
          setFeedback(newPasswordFeedback, 'The two passwords do not match.');
          return;
        }
        newPasswordSubmit.disabled = true;
        setFeedback(newPasswordFeedback, '');
        try {
          const user = await authRequest('/auth/v1/user', { password: newPassword.value },
            recoverySession.access_token, 'PUT');
          const session = createAuthSession({ ...recoverySession, user });
          recoverySession = null;
          newPasswordForm.reset();
          setAuthSession(session);
          showProjectWorkspace();
          announce('Password updated. You are now signed in.');
        } catch (error) {
          console.error('Unable to set a new password:', error);
          setFeedback(newPasswordFeedback, friendlyAuthError(error));
        } finally {
          newPasswordSubmit.disabled = false;
        }
      });

      // A password-reset email link returns here with the session in the URL hash.
      const handleAuthRedirect = () => {
        const hash = window.location.hash.replace(/^#/, '');
        if (!hash) return;
        const params = new URLSearchParams(hash);
        const type = params.get('type');
        const error = params.get('error_description') || params.get('error');
        if (!type && !error) return;
        // Remove the tokens from the address bar straight away.
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        if (error) {
          showLoginScreen();
          setLoginMode('reset');
          setFeedback(resetRequestFeedback, /expired|invalid/i.test(error)
            ? 'That reset link has expired or was already used. Request a new one below.'
            : error.replace(/\+/g, ' '));
          return;
        }
        if (type !== 'recovery') return;
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const expiresIn = Number(params.get('expires_in'));
        if (!accessToken || !refreshToken || !Number.isFinite(expiresIn)) return;
        recoverySession = { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn };
        showLoginScreen();
        setLoginMode('new-password');
      };

      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (loginSubmit.disabled) return;
        if (readLoginLock().until > Date.now()) {
          applyLoginLock();
          return;
        }
        setLoginFeedback('');
        loginSubmit.disabled = true;
        loginSubmitLabel.textContent = 'Signing in...';
        try {
          const result = await authRequest('/auth/v1/token?grant_type=password', {
            email: loginUsername.value.trim().toLowerCase(),
            password: loginPassword.value
          });
          const session = createAuthSession(result);
          writeLoginLock({ failures: 0, until: 0 });
          const sessionSaved = setAuthSession(session);
          loginForm.reset();
          setLoginFeedback('');
          showProjectWorkspace();
          if (sessionSaved) announce(`Signed in as ${displayNameFromEmail(session.user.email) || 'User'}.`);
        } catch (error) {
          const locked = error.status === 400 && recordLoginFailure();
          setLoginFeedback(friendlyAuthError(error));
          loginPassword.value = '';
          loginPassword.focus();
          loginSubmit.disabled = false;
          loginSubmitLabel.textContent = 'Login';
          if (locked) applyLoginLock();
          return;
        }
        loginSubmit.disabled = false;
        loginSubmitLabel.textContent = 'Login';
      });
      document.getElementById('continueAsGuest').addEventListener('click', () => {
        loginForm.reset();
        setLoginFeedback('');
        showProjectWorkspace();
      });
      document.addEventListener('click', (event) => {
        if (!accountMenu.contains(event.target)) closeAccountPopover();
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !photoViewer.hidden) {
          event.preventDefault();
          closePhotoViewer();
          return;
        }
        if (event.key === 'Escape' && !accountPopover.hidden) {
          event.preventDefault();
          closeAccountPopover();
          accountButton.focus();
          return;
        }
        if (!photoViewer.hidden) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input, textarea, select') ||
          (!markerEditor.hidden && event.target.closest('.marker-editor'))) return;
        if (event.key === 'ArrowLeft') selectLayout(selectedIndex - 1);
        if (event.key === 'ArrowRight') selectLayout(selectedIndex + 1);
        if (event.key === '+' || event.key === '=') zoomAt(zoom * 1.25);
        if (event.key === '-') zoomAt(zoom / 1.25);
        if (event.key === 'Escape') {
          closeMarkerEditor();
          resetView();
        }
      });

      image.addEventListener('load', renderMarkers);
      new ResizeObserver(renderMarkers).observe(stage);
      // =====================================================================
      // Sidebar · tool panels · device search
      // =====================================================================
      const appSidebar = document.getElementById('appSidebar');
      const sidebarBackdrop = document.getElementById('sidebarBackdrop');
      const sidebarMenuButton = document.getElementById('sidebarMenuButton');
      const sidebarCollapse = document.getElementById('sidebarCollapse');
      const sidePanel = document.getElementById('sidePanel');
      const sidePanelTitle = document.getElementById('sidePanelTitle');
      const sidePanelEyebrow = document.getElementById('sidePanelEyebrow');
      const sidePanelBody = document.getElementById('sidePanelBody');
      const drawerQuery = window.matchMedia('(max-width: 850px)');
      const sidebarCollapsedKey = 'mquest-parkview-sidebar-collapsed';

      // Small DOM helper: el('div', { className: 'x', text: 'hi' }, child, child)
      const el = (tag, props = {}, ...children) => {
        const node = document.createElement(tag);
        Object.entries(props).forEach(([key, value]) => {
          if (value === undefined || value === null || value === false) return;
          if (key === 'text') node.textContent = value;
          else if (key === 'className') node.className = value;
          else if (key === 'dataset') Object.assign(node.dataset, value);
          else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
          else node.setAttribute(key, value === true ? '' : value);
        });
        children.flat().forEach((child) => {
          if (child !== null && child !== undefined && child !== false) node.append(child);
        });
        return node;
      };

      const formatDuration = (totalSeconds) => {
        const seconds = Math.max(0, Math.floor(totalSeconds || 0));
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const sec = seconds % 60;
        if (h) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
        if (m) return `${m}m ${String(sec).padStart(2, '0')}s`;
        return `${sec}s`;
      };

      const formatAgo = (date) => {
        const seconds = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
        if (!Number.isFinite(seconds)) return '—';
        if (seconds < 10) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours} h ago`;
        const days = Math.round(hours / 24);
        if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
        return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      };

      const formatDateTime = (date) => new Date(date).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      // ---- Sidebar: mobile drawer + desktop collapse -------------------------
      const sidebarIsDrawer = () => drawerQuery.matches;

      function setSidebarOpen(open) {
        document.body.classList.toggle('sidebar-open', open);
        sidebarBackdrop.hidden = !open;
        sidebarMenuButton.setAttribute('aria-expanded', String(open));
        sidebarMenuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      }

      const setSidebarCollapsed = (collapsed) => {
        document.body.classList.toggle('sidebar-collapsed', collapsed);
        sidebarCollapse.setAttribute('aria-pressed', String(collapsed));
        sidebarCollapse.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
        sidebarCollapse.querySelector('.nav-label').textContent = collapsed ? 'Expand' : 'Collapse';
        try { localStorage.setItem(sidebarCollapsedKey, collapsed ? '1' : '0'); } catch (error) { /* ignore */ }
        window.requestAnimationFrame(renderMarkers);
      };

      try {
        if (localStorage.getItem(sidebarCollapsedKey) === '1') setSidebarCollapsed(true);
      } catch (error) { /* ignore */ }

      sidebarMenuButton.addEventListener('click', () => setSidebarOpen(!document.body.classList.contains('sidebar-open')));
      sidebarBackdrop.addEventListener('click', () => {
        setSidebarOpen(false);
        closePanel();
      });
      sidebarCollapse.addEventListener('click', () => {
        if (sidebarIsDrawer()) {
          setSidebarOpen(false);
          return;
        }
        setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
      });
      drawerQuery.addEventListener('change', () => setSidebarOpen(false));
      document.getElementById('breadcrumbProjects').addEventListener('click', () => {
        if (sidebarIsDrawer()) setSidebarOpen(true);
        else if (document.body.classList.contains('sidebar-collapsed')) setSidebarCollapsed(false);
        window.requestAnimationFrame(() => document.querySelector('#projectList .sidebar-item')?.focus());
      });

      // ---- Data helpers -------------------------------------------------------
      const devicesInProject = (project = activeProject) => project.layouts.flatMap((layout, layoutIndex) =>
        (markersByLayout.get(layout.id) || []).map((marker) => ({ marker, layout, layoutIndex, project })));
      const devicesEverywhere = () => getActiveProjects().flatMap((project) => devicesInProject(project));

      // Badge coloured by marker type: code on top, Device ID below.
      const deviceBadge = (marker) => {
        const type = markerTypeOf(marker);
        const badge = el('span', {
          className: `device-badge type-${type || 'pin'}${marker.deviceId ? '' : ' is-empty'}`,
          title: type ? MARKER_TYPES[type].label : 'Marker'
        });
        if (type) badge.append(el('small', { className: 'device-badge-code', text: MARKER_TYPES[type].code }));
        badge.append(el('span', { className: 'device-badge-id', text: marker.deviceId ? String(marker.deviceId) : '—' }));
        return badge;
      };

      const deviceRow = (entry, { showProject = false, extra = null } = {}) => {
        const { marker, layout, project } = entry;
        const meta = [marker.floorLevel, marker.location, marker.deviceType].filter(Boolean).join(' · ') || 'No details yet';
        return el('li', {},
          el('button', {
            type: 'button',
            className: 'device-row',
            onclick: () => focusMarker(layout.id, marker.id)
          },
          deviceBadge(marker),
          el('span', { className: 'device-row-copy' },
            el('strong', { text: marker.product || 'Unnamed device' }),
            el('small', { text: meta }),
            el('small', { className: 'device-row-where', text: showProject ? `${project.name} › ${layout.name}` : layout.name })
          ),
          extra));
      };

      const emptyState = (title, copy) => el('div', { className: 'panel-empty' },
        el('strong', { text: title }), copy ? el('p', { text: copy }) : null);

      // ---- Fly to a device on the plan ---------------------------------------
      const waitForPlanImage = () => new Promise((resolve) => {
        if (image.complete && image.naturalWidth) {
          window.requestAnimationFrame(() => resolve());
          return;
        }
        const done = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(done, 4000);
        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
      });

      const focusMarker = async (layoutId, markerId) => {
        const project = getActiveProjects().find((item) => item.layouts.some((layout) => layout.id === layoutId));
        if (!project) return;
        if (project !== activeProject) selectProject(project.id);
        const index = layouts.findIndex((layout) => layout.id === layoutId);
        if (index === -1) return;
        if (index !== selectedIndex) selectLayout(index);
        else closeMarkerEditor();
        setMarkerMode(false);
        setMarkerMoveMode(false);
        if (sidebarIsDrawer()) {
          closePanel();
          setSidebarOpen(false);
        }
        await waitForPlanImage();
        const marker = (markersByLayout.get(layoutId) || []).find((item) => item.id === markerId);
        const bounds = getImageBounds();
        if (!marker || !bounds) {
          announce('That device could not be found on its layout.', true);
          return;
        }
        // Zoom in and place the device left of centre, leaving room for its details.
        const width = stage.clientWidth;
        const height = stage.clientHeight;
        const markerX = bounds.left + marker.x * bounds.width;
        const markerY = bounds.top + marker.y * bounds.height;
        const targetX = width > 700 ? width * 0.3 : width / 2;
        const targetY = width > 700 ? height * 0.42 : height * 0.3;
        zoom = Math.max(zoom, 2.5);
        panX = targetX - width / 2 - (markerX - width / 2) * zoom;
        panY = targetY - height / 2 - (markerY - height / 2) * zoom;
        stage.classList.add('is-flying');
        updateTransform();
        setTimeout(() => stage.classList.remove('is-flying'), 650);
        setTimeout(() => {
          const pin = Array.from(markerLayer.querySelectorAll('.map-marker'))
            .find((item) => item.dataset.markerId === markerId);
          if (pin) pin.click();
        }, 560);
      };

      // ---- Device search (viewer toolbar) ------------------------------------
      const deviceSearchInput = document.getElementById('deviceSearchInput');
      const deviceSearchResults = document.getElementById('deviceSearchResults');
      let deviceSearchMatches = [];
      let deviceSearchActive = -1;

      const matchDevices = (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const scored = devicesEverywhere().map((entry) => {
          const id = String(entry.marker.deviceId || '').toLowerCase();
          const name = String(entry.marker.product || '').toLowerCase();
          let score = -1;
          if (id === q) score = 0;
          else if (id.startsWith(q)) score = 1;
          else if (id.includes(q)) score = 2;
          else if (name.includes(q)) score = 3;
          if (score >= 0 && entry.project !== activeProject) score += 10;
          return { entry, score };
        }).filter((item) => item.score >= 0);
        scored.sort((a, b) => a.score - b.score ||
          String(a.entry.marker.deviceId).localeCompare(String(b.entry.marker.deviceId), undefined, { numeric: true }));
        return scored.slice(0, 8).map((item) => item.entry);
      };

      const closeDeviceSearch = () => {
        deviceSearchResults.hidden = true;
        deviceSearchInput.setAttribute('aria-expanded', 'false');
        deviceSearchInput.removeAttribute('aria-activedescendant');
        deviceSearchActive = -1;
      };

      const highlightDeviceResult = (index) => {
        deviceSearchActive = index;
        deviceSearchResults.querySelectorAll('[role="option"]').forEach((option, i) => {
          option.setAttribute('aria-selected', String(i === index));
          if (i === index) {
            deviceSearchInput.setAttribute('aria-activedescendant', option.id);
            option.scrollIntoView({ block: 'nearest' });
          }
        });
      };

      const chooseDeviceResult = (entry) => {
        closeDeviceSearch();
        deviceSearchInput.value = '';
        deviceSearchInput.blur();
        focusMarker(entry.layout.id, entry.marker.id);
      };

      const renderDeviceSearch = () => {
        deviceSearchMatches = matchDevices(deviceSearchInput.value);
        deviceSearchResults.replaceChildren();
        if (!deviceSearchInput.value.trim()) {
          closeDeviceSearch();
          return;
        }
        if (!deviceSearchMatches.length) {
          deviceSearchResults.append(el('li', { className: 'device-search-empty', text: `No device matches "${deviceSearchInput.value.trim()}"` }));
        }
        deviceSearchMatches.forEach((entry, index) => {
          const { marker, layout, project } = entry;
          deviceSearchResults.append(el('li', {
            id: `device-option-${index}`,
            role: 'option',
            'aria-selected': 'false',
            className: 'device-search-option',
            onmousedown: (event) => event.preventDefault(),
            onclick: () => chooseDeviceResult(entry)
          },
          deviceBadge(marker),
          el('span', { className: 'device-row-copy' },
            el('strong', { text: marker.product || 'Unnamed device' }),
            el('small', { text: `${project === activeProject ? '' : `${project.name} › `}${layout.name}${marker.floorLevel ? ` · ${marker.floorLevel}` : ''}` }))));
        });
        deviceSearchResults.hidden = false;
        deviceSearchInput.setAttribute('aria-expanded', 'true');
        if (deviceSearchMatches.length) highlightDeviceResult(0);
      };

      deviceSearchInput.addEventListener('input', renderDeviceSearch);
      deviceSearchInput.addEventListener('focus', () => { if (deviceSearchInput.value.trim()) renderDeviceSearch(); });
      deviceSearchInput.addEventListener('blur', () => setTimeout(closeDeviceSearch, 120));
      deviceSearchInput.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' && deviceSearchMatches.length) {
          event.preventDefault();
          highlightDeviceResult((deviceSearchActive + 1) % deviceSearchMatches.length);
        } else if (event.key === 'ArrowUp' && deviceSearchMatches.length) {
          event.preventDefault();
          highlightDeviceResult((deviceSearchActive - 1 + deviceSearchMatches.length) % deviceSearchMatches.length);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          const entry = deviceSearchMatches[Math.max(0, deviceSearchActive)];
          if (entry) chooseDeviceResult(entry);
        } else if (event.key === 'Escape') {
          event.stopPropagation();
          deviceSearchInput.value = '';
          closeDeviceSearch();
          deviceSearchInput.blur();
        }
      });

      // ---- Tool panels -------------------------------------------------------
      let currentPanel = null;
      let panelTimer = null;
      let panelReturnFocus = null;

      const panelDefinitions = {
        devices: { title: 'Devices', eyebrow: 'Tools', render: () => renderDevicesPanel() },
        inspections: { title: 'Inspection schedule', eyebrow: 'Tools', render: () => renderInspectionsPanel() },
        activity: { title: 'Activity log', eyebrow: 'Tools', render: () => renderActivityPanel() },
        reports: { title: 'Reports', eyebrow: 'Tools', render: () => renderReportsPanel() },
        users: { title: 'Users', eyebrow: 'Owner', render: () => renderUsersPanel() },
        settings: { title: 'Settings & Help', eyebrow: 'Workspace', render: () => renderSettingsPanel() }
      };

      const setPanelButtons = () => {
        document.querySelectorAll('[data-panel]').forEach((button) => {
          const isOpen = button.dataset.panel === currentPanel;
          button.classList.toggle('active', isOpen);
          button.setAttribute('aria-expanded', String(isOpen));
        });
      };

      const openPanel = (name) => {
        const definition = panelDefinitions[name];
        if (!definition) return;
        if (currentPanel === name) {
          closePanel();
          return;
        }
        clearInterval(panelTimer);
        panelTimer = null;
        onPresenceUpdated = null;
        if (!currentPanel) panelReturnFocus = document.activeElement;
        currentPanel = name;
        sidePanelTitle.textContent = definition.title;
        sidePanelEyebrow.textContent = definition.eyebrow;
        sidePanelBody.replaceChildren();
        sidePanel.hidden = false;
        sidePanel.classList.remove('is-entering');
        void sidePanel.offsetWidth;
        sidePanel.classList.add('is-entering');
        document.body.classList.add('panel-open');
        if (sidebarIsDrawer()) setSidebarOpen(false);
        setPanelButtons();
        definition.render();
        window.requestAnimationFrame(() => document.getElementById('sidePanelClose').focus({ preventScroll: true }));
      };

      function closePanel() {
        if (!currentPanel) return;
        clearInterval(panelTimer);
        panelTimer = null;
        onPresenceUpdated = null;
        currentPanel = null;
        sidePanel.hidden = true;
        document.body.classList.remove('panel-open');
        setPanelButtons();
        if (panelReturnFocus instanceof HTMLElement && panelReturnFocus.isConnected) panelReturnFocus.focus({ preventScroll: true });
        panelReturnFocus = null;
      }

      // Re-draw lists when the marker data or the active project actually changes.
      let markerDataSignature = '';
      const refreshOpenPanel = () => {
        if (currentPanel === 'devices') renderDevicesPanel();
        else if (currentPanel === 'inspections') renderInspectionsPanel();
        else if (currentPanel === 'reports') renderReportsPanel();
      };
      panelDataHook = () => {
        const signature = `${activeProject.id}|${getActiveProjects().map((project) => project.layouts.map((layout) =>
          `${layout.id}:${JSON.stringify(markersByLayout.get(layout.id) || [])}`).join(',')).join(';')}`;
        if (signature === markerDataSignature) return;
        const firstRun = !markerDataSignature;
        markerDataSignature = signature;
        if (firstRun) return;
        renderProjectList();
        renderList();
        const typingInPanel = sidePanel.contains(document.activeElement) && document.activeElement.matches('input, select');
        if (currentPanel === 'devices' && typingInPanel) renderDeviceList();
        else refreshOpenPanel();
      };

      document.querySelectorAll('[data-panel]').forEach((button) => {
        button.addEventListener('click', () => openPanel(button.dataset.panel));
      });
      document.getElementById('sidePanelClose').addEventListener('click', closePanel);

      // ---- Devices panel -----------------------------------------------------
      const deviceFilters = { text: '', type: '', floor: '', venue: '' };
      let deviceListContainer = null;
      let deviceCountLabel = null;

      const uniqueValues = (entries, key) => Array.from(new Set(entries.map(({ marker }) => (marker[key] || '').trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const renderDeviceList = () => {
        if (!deviceListContainer) return;
        const text = deviceFilters.text.trim().toLowerCase();
        const entries = devicesInProject().filter(({ marker }) =>
          (!deviceFilters.type || (markerTypeOf(marker) || 'pin') === deviceFilters.type) &&
          (!deviceFilters.floor || marker.floorLevel === deviceFilters.floor) &&
          (!deviceFilters.venue || marker.location === deviceFilters.venue) &&
          (!text || [marker.deviceId, marker.product, marker.deviceType, marker.floorLevel, marker.location]
            .some((value) => String(value || '').toLowerCase().includes(text))))
          .sort((a, b) => String(a.marker.deviceId || '~').localeCompare(String(b.marker.deviceId || '~'), undefined, { numeric: true }));
        deviceCountLabel.textContent = `${entries.length} of ${devicesInProject().length} devices in ${activeProject.name}`;
        deviceListContainer.replaceChildren();
        if (!entries.length) {
          deviceListContainer.append(emptyState('No devices found', devicesInProject().length
            ? 'Try a different search or clear the filters.'
            : 'Markers you place on this project\'s layouts will appear here.'));
          return;
        }
        deviceListContainer.append(el('ul', { className: 'device-list' }, entries.map((entry) => deviceRow(entry))));
      };

      const renderDevicesPanel = () => {
        const entries = devicesInProject();
        const filterSelect = (key, label, values) => {
          if (deviceFilters[key] && !values.includes(deviceFilters[key])) deviceFilters[key] = '';
          return el('label', { className: 'panel-select' },
            el('span', { text: label }),
            el('select', {
              onchange: (event) => { deviceFilters[key] = event.target.value; renderDeviceList(); }
            },
            el('option', { value: '', text: `All` }),
            values.map((value) => el('option', { value, text: value, selected: deviceFilters[key] === value }))));
        };
        const search = el('input', {
          type: 'search',
          className: 'panel-search',
          placeholder: 'Search ID, name, type, floor, venue…',
          'aria-label': 'Search devices',
          value: deviceFilters.text,
          oninput: (event) => { deviceFilters.text = event.target.value; renderDeviceList(); }
        });
        deviceCountLabel = el('p', { className: 'panel-count' });
        deviceListContainer = el('div', { className: 'panel-list-wrap' });
        sidePanelBody.replaceChildren(
          search,
          el('div', { className: 'panel-filters' },
            el('label', { className: 'panel-select' },
              el('span', { text: 'Marker' }),
              el('select', { onchange: (event) => { deviceFilters.type = event.target.value; renderDeviceList(); } },
                el('option', { value: '', text: 'All' }),
                [...MARKER_TYPE_ORDER, 'pin'].filter((type) => entries.some(({ marker }) => (markerTypeOf(marker) || 'pin') === type))
                  .map((type) => el('option', {
                    value: type,
                    selected: deviceFilters.type === type,
                    text: type === 'pin' ? 'Other' : `${MARKER_TYPES[type].code} · ${MARKER_TYPES[type].label}`
                  })))),
            filterSelect('floor', 'Floor', uniqueValues(entries, 'floorLevel')),
            filterSelect('venue', 'Venue', uniqueValues(entries, 'location'))),
          deviceCountLabel,
          deviceListContainer
        );
        renderDeviceList();
      };

      // ---- Inspection schedule ----------------------------------------------
      const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = (date) => date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

      const renderInspectionsPanel = () => {
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const entries = devicesInProject();
        const due = (date) => entries.filter(({ marker }) => String(marker.serviceDate || '').slice(0, 7) === monthKey(date))
          .sort((a, b) => String(a.marker.deviceId).localeCompare(String(b.marker.deviceId), undefined, { numeric: true }));
        const withoutDate = entries.filter(({ marker }) => !marker.serviceDate).length;
        const group = (title, date) => {
          const items = due(date);
          return el('section', { className: 'panel-group' },
            el('h3', { className: 'panel-group-title' },
              el('span', { text: title }),
              el('small', { text: monthLabel(date) }),
              el('em', { className: 'panel-group-count', text: String(items.length) })),
            items.length
              ? el('ul', { className: 'device-list' }, items.map((entry) => deviceRow(entry, {
                extra: el('span', { className: 'date-pill', text: formatMonthYear(entry.marker.serviceDate) })
              })))
              : emptyState(`Nothing due in ${monthLabel(date)}`, null));
        };
        sidePanelBody.replaceChildren(
          el('p', { className: 'panel-intro', text: `Devices in ${activeProject.name} with a Next Inspection Date in the next two months.` }),
          group('This month', thisMonth),
          group('Next month', nextMonth),
          withoutDate ? el('p', { className: 'panel-note', text: `${withoutDate} ${withoutDate === 1 ? 'device has' : 'devices have'} no inspection date set.` }) : null
        );
      };

      // ---- Activity log -----------------------------------------------------
      const activityIcons = {
        add: 'M12 5v14M5 12h14',
        edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z',
        move: 'M12 3v18M3 12h18m-15-4-3 4 3 4m12-8 3 4-3 4M8 6l4-3 4 3M8 18l4 3 4-3',
        delete: 'M4 7h16M10 11v6m4-6v6M5.5 7l1 14h13l1-14M9 7V4h6v3',
        rename: 'M4 7V4h16v3M9 20h6M12 4v16',
        create: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10v6m-3-3h6'
      };
      const svgIcon = (path) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.9');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', path);
        svg.append(p);
        return svg;
      };

      const renderActivityPanel = async () => {
        if (!authSession) {
          sidePanelBody.replaceChildren(emptyState('Sign in to see activity', 'The activity log shows who added, moved, edited or deleted devices and layouts.'));
          return;
        }
        const list = el('div', { className: 'panel-list-wrap' }, el('p', { className: 'panel-loading', text: 'Loading activity…' }));
        sidePanelBody.replaceChildren(
          el('p', { className: 'panel-intro', text: 'The latest 100 changes on this site, newest first.' }),
          list);
        const load = async () => {
          if (currentPanel !== 'activity') return;
          try {
            const query = new URLSearchParams({
              site_id: `eq.${markerCloudSiteId}`,
              order: 'created_at.desc',
              limit: '100'
            });
            const response = await supabaseFetch(`${getMarkerCloudRestUrl()}/parkview_activity?${query}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const rows = await response.json();
            if (currentPanel !== 'activity') return;
            list.replaceChildren();
            if (!rows.length) {
              list.append(emptyState('No activity yet', 'Changes made by editors will show up here.'));
              return;
            }
            list.append(el('ol', { className: 'activity-list' }, rows.map((row) => {
              const verb = String(row.action || '').split('.')[1] || 'edit';
              return el('li', { className: `activity-item is-${verb}` },
                el('span', { className: 'activity-icon' }, svgIcon(activityIcons[verb] || activityIcons.edit)),
                el('div', { className: 'activity-copy' },
                  el('strong', { text: row.summary }),
                  el('small', { text: [row.project_name, row.layout_name].filter(Boolean).join(' › ') }),
                  el('small', { className: 'activity-meta' },
                    el('span', { text: row.user_name }),
                    el('span', { text: ' · ' }),
                    el('time', { datetime: row.created_at, title: formatDateTime(row.created_at), text: formatAgo(row.created_at) }))));
            })));
          } catch (error) {
            list.replaceChildren(emptyState('Activity log unavailable', 'Run the latest supabase.sql in Supabase to turn on the activity log.'));
          }
        };
        await load();
        panelTimer = setInterval(load, 15000);
      };

      // ---- Reports ----------------------------------------------------------
      let reportScope = 'project';
      const reportColumns = [
        ['Project', (e) => e.project.name],
        ['Layout', (e) => e.layout.name],
        ['Device ID', (e) => e.marker.deviceId],
        ['Marker Type', (e) => { const type = markerTypeOf(e.marker); return type ? `${MARKER_TYPES[type].code} – ${MARKER_TYPES[type].label}` : 'Other'; }],
        ['Device Name', (e) => e.marker.product],
        ['Floor Level', (e) => e.marker.floorLevel],
        ['Venue', (e) => e.marker.location],
        ['Device Type', (e) => e.marker.deviceType],
        ['Next Inspection', (e) => formatMonthYear(e.marker.serviceDate)],
        ['Manufacturing Date', (e) => formatMonthYear(e.marker.manufacturingDate)],
        ['Photos', (e) => (Array.isArray(e.marker.photos) ? e.marker.photos.length : 0)]
      ];
      const reportEntries = () => (reportScope === 'all' ? devicesEverywhere() : devicesInProject())
        .sort((a, b) => a.project.name.localeCompare(b.project.name) || a.layoutIndex - b.layoutIndex ||
          String(a.marker.deviceId).localeCompare(String(b.marker.deviceId), undefined, { numeric: true }));
      const reportFileName = (ext) => {
        const scopeName = reportScope === 'all' ? 'all-projects' : activeProject.name;
        const slug = scopeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
        return `mquest-devices-${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      };

      const downloadCsv = () => {
        const entries = reportEntries();
        const cell = (value) => {
          let text = String(value ?? '');
          if (/^[=+\-@]/.test(text)) text = `'${text}`; // stop spreadsheet formulas
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };
        const lines = [reportColumns.map(([title]) => cell(title)).join(',')]
          .concat(entries.map((entry) => reportColumns.map(([, get]) => cell(get(entry))).join(',')));
        const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = el('a', { href: url, download: reportFileName('csv') });
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        announce(`Exported ${entries.length} ${entries.length === 1 ? 'device' : 'devices'} to CSV.`);
      };

      const printReport = () => {
        const entries = reportEntries();
        const title = reportScope === 'all' ? 'All projects' : activeProject.name;
        const win = window.open('', '_blank');
        if (!win) {
          announce('Allow pop-ups for this site to print or save the report as PDF.', true);
          return;
        }
        const rows = entries.map((entry) => `<tr>${reportColumns.map(([, get]) => `<td>${escapeHtml(String(get(entry) ?? ''))}</td>`).join('')}</tr>`).join('');
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(`Device register – ${title}`)}</title>
<style>
  body { margin: 32px; color: #0b1220; font: 12px/1.45 Inter, "Segoe UI", Arial, sans-serif; }
  header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 3px solid #1677d2; }
  h1 { margin: 0; font-size: 22px; } p { margin: 4px 0 0; color: #5b6b80; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 8px; color: #fff; background: #0b1220; font-size: 10px; letter-spacing: .05em; text-align: left; text-transform: uppercase; }
  td { padding: 7px 8px; border-bottom: 1px solid #e3e9f1; vertical-align: top; }
  tr:nth-child(even) td { background: #f5f8fc; }
  @page { size: A4 landscape; margin: 14mm; }
  @media print { body { margin: 0; } }
</style></head><body>
<header><div><h1>Device register</h1><p>${escapeHtml(title)} · ${entries.length} devices</p></div>
<p>MQuest · ${escapeHtml(new Date().toLocaleString('en-GB'))}</p></header>
<table><thead><tr>${reportColumns.map(([t]) => `<th>${escapeHtml(t)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${reportColumns.length}">No devices.</td></tr>`}</tbody></table>
</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
      };

      const renderReportsPanel = () => {
        const projectDevices = devicesInProject();
        const allDevices = devicesEverywhere();
        const withDates = projectDevices.filter(({ marker }) => marker.serviceDate).length;
        const stat = (value, label) => el('div', { className: 'stat-card' }, el('strong', { text: String(value) }), el('span', { text: label }));
        const scopeButton = (value, label) => el('button', {
          type: 'button',
          className: `segmented-option${reportScope === value ? ' active' : ''}`,
          'aria-pressed': String(reportScope === value),
          onclick: () => { reportScope = value; renderReportsPanel(); }
        }, label);
        sidePanelBody.replaceChildren(
          el('div', { className: 'stat-grid' },
            stat(projectDevices.length, 'Devices in project'),
            stat(activeProject.layouts.length, 'Layouts'),
            stat(withDates, 'With inspection date'),
            stat(allDevices.length, 'Devices, all projects')),
          el('h3', { className: 'panel-subheading', text: 'Device register' }),
          el('p', { className: 'panel-intro', text: 'Every device with its layout, location, type and dates.' }),
          el('div', { className: 'segmented', role: 'group', 'aria-label': 'Report scope' },
            scopeButton('project', `This project (${projectDevices.length})`),
            scopeButton('all', `All projects (${allDevices.length})`)),
          el('div', { className: 'panel-actions' },
            el('button', { type: 'button', className: 'panel-button primary', onclick: downloadCsv }, 'Download CSV'),
            el('button', { type: 'button', className: 'panel-button', onclick: printReport }, 'Print / Save as PDF')),
          el('p', { className: 'panel-note', text: 'CSV opens in Excel or Google Sheets. For PDF, choose "Save as PDF" in the print window.' })
        );
      };

      // ---- Users (owner only) -----------------------------------------------
      let usersTab = 'users';
      let usersData = [];
      let usersError = '';

      const renderUsersPanel = async () => {
        if (!isWorkspaceOwner()) {
          sidePanelBody.replaceChildren(emptyState('Owners only', 'Sign in with a workspace owner account to see users and guests.'));
          return;
        }
        const summary = el('div', { className: 'stat-grid' });
        const tabs = el('div', { className: 'segmented', role: 'tablist', 'aria-label': 'User type' });
        const listWrap = el('div', { className: 'panel-list-wrap' }, el('p', { className: 'panel-loading', text: 'Loading users…' }));
        sidePanelBody.replaceChildren(summary, tabs, listWrap,
          el('details', { className: 'panel-help' },
            el('summary', { text: 'How do I add a new user?' }),
            el('ol', {},
              el('li', { text: 'In Supabase, open Authentication → Users → Add user, and send them an invite (or create them with a password).' }),
              el('li', { text: 'Ask them to sign in once. They then appear here as a Viewer.' }),
              el('li', { text: 'Change their role here. It applies the next time they sign in, or within an hour.' }))));

        const onlineMap = () => new Map(latestPresenceRows.map((row) => [row.user_id, row]));
        // Active time ticks live for online users between database updates.
        const liveSeconds = (user, online) => {
          const base = Number(user.total_active_seconds) || 0;
          if (!online) return base;
          const since = (Date.now() - new Date(user.last_seen_at).getTime()) / 1000;
          return base + Math.min(45, Math.max(0, since));
        };

        const draw = () => {
          if (currentPanel !== 'users') return;
          const online = onlineMap();
          const members = usersData.filter((user) => user.role !== 'guest');
          const guests = usersData.filter((user) => user.role === 'guest');
          const membersOnline = members.filter((user) => online.has(user.user_id)).length;
          const guestsOnline = guests.filter((user) => online.has(user.user_id)).length;
          const guestSeconds = guests.reduce((sum, user) => sum + liveSeconds(user, online.has(user.user_id)), 0);
          const stat = (value, label, live) => el('div', { className: `stat-card${live ? ' is-live' : ''}` },
            el('strong', { text: String(value) }), el('span', { text: label }));
          summary.replaceChildren(
            stat(members.length, 'Signed-in users'),
            stat(membersOnline, 'Users online now', membersOnline > 0),
            stat(guests.length, 'Guests (all time)'),
            stat(guestsOnline, 'Guests online now', guestsOnline > 0));

          const tab = (value, label) => el('button', {
            type: 'button',
            role: 'tab',
            className: `segmented-option${usersTab === value ? ' active' : ''}`,
            'aria-selected': String(usersTab === value),
            onclick: () => { usersTab = value; draw(); }
          }, label);
          tabs.replaceChildren(tab('users', `Users (${members.length})`), tab('guests', `Guests (${guests.length})`));

          listWrap.replaceChildren();
          if (usersError) {
            listWrap.append(emptyState('Could not load users', usersError));
            return;
          }
          const people = (usersTab === 'users' ? members : guests).slice().sort((a, b) =>
            Number(online.has(b.user_id)) - Number(online.has(a.user_id)) ||
            new Date(b.last_seen_at) - new Date(a.last_seen_at));
          if (!people.length) {
            listWrap.append(emptyState(usersTab === 'users' ? 'No users yet' : 'No guests yet',
              usersTab === 'users' ? 'People appear here after they sign in.' : 'Visitors who use "Continue as a Guest" appear here.'));
            return;
          }
          if (usersTab === 'guests') {
            listWrap.append(el('div', { className: 'guest-tools' },
              el('p', { className: 'panel-count', text: `Total guest time: ${formatDuration(guestSeconds)}` }),
              el('button', {
                type: 'button',
                className: 'panel-button danger',
                onclick: async (event) => {
                  if (!window.confirm('Clear all guest history? Guest numbers restart at Guest #1. Signed-in users are not affected.')) return;
                  const button = event.currentTarget;
                  button.disabled = true;
                  try {
                    const response = await supabaseFetch(`${getMarkerCloudRestUrl()}/rpc/parkview_clear_guests`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: '{}'
                    });
                    if (!response.ok) throw new Error(response.status === 404 ? 'Run the latest supabase.sql first.' : `HTTP ${response.status}`);
                    const removed = await response.json();
                    announce(`Cleared ${removed} ${removed === 1 ? 'guest' : 'guests'}. Numbering restarts at Guest #1.`);
                    await load();
                  } catch (error) {
                    announce(`Could not clear guests: ${error.message}`, true);
                    button.disabled = false;
                  }
                }
              }, 'Clear guest history')));
          }
          listWrap.append(el('ul', { className: 'user-list' }, people.map((user) => {
            const presence = online.get(user.user_id);
            const isOnline = Boolean(presence);
            const isMe = authSession && user.user_id === authSession.user.id;
            const name = user.display_name || 'User';
            let roleControl = null;
            if (usersTab === 'users') {
              roleControl = el('select', {
                className: 'role-select',
                'aria-label': `Role for ${name}`,
                disabled: isMe,
                title: isMe ? 'You cannot change your own role' : 'Change role',
                onchange: async (event) => {
                  const select = event.target;
                  const role = select.value;
                  select.disabled = true;
                  try {
                    const response = await supabaseFetch(`${getMarkerCloudRestUrl()}/rpc/parkview_set_user_role`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ p_user_id: user.user_id, p_role: role })
                    });
                    if (!response.ok) {
                      const detail = await response.json().catch(() => ({}));
                      throw new Error(detail.message || `HTTP ${response.status}`);
                    }
                    user.role = role;
                    announce(`${name} is now ${role === 'owner' ? 'an owner' : `an ${role}`}. It applies when they next sign in (within an hour).`);
                  } catch (error) {
                    select.value = user.role;
                    announce(`Could not change the role: ${error.message}`, true);
                  } finally {
                    select.disabled = isMe;
                  }
                }
              }, ['viewer', 'editor', 'owner'].map((role) => el('option', {
                value: role,
                selected: user.role === role,
                text: role.charAt(0).toUpperCase() + role.slice(1)
              })));
            }
            return el('li', { className: `user-card${isOnline ? ' is-online' : ''}` },
              el('div', { className: 'user-card-head' },
                el('span', { className: 'user-avatar', style: `background:${nameColorHash(name)}`, 'aria-hidden': 'true',
                  text: name.replace(/^Guest #/, '#').charAt(0).toUpperCase() === '#' ? 'G' : name.charAt(0).toUpperCase() }),
                el('div', { className: 'user-card-name' },
                  el('strong', {}, name, isMe ? el('span', { className: 'user-you', text: 'You' }) : null),
                  el('small', { text: user.email || (usersTab === 'guests' ? `${user.visit_count || 1} ${Number(user.visit_count) === 1 ? 'visit' : 'visits'}` : '') })),
                roleControl),
              el('div', { className: 'user-card-status' },
                el('span', { className: `status-pill${isOnline ? ' online' : ''}` },
                  el('i', { 'aria-hidden': 'true' }),
                  isOnline ? `Online · ${presence.layout_name || 'Dashboard'}` : 'Offline')),
              el('dl', { className: 'user-stats' },
                el('div', {}, el('dt', { text: 'Active time' }),
                  el('dd', { className: 'user-active-time', dataset: { userId: user.user_id }, text: formatDuration(liveSeconds(user, isOnline)) })),
                el('div', {}, el('dt', { text: 'Last active' }),
                  el('dd', { title: formatDateTime(user.last_seen_at), text: isOnline ? 'Now' : formatAgo(user.last_seen_at) })),
                el('div', {}, el('dt', { text: 'First seen' }),
                  el('dd', { title: formatDateTime(user.first_seen_at || user.created_at), text: new Date(user.first_seen_at || user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }))));
          })));
        };

        const load = async () => {
          if (currentPanel !== 'users') return;
          try {
            const [users] = await Promise.all([fetchAllUsers(), refreshPresenceUI()]);
            usersData = users;
            usersError = '';
          } catch (error) {
            usersError = error.message;
          }
          draw();
        };

        // Tick the online users' timers every second without refetching.
        const tick = () => {
          if (currentPanel !== 'users') return;
          const online = onlineMap();
          sidePanelBody.querySelectorAll('.user-active-time').forEach((cell) => {
            const user = usersData.find((item) => item.user_id === cell.dataset.userId);
            if (user && online.has(user.user_id)) cell.textContent = formatDuration(liveSeconds(user, true));
          });
        };

        onPresenceUpdated = () => draw();
        await load();
        let ticks = 0;
        panelTimer = setInterval(() => {
          ticks += 1;
          if (ticks % 10 === 0) load();
          else tick();
        }, 1000);
      };

      // ---- Settings & Help --------------------------------------------------
      const renderSettingsPanel = () => {
        const isDark = document.body.dataset.theme === 'dark';
        const themeButton = (value, label) => el('button', {
          type: 'button',
          className: `segmented-option${(value === 'dark') === isDark ? ' active' : ''}`,
          'aria-pressed': String((value === 'dark') === isDark),
          onclick: () => {
            setTheme(value);
            try { localStorage.setItem(themeStorageKey, value); } catch (error) { /* ignore */ }
            renderSettingsPanel();
          }
        }, label);
        const role = authSession ? authSession.user.role : 'guest';
        const roleText = { owner: 'Owner — full access, can manage users', editor: 'Editor — can add and change devices and layouts', viewer: 'Viewer — can look but not change', guest: 'Guest — view only' }[role];
        const shortcut = (keys, text) => el('li', {}, el('span', {}, keys.map((key) => el('kbd', { text: key }))), el('span', { text }));
        sidePanelBody.replaceChildren(
          el('h3', { className: 'panel-subheading', text: 'Account' }),
          el('div', { className: 'settings-account' },
            el('strong', { text: authSession ? authSession.user.email : 'Not signed in' }),
            el('small', { text: roleText }),
            el('button', {
              type: 'button',
              className: 'panel-button',
              onclick: () => { closePanel(); (authSession ? accountSignOut : accountSignIn).click(); }
            }, authSession ? 'Sign out' : 'Sign in')),
          el('h3', { className: 'panel-subheading', text: 'Appearance' }),
          el('div', { className: 'segmented', role: 'group', 'aria-label': 'Theme' }, themeButton('light', 'Light'), themeButton('dark', 'Dark')),
          el('h3', { className: 'panel-subheading', text: 'Keyboard shortcuts' }),
          el('ul', { className: 'shortcut-list' },
            shortcut(['/'], 'Find a device'),
            shortcut(['←', '→'], 'Previous / next layout'),
            shortcut(['+', '−'], 'Zoom in / out'),
            shortcut(['Esc'], 'Close popup or panel, reset view')),
          el('h3', { className: 'panel-subheading', text: 'Help' }),
          el('ul', { className: 'help-list' },
            el('li', { text: 'Tap a blue marker to see the device details. Use the search box above the plan to jump straight to a device ID.' }),
            el('li', { text: 'Pinch or scroll to zoom, drag to pan. Use the arrows to switch layouts.' }),
            el('li', { text: 'Editors can place a marker with the pin button, move one with the arrows button, and add layouts with the + next to Layouts.' }),
            el('li', { text: 'Need an account or a different role? Contact your MQuest workspace owner.' }))
        );
      };

      // ---- Live sync status (top bar) ----------------------------------------
      const syncStatus = document.getElementById('syncStatus');
      const syncStatusText = document.getElementById('syncStatusText');
      const updateSyncStatus = () => {
        let state = 'live';
        let text;
        if (!navigator.onLine) {
          state = 'offline';
          text = 'Offline · showing saved data';
        } else if (lastCloudSyncFailed && !lastCloudSyncAt) {
          state = 'offline';
          text = 'Not synced · showing saved data';
        } else if (!lastCloudSyncAt) {
          state = 'connecting';
          text = 'Connecting…';
        } else {
          const seconds = Math.max(0, Math.round((Date.now() - lastCloudSyncAt) / 1000));
          if (lastCloudSyncFailed || seconds > 60) state = 'stale';
          text = `${state === 'stale' ? 'Reconnecting' : 'Live'} · synced ${seconds < 60 ? `${seconds}s` : formatAgo(lastCloudSyncAt).replace(' ago', '')} ago`;
        }
        syncStatus.dataset.state = state;
        syncStatusText.textContent = text;
        syncStatus.title = lastCloudSyncAt ? `Last synced ${formatDateTime(lastCloudSyncAt)}` : '';
      };
      updateSyncStatus();
      setInterval(updateSyncStatus, 1000);
      window.addEventListener('online', updateSyncStatus);
      window.addEventListener('offline', updateSyncStatus);

      // Keep the plan's aspect ratio available to CSS (phones size the plan to fit).
      image.addEventListener('load', () => {
        if (image.naturalWidth && image.naturalHeight) {
          stage.style.setProperty('--plan-aspect', `${image.naturalWidth} / ${image.naturalHeight}`);
        }
      });

      // Global keys: "/" opens device search, Esc closes the panel / drawer first.
      window.addEventListener('keydown', (event) => {
        const typing = event.target.matches('input, textarea, select, [contenteditable="true"]');
        if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey &&
          loginScreen.hidden && photoViewer.hidden) {
          event.preventDefault();
          deviceSearchInput.focus();
          deviceSearchInput.select();
          return;
        }
        if (event.key !== 'Escape' || !loginScreen.hidden || !photoViewer.hidden) return;
        if (currentPanel && !markerEditor.contains(event.target)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          closePanel();
        } else if (document.body.classList.contains('sidebar-open')) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setSidebarOpen(false);
          sidebarMenuButton.focus();
        }
      }, true);

      // Signing in or out changes what the panels may show.
      panelRoleHook = () => {
        if (!currentPanel) return;
        const name = currentPanel;
        clearInterval(panelTimer);
        panelTimer = null;
        onPresenceUpdated = null;
        sidePanelBody.replaceChildren();
        panelDefinitions[name].render();
      };

      restoreAuthSession();
      handleAuthRedirect();
      if (readLoginLock().until > Date.now()) applyLoginLock();
      restoreMarkers();
      updateProjectControls();
      selectLayout(0);
      layoutSyncPromise = syncProjectsFromCloud()
        .catch((error) => {
          if (!projectSyncErrorAnnounced) {
            console.error('Unable to sync shared projects:', error);
            announce('Could not sync project names. Check the Supabase projects table setup.', true);
            projectSyncErrorAnnounced = true;
          }
        })
        .then(() => restoreUploads())
        .then(() => syncLayoutsFromCloud())
        .catch((error) => {
          console.error('Unable to sync shared layouts:', error);
          announce('Could not sync shared layouts. Showing layouts saved on this device.', true);
        });
      markerSyncPromise = refreshSharedMarkers();
      setInterval(() => {
        markerSyncPromise = refreshSharedMarkers();
        const projectSync = syncProjectsFromCloud();
        layoutSyncPromise = projectSync.then(() => syncLayoutsFromCloud()).catch((error) => {
          if (!projectSyncErrorAnnounced) {
            console.error('Unable to sync shared projects or layouts:', error);
            announce('Could not sync projects or layouts. Check the Supabase setup.', true);
            projectSyncErrorAnnounced = true;
          }
        });
      }, 5000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          markerSyncPromise = refreshSharedMarkers();
          const projectSync = syncProjectsFromCloud();
          layoutSyncPromise = projectSync.then(() => syncLayoutsFromCloud()).catch((error) => {
            if (!projectSyncErrorAnnounced) {
              console.error('Unable to sync shared projects or layouts:', error);
              announce('Could not sync projects or layouts. Check the Supabase setup.', true);
              projectSyncErrorAnnounced = true;
            }
          });
        }
      });
      window.addEventListener('focus', () => {
        markerSyncPromise = refreshSharedMarkers();
        const projectSync = syncProjectsFromCloud();
        layoutSyncPromise = projectSync.then(() => syncLayoutsFromCloud()).catch((error) => {
          if (!projectSyncErrorAnnounced) {
            console.error('Unable to sync shared projects or layouts:', error);
            announce('Could not sync projects or layouts. Check the Supabase setup.', true);
            projectSyncErrorAnnounced = true;
          }
        });
      });
    })();
