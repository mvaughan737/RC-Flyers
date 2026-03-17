/**
 * Status & METAR Manager
 * Synchronizes field status and METAR weather across the site
 */

const METAR_STATIONS = {
    'KOKK': { name: 'Kokomo Muni', lat: 40.528, lon: -86.059, dist: '8 nm W', zoom: 11 },
    'KMZZ': { name: 'Marion Muni', lat: 40.490, lon: -85.679, dist: '11 nm SE', zoom: 10 },
    'KGUS': { name: 'Grissom ARB', lat: 40.648, lon: -86.152, dist: '13 nm W', zoom: 10 }
};

const CLUB_COORDS = { lat: 40.575675, lon: -85.900127 };

const StatusManager = {
    // Current state
    state: {
        station: localStorage.getItem('metar_station') || 'KOKK',
        manualStatus: JSON.parse(localStorage.getItem('field_status_manual')) || null,
        weatherData: {}, // Store live METAR data
        lastSync: null
    },

    getCompassDirection: function(deg) {
        if (deg === null || deg === undefined) return 'Calm';
        if (deg === -1) return 'VRB'; // Variable
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.floor((deg / 22.5) + 0.5) % 16;
        return directions[index];
    },

    // Standard solar geometric algorithm for sunset calculation
    calculateSunset: function(lat, lon, date = new Date()) {
        const rad = Math.PI / 180;
        const day = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
        const zenith = 90.833 * rad; // Standard sunset zenith
        
        const lamda = (day + (18 - lon / 15) / 24) * 0.017202;
        const M = 6.24004077 + 0.01720197 * (day + (18 - lon / 15) / 24);
        const L = lamda + (0.033423055 * Math.sin(M)) + (0.000349066 * Math.sin(2 * M)) + 4.93289;
        
        const decl = Math.asin(Math.sin(L) * Math.sin(23.439 * rad));
        const H = (Math.cos(zenith) - (Math.sin(lat * rad) * Math.sin(decl))) / (Math.cos(lat * rad) * Math.cos(decl));
        
        if (H > 1) return null; // Always night
        if (H < -1) return null; // Always day
        
        const sunsetUTC = 12 - (Math.acos(H) / rad + lon) / 15;
        // Wait, the standard formula for Sunset UTC is:
        // Transit = 12 - lon/15 - EqT
        // Sunset = Transit + H/15
        // Let's use a simpler approach for the sign of longitude
        
        const sunsetTimeUTC = 12 - (lon / 15) + (Math.acos(H) / rad) / 15;
        const hours = Math.floor(sunsetTimeUTC % 24);
        const minutes = Math.floor((sunsetTimeUTC % 1) * 60);
        
        // Basic timezone adjustment (EDT is UTC-4)
        let sunsetHour = hours - 4;
        if (sunsetHour < 0) sunsetHour += 24;
        
        const ampm = sunsetHour >= 12 ? 'PM' : 'AM';
        const displayHour = sunsetHour % 12 || 12;
        return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    },

    getWeatherIcon: function(weather) {
        const icons = {
            ts: `
                <svg class="weather-icon anim-thunder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 11h-4V3L5 13h4v8z" fill="#FFD700" stroke="#000080"/>
                </svg>`,
            rain: `
                <svg class="weather-icon anim-rain" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
                    <line class="rain-drop" x1="8" y1="13" x2="8" y2="21" />
                    <line class="rain-drop" x1="12" y1="15" x2="12" y2="23" />
                    <line class="rain-drop" x1="16" y1="13" x2="16" y2="21" />
                </svg>`,
            snow: `
                <svg class="weather-icon anim-snow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
                    <line class="snow-flake" x1="8" y1="13" x2="8" y2="13.01" />
                    <line class="snow-flake" x1="12" y1="15" x2="12" y2="15.01" />
                    <line class="snow-flake" x1="16" y1="13" x2="16" y2="13.01" />
                </svg>`,
            fog: `
                <svg class="weather-icon anim-fog" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="4" y1="10" x2="20" y2="10" />
                    <line x1="6" y1="14" x2="18" y2="14" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                </svg>`,
            haze: `
                <svg class="weather-icon anim-haze" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="8" y1="8" x2="16" y2="8" />
                    <line x1="6" y1="12" x2="18" y2="12" />
                    <line x1="8" y1="16" x2="16" y2="16" />
                </svg>`,
            overcast: `
                <svg class="weather-icon anim-drift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.3-1.7-4.2-3.9-4.5C17.6 6.5 14.2 4 10.5 4 6.9 4 3.9 6.5 3.4 9.8 1.4 10.3 0 12.2 0 14.5 0 17 2 19 4.5 19h13z" fill="rgba(255,255,255,0.2)"/>
                </svg>`,
            broken: `
                <svg class="weather-icon anim-drift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v2"/><path d="M4.2 4.2l1.4 1.4"/><path d="M20 12h2"/><circle cx="12" cy="12" r="3" fill="#FFD700"/>
                    <path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.3-1.7-4.2-3.9-4.5C17.6 6.5 14.2 4 10.5 4 6.9 4 3.9 6.5 3.4 9.8 1.4 10.3 0 12.2 0 14.5 0 17 2 19 4.5 19h13z" fill="rgba(255,255,255,0.1)"/>
                </svg>`,
            scattered: `
                <svg class="weather-icon anim-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5" fill="#FFD700" fill-opacity="0.3"/>
                    <path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.3-1.7-4.2-3.9-4.5C17.6 6.5 14.2 4 10.5 4 6.9 4 3.9 6.5 3.4 9.8 1.4 10.3 0 12.2 0 14.5 0 17 2 19 4.5 19h13z" fill="rgba(255,255,255,0.1)"/>
                </svg>`,
            clear: `
                <svg class="weather-icon anim-rotate" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5" fill="#FFD700"/>
                    <path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.2 4.2l1.4 1.4"/><path d="M18.4 18.4l1.4 1.4"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.2 19.8l1.4-1.4"/><path d="M18.4 5.6l1.4-1.4"/>
                </svg>`,
            wind: `
                <svg class="weather-icon anim-wind" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.7 7.7A2.5 2.5 0 1 1 15 12H3"/><path d="M9.7 17.7A2.5 2.5 0 1 0 12 14H3"/>
                </svg>`
        };

        const ws = weather.wxString ? weather.wxString.toLowerCase() : '';
        const windKt = weather.wspd || 0;
        const gustKt = weather.wgst || 0;

        if (ws.includes('ts')) return icons.ts;
        if (ws.includes('sn')) return icons.snow;
        if (ws.includes('ra') || ws.includes('dz')) return icons.rain;
        if (ws.includes('fg') || ws.includes('br')) return icons.fog;
        if (ws.includes('hz')) return icons.haze;
        
        // Add wind icon if wind is high
        if (Math.max(windKt, gustKt) > 15) return icons.wind;

        const cover = weather.clouds ? weather.clouds.map(c => c.cover.toUpperCase()) : [];

        // Priority logic: TS > Snow > Mixed > Rain > Freezing > Fog > Haze > Overcast > Broken > Scattered > Few > Clear
        if (cover.includes('OVC')) return icons.overcast;
        if (cover.includes('BKN')) return icons.broken;
        if (cover.includes('SCT')) return icons.scattered;
        if (cover.includes('FEW')) return icons.scattered; // Use scattered for "few"
        return icons.clear;
    },

    fetchWeather: async function() {
        try {
            const cacheBuster = Date.now();
            const stations = Object.keys(METAR_STATIONS).join(',');
            const targetUrl = `https://aviationweather.gov/api/data/metar?ids=${stations}&format=json&_=${cacheBuster}`;
            
            // Try codetabs first, then fall back to allorigins
            let response;
            try {
                response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);
                if (!response.ok) throw new Error();
            } catch (e) {
                response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
            }
            
            if (!response.ok) throw new Error('Weather API mismatch');
            
            const data = await response.json();
            
            // Map the array to our state object by station ID
            this.state.weatherData = {};
            data.forEach(m => {
                this.state.weatherData[m.icaoId] = m;
            });
            
            this.state.lastSync = new Date();
            this.updateUI();
            return true;
        } catch (error) {
            console.error('METAR Fetch Error:', error);
            return false;
        }
    },

    getWeather: function() {
        return this.state.weatherData[this.state.station];
    },

    getCalculatedStatus: function() {
        const weather = this.getWeather();
        if (!weather) return { state: 'caution', label: 'FETCHING...', reason: 'Updating live weather data...' };

        const windKt = weather.wspd || 0;
        const gustKt = weather.wgst || 0;
        const maxWind = Math.max(windKt, gustKt);
        
        if (maxWind > 20) return { state: 'closed', label: 'WINDS', reason: `High Winds (${maxWind} kt). Hazardous for flight.` };
        if (maxWind >= 15) return { state: 'caution', label: 'CAUTION', reason: `Gusty Winds (${maxWind} kt). Use extra care.` };
        return { state: 'open', label: 'OPEN', reason: 'Winds are calm. Perfect for flying!' };
    },

    getStatus: function() {
        return this.state.manualStatus || this.getCalculatedStatus();
    },

    setStation: function(stationID) {
        if (METAR_STATIONS[stationID]) {
            this.state.station = stationID;
            localStorage.setItem('metar_station', stationID);
            this.updateUI();
        }
    },

    setStatus: function(state, label, reason) {
        if (state === 'auto') {
            this.state.manualStatus = null;
            localStorage.removeItem('field_status_manual');
        } else {
            this.state.manualStatus = { state, label, reason };
            localStorage.setItem('field_status_manual', JSON.stringify(this.state.manualStatus));
        }
        this.updateUI();
    },

    updateUI: function() {
        const status = this.getStatus();
        const weather = this.getWeather();
        const station = METAR_STATIONS[this.state.station];

        // 1. Update Indicators
        document.querySelectorAll('.status-indicator').forEach(ind => {
            ind.className = 'status-indicator status-' + status.state;
        });
        document.querySelectorAll('.field-status').forEach(el => {
            el.innerHTML = `<span class="status-indicator status-${status.state}"></span> Field: ${status.label}`;
        });

        // 2. Update Weather Page Elements
        const stationLabel = document.getElementById('active-station-id');
        const stationName = document.getElementById('active-station-name');
        const stationDist = document.getElementById('active-station-dist');
        const radarFrame = document.querySelector('.radar-map iframe');

        if (stationLabel) stationLabel.innerText = this.state.station;
        if (stationName) stationName.innerText = station.name;
        if (stationDist) stationDist.innerText = station.dist;

        // Fix station name element ID mismatch
        const airportNameEl = document.getElementById('metar-airport-name');
        if (airportNameEl) airportNameEl.innerText = station.name;

        if (radarFrame) {
            // Midpoint calculation to satisfy the "frame both dots" requirement
            const midLat = (station.lat + CLUB_COORDS.lat) / 2;
            const midLon = (station.lon + CLUB_COORDS.lon) / 2;
            
            const baseUrl = 'https://embed.windy.com/embed2.html';
            const params = new URLSearchParams({
                lat: midLat,               // Center on calculated midpoint
                lon: midLon,
                width: 650,
                height: 450,
                zoom: station.zoom || 11,
                level: 'surface',
                overlay: 'radar',
                product: 'radar',
                menu: '',
                message: 'false',
                marker: 'false',           // Use our own CSS markers for reliability
                calendar: 'now',
                pressure: '',
                type: 'map',
                location: 'coordinates',
                detail: 'false',
                metricWind: 'default',
                metricTemp: 'default',
                radarRange: -1,
                _t: Date.now()
            });

            // Reconstruct iframe to ensure fresh reload
            const parent = radarFrame.parentElement;
            const newFrame = document.createElement('iframe');
            newFrame.width = "100%";
            newFrame.height = "100%";
            newFrame.src = `${baseUrl}?${params.toString()}`;
            newFrame.setAttribute('frameborder', '0');
            newFrame.id = 'radar-iframe';
            
            // Clear parent and add new frame
            parent.innerHTML = '';
            parent.appendChild(newFrame);
            const mapW = 650;
            const mapH = 500; // Parent container height
            const zoom = station.zoom || 11;
            
            // Helper to project lat/lon to pixel offsets from center (Standard Web Mercator approximation for this small area)
            const project = (lat, lon) => {
                const scale = Math.pow(2, zoom) * 256 / 360;
                // Mercator factor for Indiana latitude (approx 40.5 deg)
                const latFactor = 1 / Math.cos(40.5 * Math.PI / 180);
                return {
                    x: (lon - midLon) * scale,
                    y: (midLat - lat) * scale * latFactor
                };
            };

            const airportPx = project(station.lat, station.lon);
            const clubPx = project(CLUB_COORDS.lat, CLUB_COORDS.lon);

            const createMarker = (px, color, label) => {
                const dot = document.createElement('div');
                dot.style.position = 'absolute';
                dot.style.width = '14px';
                dot.style.height = '14px';
                dot.style.borderRadius = '50%';
                dot.style.backgroundColor = color;
                dot.style.border = '2px solid white';
                dot.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                dot.style.left = `calc(50% + ${px.x}px - 7px)`;
                dot.style.top = `calc(50% + ${px.y}px - 7px)`;
                dot.style.pointerEvents = 'none'; // Don't block map interaction
                dot.style.zIndex = '1000';
                
                if (label) {
                    const l = document.createElement('div');
                    l.innerText = label;
                    l.style.position = 'absolute';
                    l.style.top = '-20px';
                    l.style.left = '50%';
                    l.style.transform = 'translateX(-50%)';
                    l.style.fontSize = '10px';
                    l.style.fontWeight = 'bold';
                    l.style.backgroundColor = 'rgba(0,0,0,0.6)';
                    l.style.color = 'white';
                    l.style.padding = '2px 4px';
                    l.style.borderRadius = '3px';
                    l.style.whiteSpace = 'nowrap';
                    dot.appendChild(l);
                }
                return dot;
            };

            parent.appendChild(createMarker(airportPx, '#007bff', this.state.station)); // Blue dot for Airport
            parent.appendChild(createMarker(clubPx, '#ffffff', 'CLUB')); // White dot for Club
        }

        // Update Stats if available
        if (weather) {
            const windKt = weather.wspd || 0;
            const gustKt = weather.wgst ? Math.round(weather.wgst) : 0;
            const windDeg = weather.wdir;
            const windDir = this.getCompassDirection(windDeg);
            const maxWind = Math.max(windKt, gustKt);
            
            // Wind Tab Color
            const windTab = document.getElementById('tab-wind');
            if (windTab) {
                windTab.className = 'weather-card-tab ' + (maxWind > 20 ? 'tab-hazardous' : maxWind >= 15 ? 'tab-caution' : 'tab-good');
            }
            
            const windValEl = document.getElementById('metar-wind-value');
            const windDirEl = document.getElementById('metar-wind-dir');
            
            if (windValEl && windDirEl) {
                if (windKt === 0 && gustKt === 0) {
                    windValEl.innerText = 'Calm';
                    windDirEl.innerText = '--';
                    windValEl.style.color = '#28a745';
                } else {
                    windValEl.innerText = (gustKt > 0 ? `${windKt}-${gustKt}` : `${windKt}`) + ' kt';
                    windDirEl.innerText = windDeg === -1 ? 'VRB' : `${windDir} (${windDeg}°)`;
                    windValEl.style.color = maxWind > 20 ? '#dc3545' : maxWind >= 15 ? '#d39e00' : '#28a745';
                }
            }
            // Visibility Tab Color
            const visTab = document.getElementById('tab-vis');
            const visValue = parseFloat(weather.visib) || 0;
            if (visTab) {
                visTab.className = 'weather-card-tab ' + (visValue >= 5 ? 'tab-good' : visValue >= 1 ? 'tab-caution' : 'tab-hazardous');
            }

            const tempEl = document.getElementById('metar-temp');
            const tempTab = document.querySelector('#card-temp .weather-card-tab');
            if (tempEl) {
                const c = Math.round(weather.temp);
                const f = Math.round((c * 9/5) + 32);
                tempEl.innerText = `${c}°C (${f}°F)`;
                
                if (tempTab) {
                    tempTab.className = 'weather-card-tab ' + (f >= 50 ? 'tab-good' : f >= 32 ? 'tab-caution' : 'tab-hazardous');
                }
            }

            // Visibility
            const visEl = document.getElementById('metar-vis');
            if (visEl) visEl.innerText = `${weather.visib} SM`;

            const altEl = document.getElementById('metar-alt');
            const altTab = document.querySelector('#card-alt .weather-card-tab');
            if (altEl) {
                // Correct Altimeter conversion from hPa/mb to inHg
                const altInHg = weather.altim * 0.02953;
                altEl.innerText = `${altInHg.toFixed(2)} inHg`;
                if (altTab) altTab.className = 'weather-card-tab tab-altimeter';
            }

            const skyEl = document.getElementById('metar-sky');
            if (skyEl) {
                const wx = weather.wxString || '';
                const clouds = weather.clouds ? weather.clouds.map(c => 
                    `${c.cover} at ${c.base}'`
                ).join(', ') : '';
                
                skyEl.innerText = wx ? `${wx} ${clouds}`.trim() : clouds;
            }
            
            // Sunset logic
            const sunsetEl = document.getElementById('sunset-time');
            if (sunsetEl) {
                const sunset = this.calculateSunset(station.lat, station.lon);
                sunsetEl.innerText = sunset ? `Sunset: ${sunset}` : 'Sunset: --';
            }
            const skyIconEl = document.getElementById('metar-sky-icon');
            if (skyIconEl) {
                skyIconEl.innerHTML = this.getWeatherIcon(weather);
            }

            const obsTimeEl = document.getElementById('metar-obs-time');
            if (obsTimeEl) obsTimeEl.innerText = `Observed: ${new Date(weather.reportTime).toLocaleTimeString()}`;
        }

        const syncTimeEl = document.getElementById('metar-sync-time');
        if (syncTimeEl && this.state.lastSync) {
            syncTimeEl.innerText = `Data Refreshed: ${this.state.lastSync.toLocaleTimeString()}`;
            syncTimeEl.style.color = '#28a745';
            syncTimeEl.style.fontWeight = 'bold';
        }

        const safetyLabel = document.getElementById('weather-status-label');
        const safetyReason = document.getElementById('weather-status-reason');

        if (safetyLabel) {
            safetyLabel.innerText = (status.state === 'open' ? '✅ ' : status.state === 'caution' ? '⚠️ ' : '🛑 ') + status.label;
            safetyLabel.style.color = status.state === 'open' ? '#28a745' : status.state === 'caution' ? '#d39e00' : '#dc3545';
        }
        if (safetyReason) safetyReason.innerText = status.reason;

        const dropdown = document.getElementById('metar-selector');
        if (dropdown) dropdown.value = this.state.station;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    StatusManager.fetchWeather();
    StatusManager.updateUI();
});
