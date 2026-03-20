/**
 * GalleryController
 * Handles the display of gallery events and images.
 */
const GalleryController = (() => {
    let currentGallery = null;
    let currentIndex = 0;

    const init = async () => {
        const galleries = await loadGalleries();
        
        // Always update navigation dropdowns globally
        updateNavigationDropdown(galleries);

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
        } else {
            // Show latest event or default view
            if (galleries.length > 0) {
                renderGallery(galleries[0]);
            } else {
                const contentEl = document.getElementById('gallery-content');
                if (contentEl) contentEl.innerHTML = '<p class="no-data">No gallery events found.</p>';
            }
        }
    };

    const loadGalleries = async () => {
        try {
            // Priority 1: CMS Data
            if (typeof CMSLoader !== 'undefined') {
                const cmsGalleries = await CMSLoader.loadCmsGalleryData();
                if (cmsGalleries && cmsGalleries.length > 0) {
                    // Normalize CMS structure: mapping 'image' to 'src' and handling thumbnails
                    return cmsGalleries.map(g => ({
                        ...g,
                        images: (g.images || []).map(img => ({
                            src: img.image,
                            thumb: img.thumbnail || img.image,
                            alt: img.caption || g.title
                        }))
                    }));
                }
            }

            // Priority 2: Local data/gallery.json
            const response = await fetch('/data/gallery.json');
            if (response.ok) {
                const data = await response.json();
                if (data.galleries) {
                    // Normalize local file format (it might use src/alt already)
                    return data.galleries.map(g => ({
                        ...g,
                        images: (g.images || []).map(img => ({
                            src: img.src || img.image,
                            thumb: img.thumb || img.thumbnail || img.src || img.image,
                            alt: img.alt || img.caption || g.title
                        }))
                    }));
                }
            }
            
            throw new Error('No file-based data found');
        } catch (error) {
            console.warn('CMS/File data loading failed, falling back to local storage.', error);
            // Priority 3: localStorage (DataManager)
            const localGalleries = (typeof DataManager !== 'undefined' && typeof DataManager.getGalleries === 'function')
                ? DataManager.getGalleries()
                : [];
            return localGalleries.map(g => ({
                ...g,
                images: (g.images || []).map(img => ({
                    src: img.src || img.image,
                    thumb: img.thumb || img.thumbnail || img.src || img.image,
                    alt: img.alt || img.caption || g.title
                }))
            }));
        }
    };

    const renderGalleryList = (galleries) => {
        const listEl = document.getElementById('gallery-nav-list');
        if (!listEl) return;

        listEl.innerHTML = galleries.map(g => `
            <li><a href="gallery.html?event=${g.slug}" class="${currentGallery && currentGallery.slug === g.slug ? 'active' : ''}">${g.title}</a></li>
        `).join('');
    };

    const renderGallery = (gallery) => {
        currentGallery = gallery;
        const titleEl = document.getElementById('gallery-title');
        const gridEl = document.getElementById('gallery-grid');
        
        if (titleEl) titleEl.innerText = gallery.title;
        if (!gridEl) return;
        
        if (!gallery.images || gallery.images.length === 0) {
            gridEl.innerHTML = '<p class="no-data">This gallery is empty.</p>';
            return;
        }

        gridEl.innerHTML = gallery.images.map((img, index) => `
            <a href="${img.src}" class="glightbox gallery-item" data-gallery="gallery-${gallery.slug}">
                <img src="${img.thumb}" alt="${img.alt}" loading="lazy">
                <div class="overlay">${img.alt || ''}</div>
            </a>
        `).join('');
        
        // Initialize GLightbox after rendering
        if (typeof window.initGLightbox === 'function') {
            setTimeout(() => window.initGLightbox(), 100);
        }
    };

    const updateNavigationDropdown = (galleries) => {
        // This will be called on all pages to populate the dropdown
        const dropdowns = document.querySelectorAll('.gallery-dropdown-content');
        dropdowns.forEach(dropdown => {
            dropdown.innerHTML = galleries.map(g => `
                <a href="gallery.html?event=${g.slug}">${g.title}</a>
            `).join('') + '<a href="gallery.html" style="border-top: 1px solid rgba(255,255,255,0.1); font-weight: bold;">View All Galleries</a>';
        });
    };

    return {
        init
    };
})();

// Auto-init on page load
document.addEventListener('DOMContentLoaded', GalleryController.init);
