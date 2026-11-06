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
The current live Netlify deploy still serves the previous static site. The prepared configuration builds an allowlisted `dist/` with `npm run build` and Node 22, keeping private membership assets inside a protected function. Run `npm test` for Weather and membership regressions (Node and Python 3; install `requirements-membership.txt`). Approved pushes to the connected `main` branch trigger production deployment, so do not push for pilot review. See [the Netlify pilot review plan](NETLIFY-MEMBERSHIP-PILOT.md) for a draft deployment on the existing project that preserves production.

## Membership page and document updates

The public page is `/membership.html`. Membership appears between About and Events in every public header menu, including mobile. Sections use ordinary semantic HTML so a future joining or renewal form can be added without changing the document downloads. A local-only online application/renewal prototype is available through the Python preview; see [MEMBERSHIP-PROTOTYPE.md](MEMBERSHIP-PROTOTYPE.md). Payment stays separate; an officer verifies AMA, then the applicant signs the printed application at the monthly meeting. Email sending is disabled.

George's restricted pilot is prepared in [NETLIFY-MEMBERSHIP-PILOT.md](NETLIFY-MEMBERSHIP-PILOT.md), with native Netlify Functions, private persistent Blobs, server password protection, George-only mail, deployment/rollback steps and a 15–20 minute test script. The earlier Render package is superseded. No remote deployment or email is enabled by these files. Run `node scripts/pilot-local.mjs` for a loopback-only rehearsal of the hosted implementation; it uses fictional fixtures and cannot send email.

PDF documents are served from the existing lowercase `/documents/` folder, copied unchanged into the prepared `dist/` publish directory. Paths must match the actual capitalization on case-sensitive hosting:

- `documents/Converse Flying Eagles Application (Nov 2026).pdf`
- `documents/Converse Flying Eagles Bylaws (Nov 2026).pdf`
- `documents/Field Rules (Nov 2026).pdf`
- `documents/Converse Flying Eagles Website (Nov 2026).pdf`

Membership links use these actual filenames with URL-encoded spaces and parentheses. All four open in a new tab with `target="_blank" rel="noopener"` and no `download` attribute. The blank application can still be printed and completed by hand; the local prototype also overlays answers onto an unchanged copy. The Website PDF is publicly linked as Membership Information and Dues.

The Board-confirmed decisions in [MEMBERSHIP-BOARD-UPDATE.md](MEMBERSHIP-BOARD-UPDATE.md) and owner-confirmed dues in MEMBERSHIP-PROTOTYPE.md supersede conflicting November PDF wording. Current official PDFs remain authorized for continued use while printed provisions await revision; all four downloads remain unchanged. Replacement PDFs are not a launch prerequisite. MEMBERSHIP-FINAL-REVIEW.md records the final before/after table and launch steps. MEMBERSHIP-REVIEW.md retains historical source passages.

Run `node scripts/production-local.mjs` for the loopback-only review at `http://127.0.0.1:4182/membership-production`. Use fictional review data. This rehearsal loads no environment files or mail credentials and cannot send. Its isolated private store is outside the website; the normal public build remains downloads-only. This does not enable production or change George's protected pilot.

The superseded Word copies were preserved unchanged in the sibling folder `../RC-Flyers-editable-originals/`, outside the published repository root. SHA-256 hashes were checked before removing the public copies. Original Word sources also remain in the external Club Updates folder. Keep editable originals outside this website.

To replace a PDF:

Public-contact exception: the Secretary email sentence was removed from the Membership Information and Dues PDF to prevent public exposure. Its exact original is archived outside the website under `../RC-Flyers-private/original-documents/`; the application, bylaws and field-rules PDFs remain unchanged. No membership policy provisions were altered by this correction.

1. Export the approved editable source to PDF. Place the PDF in `documents/`, preserving the folder's actual lowercase spelling. Keep Word sources and private member records outside the public folder.
2. If its name or version changes, update its URL-encoded `href`, accessible description, and visible version in `membership.html`, plus the list above. Keep the View / Print labels, `target="_blank"`, `rel="noopener"`, and no `download` attribute.
3. Open each PDF through the local server. Confirm HTTP 200, `Content-Type: application/pdf`, and actual PDF content rather than an HTML fallback. Check that it opens in a new browser tab with print/save controls, and inspect every page for legibility.
4. Review desktop/mobile navigation, keyboard focus, and layout at 200% zoom. Compare public summaries with the complete approved documents and search related pages and shared content for obsolete wording. Record substantive additions, removals, and remaining internal contradictions in MEMBERSHIP-REVIEW.md before local review. Commit and deployment require the owner's authorization for that update.

Keep the preview server running while reviewing. Run `npm start` from the repository root, or run the preview script directly:

```powershell
python "C:/Users/Admin/.gemini/antigravity/scratch/RC-Flyers/scripts/preview.py"
```

Open `http://127.0.0.1:4173/membership.html` or `http://127.0.0.1:4173/weather_final.html`. The script always serves this repository, regardless of the terminal's current directory. Python 3 is required. Membership PDF generation also needs `python -m pip install -r requirements-membership.txt`. Use port 4174 for the current membership prototype. Use `--port 4174` if 4173 is already in use. If the address reports connection refused, start the server before opening the page. Do not open the HTML as a file URL.

The preview handles the read-only `/.netlify/functions/metar-live` URL by retrieving the public deployed weather endpoint server-side. This requires internet access. The local membership endpoints save only to a private sibling folder and never send email. The preview does not execute other Netlify Functions or publish content; other shared content uses static fallbacks. A plain static server cannot provide the weather endpoint and will return 404. The deployed site continues to use its existing Netlify weather function directly.

See [MEMBERSHIP-REVIEW.md](MEMBERSHIP-REVIEW.md) for source comparisons, unresolved policy questions, and verification limitations.

## Future Roadmap
- **Cloud Synchronization**: Moving from `localStorage` to a backend database (e.g., Firebase) for multi-admin support.
- **Rich Media**: Support for video uploads and enriched event descriptions.
- **Membership Management**: Online dues payment and member-only areas.
- **Multi-factor Auth**: Enhanced security for the administrative portal.

---
*Dedicated to the hobby of radio-controlled flight in Converse, Indiana and surrounding areas.*

Production launch preparation (disabled, local only): see [MEMBERSHIP-PRODUCTION-REVIEW.md](MEMBERSHIP-PRODUCTION-REVIEW.md) for routing, comments, mocked checks, pending Board decisions, final-launch steps and rollback. Production settings are documented in `.env.production.example`; the protected pilot configuration is separate.
