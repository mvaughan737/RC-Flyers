/**
 * Safe display helpers for Admin-managed News content.
 */
const NewsRenderer = (() => {
    const DEFAULT_ANNOUNCEMENT_TYPE = 'club-announcement';

    const announcementTypes = [
        { key: 'club-announcement', emoji: '📢', label: 'Club Announcement', background: '#e7f3ff', color: '#004085', border: '#87CEEB' },
        { key: 'special-announcement', emoji: '⭐', label: 'Special Announcement', background: '#f8d7da', color: '#721c24', border: '#dc3545' },
        { key: 'upcoming-event', emoji: '📅', label: 'Upcoming Event', background: '#d4edda', color: '#155724', border: '#28a745' },
        { key: 'flying-event', emoji: '✈️', label: 'Flying Event', background: '#e1f5fe', color: '#04536c', border: '#87CEEB' },
        { key: 'competition', emoji: '🏆', label: 'Competition', background: '#fff0dc', color: '#8a4b00', border: '#f39c12' },
        { key: 'club-update', emoji: '🎉', label: 'Club Update', background: '#e8eaf6', color: '#000080', border: '#000080' },
        { key: 'safety-notice', emoji: '⚠️', label: 'Safety Notice', background: '#ead0d0', color: '#5b0000', border: '#8b0000' },
        { key: 'weather-advisory', emoji: '🌦️', label: 'Weather Advisory', background: '#d6f4f1', color: '#005c57', border: '#008b8b' },
        { key: 'field-update', emoji: '🔧', label: 'Field Update', background: '#eadfd4', color: '#5b3418', border: '#8b5a2b' },
        { key: 'member-news', emoji: '👥', label: 'Member News', background: '#f1e4ff', color: '#4b1f78', border: '#7d3c98' },
        { key: 'training-news', emoji: '📚', label: 'Training News', background: '#e4e7ff', color: '#28306f', border: '#4b5bdc' },
        { key: 'board-news', emoji: '💼', label: 'Board News', background: '#eceff1', color: '#37474f', border: '#607d8b' },
        { key: 'newsletter', emoji: '📰', label: 'Newsletter', background: '#fff8d6', color: '#6b5600', border: '#FFD700' },
        { key: 'community-news', emoji: '❤️', label: 'Community News', background: '#ffe4ec', color: '#7d2442', border: '#d94b73' },
        { key: 'history-highlight', emoji: '📜', label: 'History Highlight', background: '#f4e6bd', color: '#6b4f00', border: '#b8860b' }
    ];

    const escapeHtml = (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderInline = (value = '') => escapeHtml(value)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

    const renderFormattedContent = (content = '') => {
        const lines = String(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        const blocks = [];
        let paragraph = [];
        let bullets = [];

        const flushParagraph = () => {
            if (!paragraph.length) return;
            blocks.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
            paragraph = [];
        };

        const flushBullets = () => {
            if (!bullets.length) return;
            blocks.push(`<ul>${bullets.map(item => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
            bullets = [];
        };

        lines.forEach(line => {
            const bullet = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/);
            if (!line.trim()) {
                flushParagraph();
                flushBullets();
                return;
            }
            if (bullet) {
                flushParagraph();
                bullets.push(bullet[1]);
                return;
            }
            flushBullets();
            paragraph.push(line);
        });

        flushParagraph();
        flushBullets();

        return blocks.join('');
    };

    const getPlainText = (content = '') => String(content)
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*\n]+)\*/g, '$1')
        .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
        .replace(/\s+/g, ' ')
        .trim();

    const isLongContent = (content = '') => {
        const text = getPlainText(content);
        const nonEmptyLines = String(content).split(/\r\n|\r|\n/).filter(line => line.trim()).length;
        return text.length > 180 || nonEmptyLines > 4;
    };

    const renderPreview = (content = '', maxChars = 180) => {
        const text = getPlainText(content);
        if (text.length <= maxChars) return escapeHtml(text);

        const trimmed = text.slice(0, maxChars + 1);
        const boundary = trimmed.lastIndexOf(' ');
        const preview = trimmed.slice(0, boundary > 120 ? boundary : maxChars).trim();
        return `${escapeHtml(preview)}...`;
    };

    const newsId = (item = {}) => `news-${item.id || String(item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

    const getAnnouncementType = (item = {}) => {
        const value = String(item.announcementType || item.type || DEFAULT_ANNOUNCEMENT_TYPE).trim();
        const normalized = value.toLowerCase();
        return announcementTypes.find(type =>
            type.key === normalized ||
            type.label.toLowerCase() === normalized ||
            `${type.emoji} ${type.label}`.toLowerCase() === normalized
        ) || announcementTypes[0];
    };

    const renderAnnouncementBadge = (item = {}) => {
        const type = getAnnouncementType(item);
        const style = [
            `background:${type.background}`,
            `color:${type.color}`,
            `border:1px solid ${type.border}`
        ].join(';');
        return `<span class="news-tag announcement-badge" style="${style}">${type.emoji} ${escapeHtml(type.label.toUpperCase())}</span>`;
    };

    const renderAnnouncementOptions = (selectedValue = DEFAULT_ANNOUNCEMENT_TYPE) => {
        const selectedType = getAnnouncementType({ announcementType: selectedValue });
        return announcementTypes.map(type => `
            <option value="${type.key}" ${type.key === selectedType.key ? 'selected' : ''}>${type.emoji} ${escapeHtml(type.label)}</option>
        `).join('');
    };

    return {
        escapeHtml,
        renderFormattedContent,
        renderPreview,
        isLongContent,
        newsId,
        announcementTypes,
        getAnnouncementType,
        renderAnnouncementBadge,
        renderAnnouncementOptions
    };
})();
