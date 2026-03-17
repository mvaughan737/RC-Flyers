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
- **Hosting**: Optimized for deployment on GitHub Pages.

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
This project is designed for static hosting. Simply push to the `main` branch or a `gh-pages` branch on GitHub to deploy immediately.

## Future Roadmap
- **Cloud Synchronization**: Moving from `localStorage` to a backend database (e.g., Firebase) for multi-admin support.
- **Rich Media**: Support for video uploads and enriched event descriptions.
- **Membership Management**: Online dues payment and member-only areas.
- **Multi-factor Auth**: Enhanced security for the administrative portal.

---
*Dedicated to the hobby of radio-controlled flight in Converse, Indiana and surrounding areas.*
