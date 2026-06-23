/**
 * GalleryController
 * Handles the display of gallery events and images.
 */
const GalleryController = (() => {
    let currentGallery = null;
    let currentIndex = 0;

    const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));

    const init = async () => {
        const galleries = await loadGalleries();
        
        // Gallery-specific rendering: only proceed if we are on the gallery page or have gallery elements
        const isGalleryPage = window.location.pathname.includes('gallery.html');
        const gridEl = document.getElementById('gallery-grid');
        
        if (!isGalleryPage && !gridEl) return;

        const params = new URLSearchParams(window.location.search);
        const eventSlug = params.get('event');

        if (eventSlug) {
            currentGallery = galleries.find(g => g.slug === eventSlug);
        }

        renderGalleryList(galleries);
        
        if (currentGallery) {
            renderGallery(currentGallery);
        } else if (!eventSlug) {
            renderGalleryLanding(galleries);
        } else {
            const gridEl = document.getElementById('gallery-grid');
            if (gridEl) {
                gridEl.className = 'gallery-grid';
                gridEl.innerHTML = '<p class="no-data">Gallery event not found.</p>';
            }
        }
    };

    const normalizeGalleries = (galleries) => {
        return (galleries || []).map(g => ({
            ...g,
            images: (g.images || []).map(img => {
                const type = img.type || 'image';
                const src = img.src || img.image;
                return {
                    type,
                    src,
                    thumb: type === 'video' ? (img.thumb || img.thumbnail || '') : (img.thumb || img.thumbnail || src),
                    alt: img.alt || img.caption || g.title
                };
            })
        }));
    };

    const loadGalleries = async () => {
        try {
            // Priority 1: Live metadata from Netlify Blobs
            if (
                typeof DataManager !== 'undefined' &&
                typeof DataManager.loadGalleryLive === 'function' &&
                typeof DataManager.getGalleries === 'function'
            ) {
                const liveLoaded = await DataManager.loadGalleryLive();
                if (liveLoaded) {
                    const liveGalleries = DataManager.getGalleries();
                    if (liveGalleries) {
                        return normalizeGalleries(liveGalleries);
                    }
                }
            }
        } catch (error) {
            console.warn('GalleryController: Live gallery metadata unavailable, using static fallback.', error);
        }

        try {
            // Priority 2: CMS/static gallery data
            if (typeof CMSLoader !== 'undefined') {
                const cmsGalleries = await CMSLoader.loadCmsGalleryData();
                if (cmsGalleries && cmsGalleries.length > 0) {
                    return normalizeGalleries(cmsGalleries);
                }
            }

            // Priority 3: Local data/gallery.json
            const response = await fetch('/data/gallery.json');
            if (response.ok) {
                const data = await response.json();
                if (data.galleries) {
                    return normalizeGalleries(data.galleries);
                }
            }
            
            throw new Error('No file-based data found');
        } catch (error) {
            console.warn('CMS/File data loading failed, falling back to local storage.', error);
            // Priority 4: localStorage (DataManager)
            const localGalleries = (typeof DataManager !== 'undefined' && typeof DataManager.getGalleries === 'function')
                ? DataManager.getGalleries()
                : [];
            return normalizeGalleries(localGalleries);
        }
    };

    const setGallerySelectorVisible = (isVisible) => {
        const selectorEl = document.querySelector('.gallery-selector');
        if (selectorEl) {
            selectorEl.hidden = !isVisible;
        }
    };

    const renderGalleryList = (galleries) => {
        const selectEl = document.getElementById('gallery-event-select');
        if (!selectEl) return;

        const selectorGalleries = galleries.filter(gallery =>
            gallery.published !== false || (currentGallery && currentGallery.slug === gallery.slug)
        );

        selectEl.innerHTML = selectorGalleries.map(gallery => `
            <option value="${escapeHtml(gallery.slug)}" ${currentGallery && currentGallery.slug === gallery.slug ? 'selected' : ''}>${escapeHtml(gallery.title)}</option>
        `).join('');

        selectEl.onchange = () => {
            if (selectEl.value) {
                window.location.href = `gallery.html?event=${encodeURIComponent(selectEl.value)}`;
            }
        };
    };

    const renderGalleryLanding = (galleries) => {
        currentGallery = null;
        const titleEl = document.getElementById('gallery-title');
        const gridEl = document.getElementById('gallery-grid');

        if (titleEl) titleEl.innerText = 'Photo Gallery';
        setGallerySelectorVisible(false);
        if (!gridEl) return;

        if (!galleries || galleries.length === 0) {
            gridEl.className = 'gallery-grid';
            gridEl.innerHTML = '<p class="no-data">No gallery events found.</p>';
            return;
        }

        gridEl.className = 'gallery-card-grid';
        gridEl.innerHTML = galleries.map(gallery => {
            const firstImage = gallery.images && gallery.images.length > 0 ? gallery.images.find(img => (img.type || 'image') === 'image') : null;
            const previewImage = gallery.coverImage || (firstImage && (firstImage.thumb || firstImage.src));
            const photoCount = gallery.images ? gallery.images.length : 0;
            const photoLabel = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;

            return `
                <a href="gallery.html?event=${gallery.slug}" class="gallery-event-card">
                    ${previewImage ? `
                        <img src="${previewImage}" alt="${escapeHtml(gallery.title)}" loading="lazy">
                    ` : `
                        <div class="gallery-card-placeholder" aria-hidden="true">Photo Gallery</div>
                    `}
                    <div class="gallery-card-content">
                        <h3>${escapeHtml(gallery.title)}</h3>
                        <p>${photoLabel}</p>
                        <span class="gallery-card-link">View Gallery</span>
                    </div>
                </a>
            `;
        }).join('');
    };

    const renderGallery = (gallery) => {
        currentGallery = gallery;
        const titleEl = document.getElementById('gallery-title');
        const gridEl = document.getElementById('gallery-grid');
        
        if (titleEl) titleEl.innerText = gallery.title;
        setGallerySelectorVisible(true);
        if (!gridEl) return;
        
        gridEl.className = 'gallery-grid';

        if (!gallery.images || gallery.images.length === 0) {
            gridEl.innerHTML = '<p class="no-data">This gallery is empty.</p>';
            return;
        }

        gridEl.innerHTML = gallery.images.map((img, index) => {
            const mediaType = img.type || 'image';
            const captionText = img.alt || '';
            const caption = escapeHtml(captionText);
            const descriptionHtml = `<span class="caption-text">${caption}</span><span class="caption-counter">${index + 1} of ${gallery.images.length}</span>`;
            const descriptionAttr = escapeHtml(descriptionHtml);

            if (mediaType === 'video') {
                return `
                    <a href="${img.src}" class="glightbox gallery-item"
                       data-gallery="gallery-${gallery.slug}"
                       data-type="video"
                       data-description="${descriptionAttr}">
                        ${img.thumb ? `
                            <img src="${img.thumb}" alt="${caption}" loading="lazy">
                        ` : `
                            <video src="${img.src}" muted preload="metadata"></video>
                        `}
                        <div class="overlay">${captionText ? caption : 'Video'}</div>
                    </a>
                `;
            }

            return `
                <a href="${img.src}" class="glightbox gallery-item"
                   data-gallery="gallery-${gallery.slug}"
                   data-description="${descriptionAttr}">
                    <img src="${img.thumb}" alt="${caption}" loading="lazy">
                    <div class="overlay">${caption}</div>
                </a>
            `;
        }).join('');
        
        // Initialize GLightbox after rendering
        if (typeof window.initGLightbox === 'function') {
            setTimeout(() => window.initGLightbox(), 100);
        }
    };

    return {
        init
    };
})();

// Auto-init on page load
document.addEventListener('DOMContentLoaded', GalleryController.init);
