/**
 * DataManager
 * Handles all dynamic content for the Converse Flying Eagles website using localStorage.
 */
const DataManager = (() => {
    const STORAGE_KEY = 'flying_eagles_data';
    const GITHUB_KEY = 'flying_eagles_github';

    // Initial default data
    const defaults = {
        settings: {
            email: 'geomarfar@gmail.com',
            phone: '(765) 555-0123',
            meetingTime: '1st Tuesday of the month, 6pm',
            meetingPlace: 'At the field (Winter: Marty’s hangar)',
            address: 'PO Box 214, Converse, IN. 46919',
            coordinates: '40.575675, -85.900127',
            heroImage: 'images/converse_bg.jpg',
            galleryImages: [
                'images/Converse_Title_Picture.jpg',
                'images/converse_bg.jpg',
                'images/hero.jpg',
                'images/mission_card.jpg',
                'images/trainer.jpg'
            ]
        },
        links: [
            { id: 1, title: 'FAA Trust Test', url: 'https://www.modelaircraft.org/trust' },
            { id: 2, title: 'AMA Membership', url: 'https://www.modelaircraft.org/membership/enroll' },
            { id: 3, title: 'AMA Safety Code', url: 'https://www.modelaircraft.org/files/100.pdf' },
            { id: 4, title: 'RC Flight Simulator', url: 'https://www.realflight.com/' },
            { id: 5, title: 'Weather Status', url: 'weather_final.html' }
        ],
        news: [
            { id: 1, title: 'Spring Fun Fly 2026', date: '2026-03-15', content: 'Registration is now open for our annual spring event!' },
            { id: 2, title: 'Safety Update', date: '2026-03-10', content: 'New FAA regulations regarding FRIA zones have been updated.' }
        ],
        events: [
            { id: 1, title: 'Indoor Fly', date: '2026-03-21', time: '9am', location: 'Amboy Friends Church' },
            { id: 2, title: 'Combat', date: '2026-05-16', time: 'TBD', location: 'Main Field' },
            { id: 3, title: 'Egg Drop Competition', date: '2026-06-20', time: 'TBD', location: 'Main Field' }
        ],
        galleries: [
            { 
                id: 1, 
                title: 'Converse Fun Fly 2026', 
                slug: 'converse-fun-fly-2026', 
                date: '2026-03-15',
                images: [
                    { src: 'images/Converse_Title_Picture.jpg', alt: 'Fun Fly 2026' }
                ]
            }
        ]
    };

    let data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaults;
    let github = JSON.parse(localStorage.getItem(GITHUB_KEY)) || { owner: 'mvaughan737', repo: 'RC-Flyers', branch: 'main', token: '' };
    
    // Ensure core links are always present
    const coreTitles = defaults.links.map(l => l.title);
    defaults.links.forEach(defaultLink => {
        if (!data.links.some(l => l.title === defaultLink.title)) {
            data.links.push(defaultLink);
        }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const save = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    };

    const saveGithub = () => {
        localStorage.setItem(GITHUB_KEY, JSON.stringify(github));
    };

    return {
        // Settings
        getSettings: () => data.settings,
        updateSettings: (newSettings) => {
            data.settings = { ...data.settings, ...newSettings };
            save();
        },

        // News
        getNews: () => data.news,
        addNews: (item) => {
            item.id = Date.now();
            data.news.unshift(item);
            save();
        },
        updateNews: (id, updated) => {
            const index = data.news.findIndex(n => n.id === id);
            if (index !== -1) {
                data.news[index] = { ...data.news[index], ...updated };
                save();
            }
        },
        deleteNews: (id) => {
            data.news = data.news.filter(n => n.id !== id);
            save();
        },

        // Events
        getEvents: () => data.events,
        loadEventsFromSource: async () => {
            try {
                // Fetch from the shared published source
                const response = await fetch('/admin/content/events.json?cb=' + Date.now());
                if (response.ok) {
                    const remote = await response.json();
                    if (remote && Array.isArray(remote.events)) {
                        // Merge logic: Prioritize remote data for public site
                        // but if we are in admin, we might want to keep local changes.
                        // For now, we update local data but keep the 'published' state in mind.
                        data.events = remote.events;
                        data.events.sort((a, b) => new Date(a.date) - new Date(b.date));
                        save();
                        return true;
                    }
                }
            } catch (err) {
                console.warn('DataManager: Failed to load remote events', err);
            }
            return false;
        },
        addEvent: (item) => {
            item.id = Date.now();
            data.events.push(item);
            data.events.sort((a, b) => new Date(a.date) - new Date(b.date));
            save();
        },
        updateEvent: (id, updated) => {
            const index = data.events.findIndex(e => e.id === id);
            if (index !== -1) {
                data.events[index] = { ...data.events[index], ...updated };
                data.events.sort((a, b) => new Date(a.date) - new Date(b.date));
                save();
            }
        },
        deleteEvent: (id) => {
            data.events = data.events.filter(e => e.id !== id);
            save();
        },

        // GitHub / Publishing
        getGithubSettings: () => github,
        updateGithubSettings: (newSettings) => {
            github = { ...github, ...newSettings };
            saveGithub();
        },
        publishEvents: async () => {
            if (!github.token) throw new Error('GitHub Token not found.');
            
            const path = 'admin/content/events.json';
            const url = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/${path}`;
            
            // 1. Get current file data (to get SHA)
            const getRes = await fetch(url, {
                headers: { 'Authorization': `token ${github.token}` }
            });
            
            let sha = null;
            if (getRes.ok) {
                const fileData = await getRes.json();
                sha = fileData.sha;
            }

            // 2. Prepare content
            const content = btoa(JSON.stringify({ events: data.events }, null, 2));
            
            // 3. Commit change
            const putRes = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${github.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Update events via Admin Dashboard [${new Date().toLocaleString()}]`,
                    content: content,
                    sha: sha,
                    branch: github.branch
                })
            });

            if (!putRes.ok) {
                const err = await putRes.json();
                throw new Error(err.message || 'Failed to publish to GitHub.');
            }

            return true;
        },

        // Links
        getLinks: () => data.links,
        addLink: (link) => {
            link.id = Date.now();
            data.links.push(link);
            save();
        },
        updateLink: (id, updated) => {
            const index = data.links.findIndex(l => l.id === id);
            if (index !== -1) {
                data.links[index] = { ...data.links[index], ...updated };
                save();
            }
        },
        deleteLink: (id) => {
            data.links = data.links.filter(l => l.id !== id);
            save();
        },

        // Galleries
        getGalleries: () => data.galleries || [],
        addGallery: (gallery) => {
            gallery.id = Date.now();
            if (!data.galleries) data.galleries = [];
            data.galleries.push(gallery);
            save();
        },
        updateGallery: (id, updated) => {
            const index = data.galleries.findIndex(g => g.id === id);
            if (index !== -1) {
                data.galleries[index] = { ...data.galleries[index], ...updated };
                save();
            }
        },
        deleteGallery: (id) => {
            data.galleries = data.galleries.filter(g => g.id !== id);
            save();
        },
        updateGalleries: (newList) => {
            data.galleries = newList;
            save();
        }
    };
})();
