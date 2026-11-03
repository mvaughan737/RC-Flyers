# Converse Flying Eagles RC Club Website

Welcome to the official repository for the **Converse Flying Eagles RC Club** website. This project serves as a comprehensive digital home for our radio-controlled aviation community in Converse, Indiana.

## Purpose
The primary goal of this website is to foster fellowship among pilots and provide a central hub for club activities. It offers real-time information on flying conditions, serves as a gateway for new members, and provides a streamlined management interface for club administrators.

## Key Features
- **Dynamic Landing Page**: Featuring a prominent hero image that can be customized via the Admin panel.
- **News & Announcements**: A dedicated section for keeping members informed of the latest club updates.
- **Events Calendar**: A centralized schedule for meetings, fly-ins, and club competitions.
- **Integrated Weather System**:
    - **Live METAR Data**: Fetches real-time aviation weather from nearby stations (KOKK, KMZZ, KGUS).
    - **Automated Flying Status**: Automatically calculates if conditions are "OPEN" or "WINDS" based on current wind speeds.
    - **Live Radar**: Embedded radar display for tracking local storms and precipitation.
- **Admin Dashboard**: A secure, password-protected content management system (CMS).
- **Photo Gallery**: A visual showcase of club life and model aviation.
- **Pilot Resources**: Quick links to FAA regulations, AMA membership, and essential pilot tools.

## Technology Stack
- **Frontend**: Clean, semantic HTML5 and Vanilla CSS for a performance-focused, responsive experience.
- **Logic**: Vanilla JavaScript for all dynamic rendering and API integrations.
- **Data Management**: Robust usage of `localStorage` for persistent site content and settings, managed via a centralized `DataManager` class.
- **Weather API**: Integration with aviationweather.gov for live METAR data fetching.
- **Hosting**: Netlify serves the repository root, with selected Netlify Functions for live content.

## Project Structure
- **/admin**: Contains the secure dashboard (`dashboard.html`) and login interfaces for managing site content.
- **/js**: The core logic layer, including:
    - `data-manager.js`: Handles all CRUD operations and data persistence.
    - `status_final.js`: Manages weather fetching, parsing, and automated status logic.
- **/images**: Store for all visual assets, including the logo, gallery photos, and hero images.
- **style.css**: The main design system, utilizing modern CSS features like Grid and Flexbox for a premium look.

## Admin Capabilities
The custom-built Admin panel empowers club officers to manage the entire site without writing code:
- **Content Management**: Add, edit, or delete news posts and event entries.
- **Visual Control**: Change the homepage hero image directly from the gallery.
- **Site Configuration**: Update contact email, phone numbers, and meeting schedules.
- **Gallery Management**: Manage image filenames and status directly.

## Weather & Safety System
The heart of our flying site information is the Live Weather page. It cross-references METAR data from multiple local reporting stations to give pilots a clear picture of:
- **Temperature & Wind**: Current gusts and directions.
- **Visibility & Sky**: Cloud cover and flight rules (VFR/IFR).
- **Sunset Timing**: Essential for coordinating evening flights.

## Deployment
Netlify serves the repository root (`publish = "."` in `netlify.toml`). There is no build command or build script. Run `npm test` for the weather and local preview regression checks (Node and Python 3, no added packages required). Approved changes pushed to the connected Git branch trigger deployment. Local review does not require a commit or deployment.

## Membership page and document updates

The public page is `/membership.html`. Membership appears between About and Events in every public header menu, including mobile. Sections use ordinary semantic HTML so a future joining or renewal form can be added without changing the document downloads. No form, payment, account, or personal information collection is implemented.

PDF documents are served directly from the existing lowercase `/documents/` folder, included in Netlify's root publish directory. Paths must match the actual capitalization on case-sensitive hosting:

- `documents/Converse Flying Eagles Application (Nov 2026).pdf`
- `documents/Converse Flying Eagles Bylaws (Nov 2026).pdf`
- `documents/Field Rules (Nov 2026).pdf`

Membership links use these actual filenames with URL-encoded spaces and parentheses. Each opens a PDF in a new tab with `target="_blank" rel="noopener"` and no `download` attribute. The application is printed and completed by hand. The additional Website reference PDF is preserved locally and excluded from the release; it is not a fourth membership document.

The superseded Word copies were preserved unchanged in the sibling folder `../RC-Flyers-editable-originals/`, outside the published repository root. SHA-256 hashes were checked before removing the public copies. Original Word sources also remain in the external Club Updates folder. Keep editable originals outside this website.

To replace a PDF:

1. Export the approved editable source to PDF. Place the PDF in `documents/`, preserving the folder's actual lowercase spelling. Keep Word sources and private member records outside the public folder.
2. If its name or version changes, update its URL-encoded `href`, accessible description, and visible version in `membership.html`, plus the list above. Keep the View / Print labels, `target="_blank"`, `rel="noopener"`, and no `download` attribute.
3. Open each PDF through the local server. Confirm HTTP 200, `Content-Type: application/pdf`, and actual PDF content rather than an HTML fallback. Check that it opens in a new browser tab with print/save controls, and inspect every page for legibility.
4. Review desktop/mobile navigation, keyboard focus, and layout at 200% zoom before approving a later commit and deployment. Policy changes require separate club approval; this PDF update does not change dues or resolve policy questions.

Keep the preview server running while reviewing. Run `npm start` from the repository root, or run the preview script directly:

```powershell
python "C:/Users/Admin/.gemini/antigravity/scratch/RC-Flyers/scripts/preview.py"
```

Open `http://127.0.0.1:4173/membership.html` or `http://127.0.0.1:4173/weather_final.html`. The script always serves this repository, regardless of the terminal's current directory. Python 3 is required; there are no additional preview dependencies. Use `--port 4174` if 4173 is already in use. If the address reports connection refused, start the server before opening the page. Do not open the HTML as a file URL.

The preview handles the read-only `/.netlify/functions/metar-live` URL by retrieving the public deployed weather endpoint server-side. This requires internet access. It does not execute other Netlify Functions or publish content; other shared content uses static fallbacks. A plain static server cannot provide the weather endpoint and will return 404. The deployed site continues to use its existing Netlify weather function directly.

See [MEMBERSHIP-REVIEW.md](MEMBERSHIP-REVIEW.md) for source comparisons, unresolved policy questions, and verification limitations.

## Future Roadmap
- **Cloud Synchronization**: Moving from `localStorage` to a backend database (e.g., Firebase) for multi-admin support.
- **Rich Media**: Support for video uploads and enriched event descriptions.
- **Membership Management**: Online dues payment and member-only areas.
- **Multi-factor Auth**: Enhanced security for the administrative portal.

---
*Dedicated to the hobby of radio-controlled flight in Converse, Indiana and surrounding areas.*
