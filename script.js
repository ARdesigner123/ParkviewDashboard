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
      const layouts = [...builtInLayouts];
      const markersByLayout = new Map();
      const sessionMarkerPhotos = new Map();
      const markerCloudConfig = window.PARKVIEW_SUPABASE;
      const currentHostname = window.location.hostname.toLowerCase();
      const markerCloudSiteId = (markerCloudConfig.siteIds || {})[currentHostname] ||
        currentHostname || 'parkviewdashboard';
      const legacyMarkerStorageKey = 'mquest-parkview-markers';
      const markerStorageKey = `${legacyMarkerStorageKey}:${markerCloudSiteId}`;
      const getMarkerCloudRestUrl = () => markerCloudConfig.restUrl.endsWith('/')
        ? markerCloudConfig.restUrl.slice(0, -1)
        : markerCloudConfig.restUrl;
      let selectedIndex = 0;
      let zoom = 1;
      let panX = 0;
      let panY = 0;
      let drag = null;
      let markerMode = false;
      let draftMarkerPoint = null;
      let editingMarkerId = null;
      let toastTimer;
      let database = null;
      let databasePromise = null;
      let markerSyncPromise = Promise.resolve();
      let layoutSyncPromise = Promise.resolve();
      let layoutSyncInProgress = false;
      let layoutToRename = null;
      let layoutToDelete = null;
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

      const announce = (message, isError = false) => {
        toast.textContent = message;
        toast.classList.toggle('error', isError);
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
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
        product: marker.product || '',
        weight: marker.weight || '',
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

      const renderMarkers = () => {
        markerLayer.replaceChildren();
        if (!layouts.length) return;
        const bounds = getImageBounds();
        if (!bounds) return;

        getCurrentMarkers().forEach((marker) => {
          const pin = document.createElement('button');
          pin.type = 'button';
          pin.className = 'map-marker';
          pin.style.left = `${bounds.left + marker.x * bounds.width}px`;
          pin.style.top = `${bounds.top + marker.y * bounds.height}px`;
          pin.setAttribute('aria-label', `Marker: ${marker.product || marker.location || 'Layout detail'}`);
          pin.title = marker.product || marker.location || 'Layout marker';
          pin.innerHTML = '<svg viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M12 27s10-9.2 10-16A10 10 0 1 0 2 11c0 6.8 10 16 10 16Z" fill="currentColor"/><circle cx="12" cy="10.5" r="3.2" fill="white"/></svg>';
          pin.addEventListener('click', (event) => {
            event.stopPropagation();
            const markerX = bounds.left + marker.x * bounds.width;
            const markerY = bounds.top + marker.y * bounds.height;
            const screenX = stage.clientWidth / 2 + (markerX - stage.clientWidth / 2) * zoom + panX;
            const screenY = stage.clientHeight / 2 + (markerY - stage.clientHeight / 2) * zoom + panY;
            setMarkerMode(false);
            showMarkerEditor(screenX, screenY, marker);
          });
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

      const closeMarkerEditor = () => {
        photoLoadToken += 1;
        closePhotoViewer();
        pendingMarkerPhotos.forEach((photo) => {
          if (sessionMarkerPhotos.get(photo.id) !== photo.url) URL.revokeObjectURL(photo.url);
        });
        markerEditor.hidden = true;
        editingMarkerId = null;
        draftMarkerPoint = null;
        pendingMarkerPhotos = [];
        removedMarkerPhotoIds = new Set();
        markerPhotoInput.value = '';
        markerPhotoGallery.replaceChildren();
        setMarkerMode(false);
      };

      const createPhotoCard = (photo, url, isPending = false) => {
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

      const renderMarkerPhotos = (marker) => {
        markerPhotoGallery.replaceChildren();
        const currentPhotoLoad = photoLoadToken;
        if (!marker) {
          pendingMarkerPhotos.forEach((photo) => markerPhotoGallery.append(createPhotoCard(photo, photo.url, true)));
          return;
        }

        const photos = Array.isArray(marker.photos)
          ? marker.photos
          : marker.photoId ? [{ id: marker.photoId, name: marker.photoName || 'Saved image' }] : [];
        photos.filter((photo) => !removedMarkerPhotoIds.has(photo.id)).forEach((photo) => {
          const cachedUrl = sessionMarkerPhotos.get(photo.id);
          if (cachedUrl) {
            markerPhotoGallery.append(createPhotoCard(photo, cachedUrl));
            return;
          }
          if (photo.path) {
            markerPhotoGallery.append(createPhotoCard(photo, getMarkerPhotoPublicUrl(photo.path)));
            return;
          }
          const placeholder = document.createElement('div');
          placeholder.className = 'marker-photo-card marker-photo-loading';
          placeholder.textContent = 'Loading image…';
          markerPhotoGallery.append(placeholder);
          openDatabase()
            .then(() => getMarkerPhoto(photo.id))
            .then((savedPhoto) => {
              if (currentPhotoLoad !== photoLoadToken || markerEditor.hidden || editingMarkerId !== marker.id) return;
              if (!savedPhoto || !savedPhoto.blob) throw new Error(`Could not find ${photo.name || 'a saved marker image'}.`);
              const url = URL.createObjectURL(savedPhoto.blob);
              sessionMarkerPhotos.set(photo.id, url);
              placeholder.replaceWith(createPhotoCard(photo, url));
            })
            .catch((error) => {
              if (currentPhotoLoad !== photoLoadToken || markerEditor.hidden || editingMarkerId !== marker.id) return;
              console.error('Unable to load marker photo:', error);
              placeholder.textContent = 'Image unavailable';
              announce(error.message || 'Could not load a saved marker image.', true);
            });
        });
        pendingMarkerPhotos.forEach((photo) => markerPhotoGallery.append(createPhotoCard(photo, photo.url, true)));
      };

      const showMarkerEditor = (x, y, marker = null) => {
        photoLoadToken += 1;
        pendingMarkerPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
        editingMarkerId = marker ? marker.id : null;
        draftMarkerPoint = marker ? null : { x: draftMarkerPoint.x, y: draftMarkerPoint.y };
        pendingMarkerPhotos = [];
        removedMarkerPhotoIds = new Set();
        markerPhotoInput.value = '';
        document.getElementById('markerEditorTitle').textContent = marker ? 'Edit marker' : 'Add a marker';
        document.getElementById('markerProduct').value = marker ? marker.product : '';
        document.getElementById('markerWeight').value = marker ? marker.weight || '' : '';
        document.getElementById('markerLocation').value = marker ? marker.location : '';
        document.getElementById('markerServiceDate').value = marker ? marker.serviceDate || '' : '';
        document.getElementById('markerManufacturingDate').value = marker ? marker.manufacturingDate || '' : '';
        document.getElementById('markerDelete').hidden = !marker;
        markerEditor.hidden = false;
        photoLoadToken += 1;
        renderMarkerPhotos(marker);
        requestAnimationFrame(() => {
          const left = Math.max(8, Math.min(x + 12, stage.clientWidth - markerEditor.offsetWidth - 8));
          const top = Math.max(8, Math.min(y + 12, stage.clientHeight - markerEditor.offsetHeight - 8));
          markerEditor.style.left = `${left}px`;
          markerEditor.style.top = `${top}px`;
          document.getElementById('markerProduct').focus();
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
          renderList();
          renderMarkers();
          return;
        }
        markerToggle.disabled = false;
        const layout = layouts[selectedIndex];
        image.src = layout.src;
        image.alt = `Park View ${layout.name.toLowerCase()}`;
        document.getElementById('sheetTitle').textContent = layout.name;
        document.getElementById('sheetType').textContent = layout.uploaded ? 'Added image' : 'Project drawing';
        document.getElementById('sheetCounter').textContent =
          `${String(selectedIndex + 1).padStart(2, '0')} / ${String(layouts.length).padStart(2, '0')}`;
        document.getElementById('imageCaption').textContent = `Park View · ${layout.name}`;
        document.getElementById('prevLayout').disabled = selectedIndex === 0;
        document.getElementById('nextLayout').disabled = selectedIndex === layouts.length - 1;
        renderList();
        renderMarkers();
      };

      const selectLayout = (index) => {
        closeMarkerEditor();
        if (!layouts.length) {
          updateSelectedLayout();
          return;
        }
        if (index < 0 || index >= layouts.length) return;
        selectedIndex = index;
        resetView();
        updateSelectedLayout();
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
            const existingIndex = layouts.findIndex((layout) => layout.id === row.layout_id);
            if (row.deleted) {
              if (existingIndex !== -1) {
                removeLayoutLocally(existingIndex);
                structureChanged = true;
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
              layouts.push({
                id: row.layout_id,
                name: row.name,
                src: imageUrl,
                type: 'Added image',
                uploaded: true,
                imagePath: row.image_path,
                updatedAt: row.updated_at
              });
              structureChanged = true;
            } else {
              const layout = layouts[existingIndex];
              const imageChanged = Boolean(imageUrl &&
                (layout.imagePath !== row.image_path || layout.updatedAt !== row.updated_at));
              if (layout.name !== row.name || imageChanged) {
                if (layout.id === selectedLayoutId) selectedLayoutChanged = true;
              }
              layout.name = row.name;
              layout.imagePath = row.image_path;
              layout.updatedAt = row.updated_at;
              if (imageChanged) layout.src = imageUrl;
            }
          }

          for (const layout of layouts) {
            if (knownRemoteLayouts.has(layout.id)) continue;
            if (layout.uploaded && layout.src.startsWith('blob:')) {
              const upload = (await getSavedUploads()).find((saved) => saved.id === layout.id);
              if (upload) await saveCloudLayoutState(layout, { imageFile: upload.blob });
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
            if (layouts.some((layout) => layout.id === upload.id)) return;
            layouts.push({
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
        let storageFailureCount = 0;
        let cloudFailureCount = 0;
        if (files.length === 0) return;

        let lastAddedIndex = selectedIndex;
        for (const file of imageFiles) {
          const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const upload = { id, name: file.name, blob: file, createdAt: Date.now() };
          const layout = {
            id,
            name: file.name,
            src: URL.createObjectURL(file),
            type: 'Added image',
            uploaded: true
          };
          layouts.push(layout);
          lastAddedIndex = layouts.length - 1;
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
        selectLayout(lastAddedIndex);
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

      layoutRenameForm.addEventListener('submit', async (event) => {
        event.preventDefault();
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
      });
      layoutRenameDialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        layoutRenameDialog.hidden = true;
        layoutToRename = null;
      });

      document.getElementById('layoutDeleteCancel').addEventListener('click', () => {
        layoutConfirm.hidden = true;
        layoutToDelete = null;
      });
      document.getElementById('layoutDeleteConfirm').addEventListener('click', async (event) => {
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
        setMarkerMode(true);
        announce('Marker mode is on. Click a spot on the layout to add a marker.');
      });

      stage.addEventListener('click', (event) => {
        if (!markerMode || event.target.closest('button, .marker-editor')) return;
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
          product: document.getElementById('markerProduct').value.trim(),
          weight: document.getElementById('markerWeight').value.trim(),
          location: document.getElementById('markerLocation').value.trim(),
          serviceDate: document.getElementById('markerServiceDate').value,
          manufacturingDate: document.getElementById('markerManufacturingDate').value
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
        if (markerMode || event.button !== 0 || zoom <= 1 || event.target.closest('button')) return;
        drag = { x: event.clientX, y: event.clientY, panX, panY };
        stage.classList.add('is-dragging');
        stage.setPointerCapture(event.pointerId);
      });
      stage.addEventListener('pointermove', (event) => {
        if (!drag) return;
        panX = drag.panX + event.clientX - drag.x;
        panY = drag.panY + event.clientY - drag.y;
        updateTransform();
      });
      const endDrag = () => {
        drag = null;
        stage.classList.remove('is-dragging');
      };
      stage.addEventListener('pointerup', endDrag);
      stage.addEventListener('pointercancel', endDrag);

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !photoViewer.hidden) {
          event.preventDefault();
          closePhotoViewer();
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
      restoreMarkers();
      selectLayout(0);
      layoutSyncPromise = restoreUploads().then(() => syncLayoutsFromCloud()).catch((error) => {
        console.error('Unable to sync shared layouts:', error);
        announce('Could not sync shared layouts. Showing layouts saved on this device.', true);
      });
      markerSyncPromise = refreshSharedMarkers();
      setInterval(() => {
        markerSyncPromise = refreshSharedMarkers();
        layoutSyncPromise = syncLayoutsFromCloud().catch((error) => {
          console.error('Unable to sync shared layouts:', error);
        });
      }, 5000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          markerSyncPromise = refreshSharedMarkers();
          layoutSyncPromise = syncLayoutsFromCloud().catch((error) => {
            console.error('Unable to sync shared layouts:', error);
          });
        }
      });
      window.addEventListener('focus', () => {
        markerSyncPromise = refreshSharedMarkers();
        layoutSyncPromise = syncLayoutsFromCloud().catch((error) => {
          console.error('Unable to sync shared layouts:', error);
        });
      });
    })();
