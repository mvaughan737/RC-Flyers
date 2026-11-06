/* Date-only formatting deliberately avoids Date parsing and timezone conversion. */
(function (root) {
    'use strict';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function date(value) {
        if (!value) return '';
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) throw new Error('Use a valid date.');
        const [, year, month, day] = match.map(Number);
        const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (!days[month - 1] || day < 1 || day > days[month - 1]) throw new Error('Use a valid date.');
        return `${months[month - 1]} ${day}, ${year}`;
    }
    function phone(value, label = 'Phone') {
        if (!value.trim()) return '';
        const digits = value.replace(/[^0-9]/g, '');
        if (!/^[0-9\s\p{P}+]+$/u.test(value) || digits.length !== 10) {
            throw new Error(`${label}: enter exactly 10 digits; spaces and punctuation are allowed.`);
        }
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    function meeting(value) {
        if (!value) return '';
        const label = date(value);
        const [year, month, day] = value.split('-').map(Number);
        // At 23:00 UTC this is the meeting's local evening, after any DST transition.
        const zone = new Intl.DateTimeFormat('en-US', {timeZone:'America/Indiana/Indianapolis', timeZoneName:'short'})
            .formatToParts(new Date(Date.UTC(year, month - 1, day, 23))).find(part => part.type === 'timeZoneName').value;
        return `${label} at 6:00 PM ${zone}`;
    }
    function display(key, value) {
        if (!value) return '';
        if (key === 'kind' || key === 'category') return value[0].toUpperCase() + value.slice(1);
        if (key === 'meetingDate') return meeting(value);
        if (['paymentDate', 'dob', 'expiry'].includes(key)) return date(value);
        if (key === 'phone' || key === 'cell') return phone(value, key === 'cell' ? 'Cell' : 'Phone');
        return value;
    }
    const api = {date, phone, meeting, display};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.MembershipFormatting = api;
})(globalThis);
