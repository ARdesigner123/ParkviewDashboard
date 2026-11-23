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
      const sidebarToggleBtn = document.createElement('button');
      const sidebarToggle = document.createElement('button');
      const appShell = document.querySelector('.app-shell');
      const loginScreen = document.getElementById('loginScreen');
      const accountMenu = document.getElementById('accountMenu');
      const accountButton = document.getElementById('accountButton');
      const accountPopover = document.getElementById('accountPopover');
      const accountName = document.getElementById('accountName');
      const accountDescription = document.getElementById('accountDescription');
      const accountSignIn = document.getElementById('accountSignIn');
      const accountSignOut = document.getElementById('accountSignOut');
      const liveUsers = document.getElementById('liveUsers');
      const liveUsersButton = document.getElementById('liveUsersButton');
      const liveUsersPopover = document.getElementById('liveUsersPopover');
      const liveUserCount = document.getElementById('liveUserCount');
      const liveUsersList = document.getElementById('liveUsersList');
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
      let authRefreshInProgress = false;
      let presenceUserId = null;
      let presenceDisplayName = null;
      let presenceRole = null;
      let presenceHeartbeatTimer = null;
      let liveUsersRefreshTimer = null;
      let guestId = null;
      let guestCounterKey = `mquest-parkview-guest-counter:${markerCloudSiteId}`;
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

      const authRequest = async (path, payload, accessToken) => {
        const headers = {
          apikey: markerCloudConfig.anonKey,
          'Content-Type': 'application/json'
        };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        let response;
        try {
          response = await fetch(`${authBaseUrl}${path}`, {
            method: 'POST',
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
        liveUsers.hidden = !isWorkspaceOwner();
        accountButton.setAttribute('aria-label', isSignedIn
          ? `Open account menu for ${displayName}`
          : 'Open guest account menu');
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
        appShell.hidden = true;
        loginScreen.hidden = false;
        window.requestAnimationFrame(() => loginUsername.focus());
      };

      const showProjectWorkspace = () => {
        loginScreen.hidden = true;
        appShell.hidden = false;
        accountButton.focus();
      };

      const presenceRestUrl = () =>
        `${getMarkerCloudRestUrl()}/parkview_presence`;

      const presenceStaleMs = 30000;
      const presenceHeartbeatMs = 10000;
      const presenceFetchMs = 5000;

      const guestIdKey = `mquest-parkview-guest-id:${markerCloudSiteId}`;

      const ensureGuestId = async () => {
        if (guestId) return guestId;
        guestId = localStorage.getItem(guestIdKey);
        if (guestId) return guestId;

        // Assign a private per-browser anonymous ID with a sequential guest number.
        // A fresh guest gets a random ID prefix; the sequential number is persisted
        // in Supabase so it survives browser data clearing and stays unique per user.
        let guestNum = 1;
        try {
          const stored = localStorage.getItem(guestCounterKey);
          guestNum = stored ? parseInt(stored, 10) + 1 : 1;
          localStorage.setItem(guestCounterKey, String(guestNum));
        } catch (e) {
          console.warn('Unable to read/write guest counter:', e);
        }
        guestId = `guest-${guestNum}-${crypto.randomUUID().slice(0, 6)}`;
        try {
          localStorage.setItem(guestIdKey, guestId);
        } catch (e) {
          console.warn('Unable to save guest ID:', e);
        }

        // Register the new guest in the users table so we can track all guests
        // (and show a stable anonymous number across devices/browsers).
        const displayName = `Anonymous ${guestNum}`;
        try {
          const existing = await fetch(`${usersRestUrl()}?user_id=eq.${encodeURIComponent(guestId)}`, {
            headers: { apikey: markerCloudConfig.anonKey },
          });
          if (existing.ok) {
            const rows = await existing.json().catch(() => []);
            if (Array.isArray(rows) && rows.length > 0) return guestId;
          }
        } catch (e) {
          console.warn('Unable to check for existing guest user:', e);
        }

        const payload = {
          user_id: guestId,
          email: null,
          display_name: displayName,
          role: 'guest',
          last_seen_at: new Date().toISOString(),
        };
        try {
          await fetch(usersRestUrl(), {
            method: 'POST',
            headers: {
              apikey: markerCloudConfig.anonKey,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify(payload),
          });
        } catch (error) {
          console.error('Unable to register guest user:', error);
        }

        return guestId;
      };

      const guestNumberFromId = (id) => {
        const match = String(id).match(/guest-(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };

      const nameColorHash = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
          hash |= 0;
        }
        const h = Math.abs(hash) % 360;
        return `hsl(${h}, 70%, 55%)`;
      };

      const upsertPresence = async (userId, displayName, role, projectId, projectName, layoutId, layoutName) => {
        const payload = {
          user_id: userId,
          display_name: displayName,
          role: role,
          project_id: projectId,
          project_name: projectName,
          layout_id: layoutId,
          layout_name: layoutName,
          updated_at: new Date().toISOString(),
        };
        console.log('[Presence] Upserting:', userId, displayName, role, projectName, layoutName);
        try {
          // Try update first with return=representation to check if any row was affected
          const updateResponse = await fetch(
            `${presenceRestUrl()}?user_id=eq.${encodeURIComponent(userId)}`,
            {
              method: 'PATCH',
              headers: {
                apikey: markerCloudConfig.anonKey,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify(payload),
            }
          );
          const updateData = await updateResponse.json().catch(() => []);
          if (Array.isArray(updateData) && updateData.length > 0) {
            console.log('[Presence] Updated existing row:', userId);
            return;
          }
          console.log('[Presence] PATCH affected 0 rows, inserting new row');
          // If update affected no rows (user doesn't exist yet), insert
          const insertResponse = await fetch(presenceRestUrl(), {
            method: 'POST',
            headers: {
              apikey: markerCloudConfig.anonKey,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify(payload),
          });
          if (!insertResponse.ok) {
            console.error('[Presence] Insert failed:', insertResponse.status, await insertResponse.text().catch(() => ''));
          }
        } catch (error) {
          console.error('Unable to upsert presence:', error);
        }
      };

      const deletePresence = async (userId) => {
        try {
          await fetch(`${presenceRestUrl()}?user_id=eq.${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            headers: { apikey: markerCloudConfig.anonKey },
          });
        } catch (error) {
          console.error('Unable to delete presence:', error);
        }
      };

      const fetchPresence = async () => {
        try {
          const cutoff = new Date(Date.now() - presenceStaleMs).toISOString();
          const projectId = activeProject?.id || defaultProjectId;
          const layoutId = layouts[selectedIndex]?.id || 'layout-1';
          const response = await fetch(
            `${presenceRestUrl()}?project_id=eq.${encodeURIComponent(projectId)}&layout_id=eq.${encodeURIComponent(layoutId)}&updated_at=gt.${encodeURIComponent(cutoff)}&order=updated_at.desc`,
            { headers: { apikey: markerCloudConfig.anonKey } }
          );
          if (!response.ok) {
            console.error('Presence fetch failed:', response.status, await response.text().catch(() => ''));
            return [];
          }
          const rows = await response.json();
          const data = Array.isArray(rows) ? rows : [];
          console.log('[Presence] Fetched online users:', data.length, data.map((r) => r.display_name));
          return data;
        } catch (error) {
          console.error('Unable to fetch presence:', error);
          return [];
        }
      };

      const usersRestUrl = () =>
        `${getMarkerCloudRestUrl()}/parkview_users`;

      const upsertUser = async (userId, email, displayName, role) => {
        const payload = {
          user_id: userId,
          email: email,
          display_name: displayName,
          role: role,
          last_seen_at: new Date().toISOString(),
        };
        try {
          const updateResponse = await fetch(
            `${usersRestUrl()}?user_id=eq.${encodeURIComponent(userId)}`,
            {
              method: 'PATCH',
              headers: {
                apikey: markerCloudConfig.anonKey,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify(payload),
            }
          );
          const updateData = await updateResponse.json().catch(() => []);
          if (Array.isArray(updateData) && updateData.length > 0) return;
          const insertResponse = await fetch(usersRestUrl(), {
            method: 'POST',
            headers: {
              apikey: markerCloudConfig.anonKey,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify(payload),
          });
          if (!insertResponse.ok) {
            console.error('[Users] Insert failed:', insertResponse.status, await insertResponse.text().catch(() => ''));
          }
        } catch (error) {
          console.error('Unable to upsert user:', error);
        }
      };

      const fetchAllUsers = async () => {
        try {
          const response = await fetch(usersRestUrl(), {
            headers: { apikey: markerCloudConfig.anonKey },
          });
          if (!response.ok) return [];
          const rows = await response.json();
          return Array.isArray(rows) ? rows : [];
        } catch (error) {
          console.error('Unable to fetch all users:', error);
          return [];
        }
      };

      const startPresence = async () => {
        stopPresenceTimers();

        const isSignedIn = Boolean(authSession);
        presenceUserId = isSignedIn
          ? (authSession.user.id || 'user-unknown')
          : await ensureGuestId();
        presenceDisplayName = isSignedIn
          ? (displayNameFromEmail(authSession.user.email) || 'User')
          : `Anonymous ${guestNumberFromId(presenceUserId) || 1}`;
        presenceRole = isSignedIn ? authSession.user.role : 'guest';

        const active = activeProject || { id: defaultProjectId, name: 'Park View Label' };
        const current = layouts[selectedIndex] || { id: 'layout-1', name: 'Layout 1' };

        await upsertPresence(
          presenceUserId,
          presenceDisplayName,
          presenceRole,
          active.id,
          active.name,
          current.id,
          current.name
        );

        await upsertUser(
          presenceUserId,
          isSignedIn ? authSession.user.email : null,
          presenceDisplayName,
          presenceRole
        );

        presenceHeartbeatTimer = setInterval(() => {
          upsertPresence(
            presenceUserId,
            presenceDisplayName,
            presenceRole,
            active.id,
            active.name,
            current.id,
            current.name
          );
        }, presenceHeartbeatMs);

        liveUsersRefreshTimer = setInterval(() => {
          refreshPresenceUI();
        }, presenceFetchMs);

        await refreshPresenceUI();
      };

      const stopPresenceTimers = () => {
        if (presenceHeartbeatTimer) {
          clearInterval(presenceHeartbeatTimer);
          presenceHeartbeatTimer = null;
        }
        if (liveUsersRefreshTimer) {
          clearInterval(liveUsersRefreshTimer);
          liveUsersRefreshTimer = null;
        }
      };

      const stopPresence = async () => {
        stopPresenceTimers();
        if (presenceUserId) {
          await deletePresence(presenceUserId);
          presenceUserId = null;
          presenceDisplayName = null;
          presenceRole = null;
        }
        await refreshPresenceUI();
      };

      const updatePresenceLocation = async () => {
        if (!presenceUserId) return;
        const active = activeProject || { id: defaultProjectId, name: 'Park View Label' };
        const current = layouts[selectedIndex] || { id: 'layout-1', name: 'Layout 1' };
        await upsertPresence(
          presenceUserId,
          presenceDisplayName,
          presenceRole,
          active.id,
          active.name,
          current.id,
          current.name
        );
        await refreshPresenceUI();
      };

      const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      const renderPresenceUserItem = (user, isCurrentUser, isOnline) => {
        const color = nameColorHash(user.display_name || user.user_id);
        const roleLabel = user.role === 'owner' ? 'Owner' : user.role === 'editor' ? 'Editor' : 'Viewer';
        const currentBadge = isCurrentUser ? ' <span class="presence-you">(you)</span>' : '';
        const statusDot = isOnline
          ? '<span class="status-indicator online"></span>'
          : '<span class="status-indicator offline"></span>';
        const location = isOnline
          ? `${escapeHtml(user.project_name || 'Project')} · ${escapeHtml(user.layout_name || 'Layout')}`
          : 'Offline';
        const locationClass = isOnline ? 'live-user-location' : 'live-user-location offline';
        return `
          <li class="live-user-item${isCurrentUser ? ' current-user' : ''}${!isOnline ? ' offline-user' : ''}" style="--user-color: ${color}">
            <div class="live-user-avatar" style="background: ${color}" aria-hidden="true">
              ${(user.display_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div class="live-user-info">
              <div class="live-user-name">${statusDot} ${escapeHtml(user.display_name || 'User')}${currentBadge}</div>
              <div class="${locationClass}">${location}</div>
              <div class="live-user-role">${escapeHtml(roleLabel)}</div>
            </div>
          </li>
        `;
      };

      const renderPresenceGuestItem = (user) => {
        const color = nameColorHash(user.user_id);
        return `
          <li class="live-user-item guest-user" style="--user-color: ${color}">
            <div class="live-user-avatar" style="background: ${color}" aria-hidden="true">
              ${(user.display_name || 'A').charAt(0).toUpperCase()}
            </div>
            <div class="live-user-info">
              <div class="live-user-name">${escapeHtml(user.display_name || 'Anonymous')}</div>
              <div class="live-user-location">${escapeHtml(user.project_name || 'Project')} · ${escapeHtml(user.layout_name || 'Layout')}</div>
              <div class="live-user-role">Guest</div>
            </div>
          </li>
        `;
      };

      const refreshPresenceUI = async () => {
        const presenceRows = await fetchPresence();
        const allUsers = await fetchAllUsers();
        const currentUserId = presenceUserId;

        console.log('[Presence] refreshPresenceUI:', {
          presenceRows: presenceRows.length,
          presenceRowsNames: presenceRows.map((r) => r.display_name),
          allUsers: allUsers.length,
          allUsersNames: allUsers.map((u) => u.display_name),
          currentUserId: currentUserId,
        });

        // Build a map of online users by user_id
        const onlineById = new Map();
        presenceRows.forEach((r) => {
          onlineById.set(r.user_id, r);
        });

        // Merge: show all registered users, mark online ones
        // Signed-in users + guests are all tracked, but presence rows only include
        // users that are currently "present" in this project/layout.
        const allKnownUsers = allUsers.filter((u) => u.role !== 'guest');
        const signedInUsers = allUsers.filter((u) => u.role !== 'guest');
        const guestCount = presenceRows.filter((r) => r.role === 'guest').length;

        // Total online (signed-in + guests)
        const totalOnline = presenceRows.length;
        liveUserCount.textContent = totalOnline;
        liveUsersButton.setAttribute('aria-label', `${totalOnline} user${totalOnline !== 1 ? 's' : ''} online`);

        const list = liveUsersList;
        list.replaceChildren();
        if (signedInUsers.length === 0) {
          const empty = document.createElement('li');
          empty.className = 'live-users-empty';
          empty.textContent = 'No registered users.';
          list.appendChild(empty);
        } else {
          // Online users first, then offline
          const sorted = [...signedInUsers].sort((a, b) => {
            const aOnline = onlineById.has(a.user_id);
            const bOnline = onlineById.has(b.user_id);
            if (aOnline && !bOnline) return -1;
            if (!aOnline && bOnline) return 1;
            return 0;
          });
          sorted.forEach((user) => {
            const isOnline = onlineById.has(user.user_id);
            const presence = isOnline ? onlineById.get(user.user_id) : null;
            const li = document.createElement('li');
            li.innerHTML = renderPresenceUserItem({
              ...user,
              project_name: presence ? presence.project_name : user.project_name || 'Project',
              layout_name: presence ? presence.layout_name : user.layout_name || 'Layout',
            }, user.user_id === currentUserId, isOnline);
            list.appendChild(li);
          });
        }

        // Guests section (online guests only, from presence)
        const guestSection = document.getElementById('liveUsersGuests');
        const guestList = document.getElementById('liveUsersGuestList');
        const guestHeading = guestSection.querySelector('.live-users-guest-heading');
        guestHeading.textContent = `Guests (${guestCount})`;
        guestList.replaceChildren();
        if (guestCount === 0) {
          const empty = document.createElement('li');
          empty.className = 'live-users-empty';
          empty.textContent = 'No guests online.';
          guestList.appendChild(empty);
        } else {
          presenceRows.filter((r) => r.role === 'guest').forEach((user) => {
            const li = document.createElement('li');
            li.innerHTML = renderPresenceGuestItem(user);
            guestList.appendChild(li);
          });
        }

        guestSection.hidden = guestCount === 0;

        const liveUsersBlock = document.getElementById('liveUsers');
        if (totalOnline === 0 && signedInUsers.length === 0) {
          liveUsersBlock.hidden = true;
        } else {
          liveUsersBlock.hidden = false;
        }

        renderPresenceAvatars(presenceRows);
      };

      const renderPresenceAvatars = (rows) => {
        const layer = document.getElementById('presenceLayer');
        layer.replaceChildren();

        const currentLayout = layouts[selectedIndex];
        const currentProject = activeProject;

        if (!currentLayout || !currentProject) {
          layer.setAttribute('aria-hidden', 'true');
          return;
        }

        const here = rows.filter((r) =>
          r.project_id === currentProject.id && r.layout_id === currentLayout.id && r.user_id !== presenceUserId
        );

        if (here.length > 0) {
          layer.removeAttribute('aria-hidden');
        } else {
          layer.setAttribute('aria-hidden', 'true');
        }

        here.forEach((user, index) => {
          const color = nameColorHash(user.display_name || user.user_id);
          const avatar = document.createElement('div');
          avatar.className = 'presence-avatar';
          avatar.style.left = `calc(10% + ${index * 34}px)`;
          avatar.style.top = '12px';
          avatar.title = `${user.display_name} is viewing this layout`;
          avatar.innerHTML = (user.display_name || 'U').charAt(0).toUpperCase();
          layer.appendChild(avatar);
        });

        document.querySelectorAll('.layout-item').forEach((item, index) => {
          const oldAvatar = item.querySelector('.layout-presence-avatars');
          if (oldAvatar) oldAvatar.remove();

          const layout = layouts[index];
          const usersHere = rows.filter((r) =>
            r.project_id === currentProject.id && r.layout_id === layout.id
          );

          if (usersHere.length > 0) {
            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'layout-presence-avatars';
            usersHere.slice(0, 3).forEach((user) => {
              const color = nameColorHash(user.display_name || user.user_id);
              const av = document.createElement('div');
              av.className = 'layout-presence-avatar';
              av.style.background = color;
              av.title = `${user.display_name} is here`;
              av.innerHTML = (user.display_name || 'U').charAt(0).toUpperCase();
              avatarWrap.appendChild(av);
            });
            if (usersHere.length > 3) {
              const more = document.createElement('div');
              more.className = 'layout-presence-avatar more';
              more.textContent = `+${usersHere.length - 3}`;
              more.style.background = 'var(--muted)';
              avatarWrap.appendChild(more);
            }
            item.appendChild(avatarWrap);
          }
        });
      };

      const setAuthSession = (session) => {
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
        if (previousSession) stopPresence(previousSession);
        authSession = null;
        clearTimeout(authRefreshTimer);
        authRefreshTimer = null;
        updateAccountMenu();
        try {
          localStorage.removeItem(authSessionStorageKey);
        } catch (error) {
          console.error('Unable to clear the saved sign-in session:', error);
          announce('Signed out here, but the saved session could not be cleared from this browser.', true);
        }
      };

      const refreshAuthSession = async () => {
        if (!authSession || authRefreshInProgress) return;
        authRefreshInProgress = true;
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
        } finally {
          authRefreshInProgress = false;
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
        const projectSelect = document.getElementById('projectSelect');
        projectSelect.replaceChildren();
        getActiveProjects().forEach((project) => {
          const option = document.createElement('option');
          option.value = project.id;
          option.textContent = project.name;
          projectSelect.append(option);
        });
        projectSelect.value = activeProject.id;
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
        document.querySelector('.sidebar-bottom .project-name').textContent = activeProject.name;
        document.querySelector('.sidebar-bottom .project-location').textContent =
          `${layouts.length} ${layouts.length === 1 ? 'layout' : 'layouts'} · Project workspace`;
        document.getElementById('sidebarProjectName').textContent = activeProject.name;
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
        const response = await fetch(
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
        const response = await fetch(
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
        const response = await fetch(
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
        const response = await fetch(`${getMarkerCloudRestUrl()}/parkview_marker_sites?${query}`, {
          headers: { apikey: markerCloudConfig.anonKey }
        });
        if (!response.ok) throw new Error(`Supabase marker sync status failed (${response.status}).`);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('Saved cloud marker status has an invalid format.');
        return rows.length > 0;
      };

      const markCloudSiteInitialized = async () => {
        const response = await fetch(`${getMarkerCloudRestUrl()}/parkview_marker_sites?on_conflict=site_id`, {
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
        const response = await fetch(
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
        const response = await fetch(
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
        const response = await fetch(`${getMarkerCloudRestUrl()}/parkview_markers?${query}`, {
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
        const response = await fetch(`${getMarkerCloudRestUrl()}/parkview_markers?${query}`, {
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
        } catch (error) {
          console.error('Unable to sync shared markers:', error);
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

      // True when a stored "YYYY-MM" inspection month is earlier than this month.
      const isInspectionOverdue = (value) => {
        const match = String(value || '').match(/^(\d{4})-(\d{2})/);
        if (!match) return false;
        const now = new Date();
        const due = Number(match[1]) * 12 + Number(match[2]) - 1;
        return due < now.getFullYear() * 12 + now.getMonth();
      };

      // Expanding ring at a marker's tip — the "ping" when it is tapped.
      const spawnMarkerRipple = (pin) => {
        const ripple = document.createElement('span');
        ripple.className = 'marker-ripple';
        if (pin.classList.contains('is-overdue')) ripple.classList.add('is-alert');
        ripple.style.left = pin.style.left;
        ripple.style.top = pin.style.top;
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
        markerLayer.append(ripple);
        setTimeout(() => ripple.remove(), 1200);
      };

const renderMarkers = () => {
    markerLayer.replaceChildren();

    if (!layouts.length) return;

    const bounds = getImageBounds();
    if (!bounds) return;

    getCurrentMarkers().forEach((marker) => {

        // Create marker button
        const pin = document.createElement('button');

        pin.type = 'button';
        pin.className = 'map-marker';

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

        // Location pin — the Device ID is drawn inside the SVG so it scales with
        // the pin and stays exactly centred in the white circle on every device.
        const svgNS = 'http://www.w3.org/2000/svg';
        const markerSVG = document.createElementNS(svgNS, 'svg');
        markerSVG.setAttribute('viewBox', '0 0 48 60');
        markerSVG.setAttribute('aria-hidden', 'true');
        markerSVG.classList.add('map-marker-pin');

        const pinShape = document.createElementNS(svgNS, 'path');
        pinShape.setAttribute('class', 'map-marker-body');
        pinShape.setAttribute('d', 'M24 1.5C12 1.5 2.5 11 2.5 23c0 14.6 18.4 31.9 20.4 33.7a1.6 1.6 0 0 0 2.2 0C27.1 54.9 45.5 37.6 45.5 23 45.5 11 36 1.5 24 1.5Z');

        const pinCentre = document.createElementNS(svgNS, 'circle');
        pinCentre.setAttribute('class', 'map-marker-core');
        pinCentre.setAttribute('cx', '24');
        pinCentre.setAttribute('cy', '23');
        pinCentre.setAttribute('r', '16.5');

        markerSVG.append(pinShape, pinCentre);

        const deviceId = String(marker.deviceId ?? '').trim();
        if (deviceId) {
          const label = document.createElementNS(svgNS, 'text');
          label.setAttribute('class', 'map-marker-label');
          label.setAttribute('x', '24');
          label.setAttribute('y', '23.6');
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'central');
          // Shrink the type as the ID gets longer so it always fits the circle.
          const fontSizes = [17, 17, 15, 12.5, 10.5];
          label.setAttribute('font-size', String(fontSizes[deviceId.length] || 10.5));
          if (deviceId.length >= 4) {
            label.setAttribute('textLength', deviceId.length === 4 ? '26' : '28');
            label.setAttribute('lengthAdjust', 'spacingAndGlyphs');
          }
          label.textContent = deviceId;
          markerSVG.append(label);
        } else {
          const dot = document.createElementNS(svgNS, 'circle');
          dot.setAttribute('class', 'map-marker-dot');
          dot.setAttribute('cx', '24');
          dot.setAttribute('cy', '23');
          dot.setAttribute('r', '5');
          markerSVG.append(dot);
        }

        if (isInspectionOverdue(marker.serviceDate)) {
          pin.classList.add('is-overdue');
          pin.title = `${pin.title} — inspection overdue`;
        }
        if (!markerMoveMode && marker.id === editingMarkerId && !markerEditor.hidden) {
          pin.classList.add('is-active');
        }

        pin.append(markerSVG);

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
        document.getElementById('markerEditorTitle').textContent = 'Marker Details';
        document.querySelector('.marker-editor-heading p').textContent = 'Device details';
        document.getElementById('markerDetailsView').hidden = false;
        document.getElementById('markerEditFields').hidden = true;
        document.getElementById('markerEdit').hidden = false;
        document.getElementById('markerEditorActions').hidden = true;
        const detailsGrid = document.getElementById('markerDetailsGrid');
        detailsGrid.replaceChildren();
        [
          ['Device ID', marker.deviceId],
          ['Device Name', marker.product],
          ['Device Type', marker.deviceType],
          ['Floor Level', marker.floorLevel],
          ['Venue', marker.location],
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
          if (label === 'Next Inspection Date' && isInspectionOverdue(marker.serviceDate)) {
            item.classList.add('is-alert');
            const flag = document.createElement('em');
            flag.className = 'marker-detail-flag';
            flag.textContent = 'Overdue';
            itemValue.append(flag);
          }
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
        document.querySelector('.marker-editor-heading p').textContent = 'Enter details for this device.';
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
          item.className = `layout-item${index === selectedIndex ? ' active' : ''}`;
          item.setAttribute('aria-current', index === selectedIndex ? 'true' : 'false');
          item.setAttribute('aria-label', `Show ${layout.name}`);

          const thumb = document.createElement('img');
          thumb.className = 'layout-thumb';
          thumb.src = layout.src;
          thumb.alt = '';

          const copy = document.createElement('span');
          copy.className = 'layout-item-copy';
          const title = document.createElement('span');
          title.className = 'layout-item-title';
          title.textContent = layout.name;
          const meta = document.createElement('span');
          meta.className = 'layout-item-meta';
          meta.textContent = layout.uploaded ? 'Added image' : 'Project drawing';
          copy.append(title, meta);
          item.append(thumb, copy);
          item.addEventListener('click', () => selectLayout(index));

          const actions = document.createElement('div');
          actions.className = 'layout-item-actions';
          const rename = document.createElement('button');
          rename.type = 'button';
          rename.className = 'layout-action rename';
          rename.setAttribute('aria-label', `Rename ${layout.name}`);
          rename.title = 'Rename layout';
          rename.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg><span>Rename</span>';
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

        document.getElementById('layoutCount').textContent =
          `${String(layouts.length).padStart(2, '0')} ${layouts.length === 1 ? 'sheet' : 'sheets'}`;
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
          document.getElementById('imageCaption').textContent = 'No layouts available';
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
        document.getElementById('imageCaption').textContent = `${activeProject.name} · ${layout.name}`;
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
        const response = await fetch(
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
        const response = await fetch(
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
        const response = await fetch(
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
        const response = await fetch(
          `${getMarkerCloudRestUrl()}/parkview_layouts?site_id=eq.${encodeURIComponent(markerCloudSiteId)}&select=site_id,layout_id,name,is_uploaded,deleted,image_path,updated_at`,
          { headers: { apikey: markerCloudConfig.anonKey } }
        );
        if (!response.ok) throw new Error(`Supabase layouts load failed (${response.status}).`);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('Saved cloud layouts have an invalid format.');
        return rows;
      };

      const saveCloudProject = async (project) => {
        const response = await fetch(`${getMarkerCloudRestUrl()}/parkview_projects?on_conflict=site_id,project_id`, {
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
          const markerResponse = await fetch(`${getMarkerCloudRestUrl()}/parkview_markers?${markerQuery}`, {
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
        const response = await fetch(
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
        } else if (rejectedCount) {
          announce('Only image files can be added.', true);
        }
        fileInput.value = '';
      });

      document.getElementById('projectSelect').addEventListener('change', (event) => {
        selectProject(event.target.value);
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
          const markerResponse = await fetch(`${getMarkerCloudRestUrl()}/parkview_markers?${query}`, {
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
        await markerSyncPromise;
        const markers = getCurrentMarkers();
        const details = {
          deviceId: document.getElementById('markerDeviceId').value.trim(),
          product: document.getElementById('markerProduct').value.trim(),
          deviceType: document.getElementById('markerDeviceType').value.trim(),
          floorLevel: document.getElementById('markerFloorLevel').value.trim(),
          location: document.getElementById('markerLocation').value.trim(),
          serviceDate: storeMonthYear(document.getElementById('markerServiceDate').value),
          manufacturingDate: storeMonthYear(document.getElementById('markerManufacturingDate').value)
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

      liveUsersButton.addEventListener('click', () => {
        const shouldOpen = liveUsersPopover.hidden;
        closeAccountPopover();
        liveUsersPopover.hidden = !shouldOpen;
        liveUsersButton.setAttribute('aria-expanded', String(shouldOpen));
        if (shouldOpen) refreshPresenceUI();
      });

      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (loginSubmit.disabled) return;
        setLoginFeedback('');
        loginSubmit.disabled = true;
        loginSubmitLabel.textContent = 'Signing in...';
        try {
          const result = await authRequest('/auth/v1/token?grant_type=password', {
            email: loginUsername.value.trim().toLowerCase(),
            password: loginPassword.value
          });
          const session = createAuthSession(result);
          const sessionSaved = setAuthSession(session);
          loginForm.reset();
          setLoginFeedback('');
          showProjectWorkspace();
          if (sessionSaved) announce(`Signed in as ${displayNameFromEmail(session.user.email) || 'User'}.`);
        } catch (error) {
          setLoginFeedback(error.message || 'Sign in failed. Please try again.');
          loginPassword.value = '';
          loginPassword.focus();
        } finally {
          loginSubmit.disabled = false;
          loginSubmitLabel.textContent = 'Login';
        }
      });
      document.getElementById('continueAsGuest').addEventListener('click', () => {
        loginForm.reset();
        setLoginFeedback('');
        showProjectWorkspace();
      });
      document.addEventListener('click', (event) => {
        if (!accountMenu.contains(event.target)) closeAccountPopover();
        if (!liveUsersButton.contains(event.target) && !liveUsersPopover.contains(event.target)) {
          liveUsersPopover.hidden = true;
          liveUsersButton.setAttribute('aria-expanded', 'false');
        }
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
        if (event.key === 'Escape' && !liveUsersPopover.hidden) {
          event.preventDefault();
          liveUsersPopover.hidden = true;
          liveUsersButton.setAttribute('aria-expanded', 'false');
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
      restoreAuthSession();
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
/* ========================================
   SIDEBAR TOGGLE
   ========================================= */

const toggleSidebar = () => {
  const isCollapsed = document.body.classList.toggle('collapsed');
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.setAttribute('aria-pressed', String(!isCollapsed));
  }
};

/* ========================================
/* ========================================
   RENDER LAYOUT LIST
   ========================================= */

const renderLayoutList = () => {
  const layoutList = document.getElementById('layoutList');
  if (!layoutList) return;
  
  layoutList.replaceChildren();
  
  const activeProject = projects.find((project) => !project.deleted) || projects[0];
  const allLayouts = activeProject?.layouts || [];
  
  // Group layouts by project
  const projectLayouts = new Map();
  
  // Add built-in layouts under the default project
  const defaultProject = projects.find((p) => p.id === defaultProjectId);
  if (defaultProject && defaultProject.layouts) {
    projectLayouts.set(defaultProject.id, {
      name: defaultProject.name,
      layouts: defaultProject.layouts.map((layout) => ({
        id: layout.id,
        name: layout.name,
        src: layout.src,
        type: layout.type,
        uploaded: layout.uploaded
      }))
    });
  }
  
  // Add saved projects with their layouts
  projects.forEach((project) => {
    if (project.deleted) return;
    if (project.id === defaultProjectId) return;
/* ========================================
   SELECT LAYOUT
   ========================================= */

const selectLayout = (layoutId) => {
  const layout = layouts.find((l) => l.id === layoutId);
  if (!layout) return;
  
  selectedIndex = layouts.findIndex((l) => l.id === layoutId);
  
  // Update the viewer image
  const planImage = document.getElementById('planImage');
  if (planImage) {
    planImage.src = layout.src;
    planImage.alt = layout.name;
    document.getElementById('sheetTitle').textContent = layout.name;
    document.getElementById('sheetType').textContent = layout.type || 'Project drawing';
    document.getElementById('sheetCounter').textContent = `${selectedIndex + 1} / ${layouts.length}`;
  }
  
  // Update the marker layer transform
  markerLayer.style.transform = `translate(var(--pan-x, 0px), var(--pan-y, 0px)) scale(var(--zoom, 1))`;
  
  // Remove existing markers and re-create for new layout
  markerLayer.replaceChildren();
  markersByLayout.clear();
  sessionMarkerPhotos.clear();
  
  // Fetch and create markers for this layout
  createMarkersForLayout(layoutId);
  
  // Update presence
  refreshPresenceUI();
};
    projectLayouts.set(project.id, {
      name: project.name,
      layouts: (project.layouts || []).map((layout) => ({
        id: layout.id,
        name: layout.name,
        src: layout.src,
        type: layout.type,
        uploaded: layout.uploaded
      }))
    });
  });
  
  // Render each project with its layouts
  projectLayouts.forEach((projectData, projectId) => {
    const projectItem = document.createElement('div');
    projectItem.className = 'layout-item has-children';
    projectItem.setAttribute('role', 'button');
    projectItem.setAttribute('tabindex', '0');
    projectItem.setAttribute('aria-expanded', 'false');
    projectItem.setAttribute('aria-label', `${projectData.name} layouts`);
    
    projectItem.innerHTML = `
      <div class="layout-item-title">${projectData.name}</div>
      <button class="toggle-children" aria-label="Show ${projectData.name} layouts" aria-pressed="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><path d="M13 12h5M12 5l-7 7 7 7"/><path d="M5 12h14M12 15l7-7 7 7"/></svg>
      </button>
    `;
    
    // Project click handler
    projectItem.addEventListener('click', (e) => {
      if (e.target.classList.contains('toggle-children') || e.target.parentElement.classList.contains('toggle-children')) {
        const isExpanded = projectItem.getAttribute('aria-expanded') === 'true';
        projectItem.setAttribute('aria-expanded', !isExpanded);
        const subList = projectItem.querySelector('.sub-layout-list');
        if (subList) {
          subList.hidden = isExpanded;
        }
        return;
      }
      
      // Navigate to layout when project header is clicked
      const layoutItem = e.target.closest('.layout-item:not(.has-children)');
      if (layoutItem) {
        const layoutId = layoutItem.dataset.layoutId;
        if (layoutId) {
          selectLayout(layoutId);
        }
      }
    });
    
    // Keyboard accessibility
    projectItem.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        projectItem.click();
      }
    });
    
    // Create sub-layout list
    const subLayoutList = document.createElement('div');
    subLayoutList.className = 'sub-layout-list';
    subLayoutList.id = `sub-layout-${projectId}`;
    subLayoutList.hidden = true;
    
    projectData.layouts.forEach((layout, layoutIndex) => {
      const layoutItem = document.createElement('div');
      layoutItem.className = 'layout-item';
      layoutItem.dataset.layoutId = layout.id;
      layoutItem.innerHTML = `
        <svg class="layout-thumb" aria-hidden="true" viewBox="0 0 66 42"><image href="${layout.src}" width="66" height="42" preserveAspectRatio="xMidYMid slice"/></svg>
        <div class="layout-item-title">${layout.name}</div>
        <div class="layout-item-meta">${layout.type}</div>
      `;
      
      // Add click handler for layout item
      layoutItem.addEventListener('click', () => {
        selectLayout(layout.id);
      });
      
      // Add keyboard accessibility
      layoutItem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          layoutItem.click();
        }
      });
      
      subLayoutList.appendChild(layoutItem);
    });
    
    projectItem.appendChild(subLayoutList);
    layoutList.appendChild(projectItem);
  });
  
  // Update layout count
  const totalLayouts = Array.from(layoutList.querySelectorAll('.layout-item:not(.has-children)')).length;
  document.getElementById('layoutCount').textContent = `${totalLayouts} sheets`;
};
  /* ========================================
   SIDEBAR TOGGLE BUTTON EVENT LISTENER
   ========================================= */

const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
if (sidebarToggleBtn) {
  sidebarToggleBtn.addEventListener('click', toggleSidebar);
}

// Initialize layout list on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderLayoutList);
} else {
  renderLayoutList();
}
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
