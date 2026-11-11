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
      const toast = document.getElementById('toast');
      const layouts = [...builtInLayouts];
      const markersByLayout = new Map();
      const sessionMarkerPhotos = new Map();
      const markerStorageKey = 'mquest-parkview-markers';
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
          const savedMarkers = JSON.parse(localStorage.getItem(markerStorageKey) || '{}');
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
          meta.textContent = layout.uploaded ? 'Added image' : `Sheet ${String(index + 1).padStart(2, '0')}`;
          copy.append(title, meta);
          item.append(thumb, copy);
          item.addEventListener('click', () => selectLayout(index));
          list.append(item);
        });

        document.getElementById('layoutCount').textContent =
          `${String(layouts.length).padStart(2, '0')} ${layouts.length === 1 ? 'sheet' : 'sheets'}`;
      };

      const selectLayout = (index) => {
        if (index < 0 || index >= layouts.length) return;
        closeMarkerEditor();
        selectedIndex = index;
        const layout = layouts[index];
        image.src = layout.src;
        image.alt = `Park View ${layout.name.toLowerCase()}`;
        document.getElementById('sheetTitle').textContent = layout.name;
        document.getElementById('sheetType').textContent = layout.uploaded ? 'Added image' : 'Project drawing';
        document.getElementById('sheetCounter').textContent =
          `${String(index + 1).padStart(2, '0')} / ${String(layouts.length).padStart(2, '0')}`;
        document.getElementById('imageCaption').textContent = `Park View · ${layout.name}`;
        document.getElementById('prevLayout').disabled = index === 0;
        document.getElementById('nextLayout').disabled = index === layouts.length - 1;
        resetView();
        renderList();
        renderMarkers();
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

      document.getElementById('addButton').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (event) => {
        const files = Array.from(event.target.files || []);
        const imageFiles = files.filter((file) => file.type.startsWith('image/'));
        const rejectedCount = files.length - imageFiles.length;
        let storageFailureCount = 0;
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
          if (database) {
            try {
              await saveUpload(upload);
            } catch (error) {
              console.error('Unable to save uploaded layout:', error);
              storageFailureCount += 1;
            }
          } else {
            storageFailureCount += 1;
          }
        }
        selectLayout(lastAddedIndex);
        if (storageFailureCount) {
          announce(`${imageFiles.length} ${imageFiles.length === 1 ? 'layout was' : 'layouts were'} added for this session; ${storageFailureCount} could not be saved.`, true);
        } else if (imageFiles.length && rejectedCount) {
          announce(`${imageFiles.length} ${imageFiles.length === 1 ? 'layout' : 'layouts'} added; ${rejectedCount} non-image ${rejectedCount === 1 ? 'file was' : 'files were'} skipped.`, true);
        } else if (imageFiles.length) {
          announce(`${imageFiles.length} ${imageFiles.length === 1 ? 'layout' : 'layouts'} added.`);
        } else if (rejectedCount) {
          announce('Only image files can be added.', true);
        }
        fileInput.value = '';
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
        const markers = getCurrentMarkers();
        const details = {
          product: document.getElementById('markerProduct').value.trim(),
          weight: document.getElementById('markerWeight').value.trim(),
          location: document.getElementById('markerLocation').value.trim()
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
            photos.push({ id: photo.id, name: photo.name });
          } catch (error) {
            console.error('Unable to save marker photo:', error);
            photoStorageFailed = true;
            sessionMarkerPhotos.set(photo.id, photo.url);
            photos.push({ id: photo.id, name: photo.name });
          }
        }

        for (const photoId of removedMarkerPhotoIds) {
          try {
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
        const saved = persistMarkers();
        if (!saved) {
          announce('Marker saved for this session, but its details could not be saved to browser storage.', true);
        } else if (photoStorageFailed) {
          announce('Marker details saved, but the photo is only available for this session.', true);
        } else {
          announce('Marker saved on this layout.');
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
        const saved = persistMarkers();
        announce(saved ? 'Marker removed from this layout.' : 'Marker removed for this session, but the change could not be saved.', !saved);
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
      restoreUploads();
    })();
