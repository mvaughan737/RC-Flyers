/**
 * Navigation Logic
 * Handles the responsive hamburger menu toggle.
 */
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger-btn');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navLinks.classList.contains('open');
            if (isOpen) {
                navLinks.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
            } else {
                navLinks.classList.add('open');
                hamburger.setAttribute('aria-expanded', 'true');
            }
        });

        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (navLinks.classList.contains('open') && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
                navLinks.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
            }
        });
    }
});
