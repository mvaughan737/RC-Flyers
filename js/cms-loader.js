/**
 * CMSLoader
 * Utility for fetching CMS-managed JSON data with safe fallbacks.
 */
const CMSLoader = (() => {
    const PATHS = {
        background: '/admin/content/site-settings/background-images.json',
        gallery: '/admin/content/gallery-data.json'
    };

    /**
     * Safely fetches a JSON file.
     * @param {string} path 
     * @returns {Promise<any|null>}
     */
    const safeFetch = async (path) => {
        try {
            const response = await fetch(path);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.warn(`CMSLoader: Failed to fetch ${path}`, error);
            return null;
        }
    };

    /**
     * Loads background settings from CMS.
     * @returns {Promise<any|null>}
     */
    const loadCmsBackgroundSettings = async () => {
        return await safeFetch(PATHS.background);
    };

    /**
     * Loads gallery data from CMS.
     * @returns {Promise<any|[]>}
     */
    const loadCmsGalleryData = async () => {
        const data = await safeFetch(PATHS.gallery);
        return (data && Array.isArray(data.galleries)) ? data.galleries : [];
    };

    return {
        loadCmsBackgroundSettings,
        loadCmsGalleryData
    };
})();
