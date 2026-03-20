/**
 * CMSLoader
 * Utility for fetching CMS-managed JSON data with safe fallbacks.
 */
const CMSLoader = (() => {
    const PATHS = {
        background: '/admin/content/site-settings/background-images.json',
        gallery: '/admin/content/gallery-data.json',
        news: '/admin/content/news.json',
        events: '/admin/content/events.json',
        clubInfo: '/admin/content/site-settings/club-info.json',
        quickLinks: '/admin/content/site-settings/quick-links.json'
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

    /**
     * Loads news posts from CMS.
     * @returns {Promise<any|[]>}
     */
    const loadCmsNews = async () => {
        const data = await safeFetch(PATHS.news);
        return (data && Array.isArray(data.news)) ? data.news : [];
    };

    /**
     * Loads events from CMS.
     * @returns {Promise<any|[]>}
     */
    const loadCmsEvents = async () => {
        const data = await safeFetch(PATHS.events);
        return (data && Array.isArray(data.events)) ? data.events : [];
    };

    /**
     * Loads club contact/meeting info from CMS.
     * @returns {Promise<any|null>}
     */
    const loadCmsClubInfo = async () => {
        return await safeFetch(PATHS.clubInfo);
    };

    /**
     * Loads quick links from CMS.
     * @returns {Promise<any|[]>}
     */
    const loadCmsQuickLinks = async () => {
        const data = await safeFetch(PATHS.quickLinks);
        return (data && Array.isArray(data.links)) ? data.links : [];
    };

    return {
        loadCmsBackgroundSettings,
        loadCmsGalleryData,
        loadCmsNews,
        loadCmsEvents,
        loadCmsClubInfo,
        loadCmsQuickLinks
    };
})();
