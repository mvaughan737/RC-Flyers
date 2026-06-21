# Converse Flying Eagles RC Club Website – Project Context

## Overview
This project is the official website for the Converse Flying Eagles RC Club.

It is a static website built with HTML, CSS, and JavaScript, hosted on Netlify, and managed through a GitHub repository.

All development changes are made locally, tested, then committed via GitHub Desktop and deployed automatically through Netlify.

---

## Hosting & Deployment

- Hosting: Netlify
- Source Control: GitHub
- Deployment: Automatic via Git push (CI/CD)
- Local testing is required before every commit

Live URL:
https://converse-flying-eagles.netlify.app

---

## Core Technologies

- HTML
- CSS
- JavaScript
- EmailJS (for contact form)

No traditional backend server is currently used; the site remains static with targeted Netlify Functions where needed.

Weather METAR data is fetched through the site's Netlify Function at `/.netlify/functions/metar-live`, which retrieves JSON server-side from AviationWeather for KOKK, KMZZ, and KGUS. Third-party browser CORS proxies are not used for active METAR fetching. The Windy radar remains an embedded client-side iframe on the Weather page.

---

## Folder Structure Rules

The following folders must always exist and should not be removed:
/images/
/images/gallery/
/admin/


### Usage

- `/images/`
  - General site images
  - Background / hero images

- `/images/gallery/`
  - Contains event-based photo folders
  - Each event has its own subfolder

Example:
/images/gallery/converse-fun-fly-2026/


- `/admin/`
  - Admin panel files (Decap CMS or custom admin)

---

## Gallery System Requirements

The gallery is organized by event.

Each event includes:
- A human-readable title (e.g., "Converse Fun Fly 2026")
- A slug (e.g., "converse-fun-fly-2026")
- A collection of images

### Behavior

- Gallery menu should display all events
- Users can select an event from a dropdown
- Each event opens a gallery page
- Gallery supports:
  - Image grid
  - Slideshow mode

### Image Optimization

- Thumbnails should be used for grid display
- Full-size images should load only when clicked or in slideshow

---

## Background Image System

- Background images are stored in `/images/`
- Admin can:
  - Upload images
  - Select active background
- Public site displays the active background image

---

## Admin System Goals

The admin interface should allow:

1. Uploading background images
2. Creating gallery events
3. Uploading multiple images per event
4. Managing content without editing code

Admin should be:
- Simple
- Clean
- Usable by non-technical users

---

## News and Events Data Ownership

News and Events are managed through the custom Admin Dashboard with the same source order:

1. Netlify Blobs live data, read through the matching Netlify Function
2. Static JSON fallback in `/admin/content/`
3. Built-in/browser local fallback only if both shared sources are unavailable

News uses:
- Live endpoint: `/.netlify/functions/news-live`
- Static fallback: `/admin/content/news.json`

Events uses:
- Live endpoint: `/.netlify/functions/events-live`
- Static fallback: `/admin/content/events.json`

Gallery metadata uses:
- Live endpoint: `/.netlify/functions/gallery-live`
- Static fallback: `/admin/content/gallery-data.json`
- Netlify Blobs stores gallery metadata only, such as event titles, slugs, cover image URLs, image URL references, captions, and published state.
- Gallery media binaries are not stored in Netlify Blobs in this phase.
- Existing local media URLs such as `/images/gallery/file.jpg` remain supported.
- Cloudinary-based image uploads are available in the custom Admin Dashboard Gallery Manager using a Cloudinary cloud name and unsigned image upload preset stored in the browser's local Admin settings.
- Cloudinary uploads save returned secure URLs into gallery metadata. Public gallery rendering supports both Cloudinary image URLs and existing local image URLs.
- Bulk upload beyond Cloudinary multi-file image selection and video/MP4 support are planned for later gallery media phases.
- The custom Admin Dashboard Gallery Manager is the preferred gallery metadata editor.
- Decap Gallery editing remains available as a legacy/static fallback workflow for now and should not be removed until a later approved phase.

Admin startup for News, Events, and Gallery metadata should load shared content in the same Blob-first, static JSON fallback, defaults/local fallback order before editing begins. Admin edits may save locally first so the editor can keep working, but publishing live content requires the Admin Dashboard publish/save-data action and the configured Netlify admin token. Public pages should not fall directly from a failed live News request to old sample/default News while the static JSON fallback is available.

News formatting entered in Admin should be preserved on the public News page. Public rendering should safely escape Admin text, then preserve paragraph breaks, line breaks, bullets, and simple Markdown-style emphasis.

Homepage News cards should show short previews, not full long articles. Longer News items should be visually limited to about four lines and include a `Read more...` link to the full News page or item anchor.

CMSLoader should remain focused on image/media JSON such as backgrounds and gallery data unless a future architecture change explicitly moves text content back to Decap-managed files.

---

## Workflow

1. Make changes using Antigravity (AG)
2. Test locally
3. Review changes
4. Commit using GitHub Desktop
5. Push to GitHub
6. Netlify auto-deploys

---

## Code Rules

- Do not break existing pages
- Do not break EmailJS functionality
- Keep navigation intact
- Preserve current design unless instructed otherwise
- Keep code clean and modular
- Avoid unnecessary frameworks

---

## Naming Conventions

- Use lowercase with hyphens for slugs:
  - converse-fun-fly-2026
- Keep filenames descriptive
- Avoid spaces in file names

---

## Key Constraints

- Must remain compatible with Netlify static hosting
- Must not require a backend unless explicitly added
- Must not break deployment pipeline

---

## Future Goals

- Admin panel for uploads and gallery management
- Automated gallery event creation
- Slideshow functionality
- Improved user experience for members

---

## Notes for AG (Antigravity)

- Always reference this file before making changes
- Preserve folder structure
- Make incremental changes
- Explain all file modifications clearly
- Do not assume missing features—build them step-by-step
