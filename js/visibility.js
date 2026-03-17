/**
 * Visibility Logic
 * Automatically hides articles/cards with [data-date] if the date is in the past.
 */
document.addEventListener('DOMContentLoaded', () => {
    // We use a fixed date for initial sessions often, 
    // but here we use the actual current date.
    const now = new Date();
    // Normalize to 00:00:00 for strict day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const items = document.querySelectorAll('[data-date][data-auto-hide="true"]');
    
    items.forEach(item => {
        const dateStr = item.getAttribute('data-date');
        if (!dateStr) return;

        // Parse YYYY-MM-DD
        const [year, month, day] = dateStr.split('-').map(Number);
        const itemDate = new Date(year, month - 1, day);

        // If the item date is strictly before today, hide it
        if (itemDate < today) {
            item.style.display = 'none';
            console.log(`Hidden past content: ${dateStr}`);
        }
    });

    // Handle empty container messages if needed
    // (Optional: can add logic here to show "No upcoming events" if all are hidden)
});
