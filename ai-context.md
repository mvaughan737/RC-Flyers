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

No backend/server is currently used.

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
