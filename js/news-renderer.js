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

    const isHtmlContent = (content = '') => /<\/?(?:p|br|strong|b|em|i|u|span|h[1-6]|ul|ol|li|a|img)(?:\s[^>]*)?>/i.test(String(content));

    const sanitizeUrl = (value = '', allowImages = false) => {
        const url = String(value).trim();
        if (!url) return '';
        if (url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url;
        if (allowImages && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(url)) return url;

        try {
            const parsed = new URL(url, window.location.href);
            const allowedProtocols = allowImages ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:'];
            return allowedProtocols.includes(parsed.protocol) ? url : '';
        } catch {
            return '';
        }
    };

    const sanitizeStyle = (value = '') => String(value).split(';').reduce((safe, declaration) => {
        const separator = declaration.indexOf(':');
        if (separator === -1) return safe;

        const property = declaration.slice(0, separator).trim().toLowerCase();
        const propertyValue = declaration.slice(separator + 1).trim();
        if (!propertyValue || /url\s*\(|expression\s*\(|javascript:/i.test(propertyValue)) return safe;

        if (property === 'text-align' && /^(?:left|center|right)$/.test(propertyValue)) {
            safe.push(`${property}: ${propertyValue}`);
        } else if (property === 'text-decoration' && /^underline$/.test(propertyValue)) {
            safe.push(`${property}: ${propertyValue}`);
        } else if ((property === 'color' || property === 'background-color') && /^[#(),.%\sa-z0-9-]+$/i.test(propertyValue)) {
            safe.push(`${property}: ${propertyValue}`);
        }
        return safe;
    }, []).join('; ');

    const sanitizeHtml = (content = '') => {
        if (typeof DOMParser === 'undefined') return escapeHtml(content);

        const documentNode = new DOMParser().parseFromString(String(content), 'text/html');
        const allowedTags = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'A', 'IMG']);
        const blockedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'SVG', 'MATH']);

        Array.from(documentNode.body.querySelectorAll('*')).forEach(element => {
            if (blockedTags.has(element.tagName)) {
                element.remove();
                return;
            }
            if (!allowedTags.has(element.tagName)) {
                element.replaceWith(...element.childNodes);
                return;
            }

            const originalAttributes = Array.from(element.attributes);
            originalAttributes.forEach(attribute => element.removeAttribute(attribute.name));

            const styleAttribute = originalAttributes.find(attribute => attribute.name.toLowerCase() === 'style');
            const safeStyle = styleAttribute ? sanitizeStyle(styleAttribute.value) : '';
            if (safeStyle) element.setAttribute('style', safeStyle);

            if (element.tagName === 'A') {
                const hrefAttribute = originalAttributes.find(attribute => attribute.name.toLowerCase() === 'href');
                const titleAttribute = originalAttributes.find(attribute => attribute.name.toLowerCase() === 'title');
                const targetAttribute = originalAttributes.find(attribute => attribute.name.toLowerCase() === 'target');
                const href = sanitizeUrl(hrefAttribute ? hrefAttribute.value : '');
                if (href) element.setAttribute('href', href);
                if (titleAttribute) element.setAttribute('title', titleAttribute.value);
                if (targetAttribute && targetAttribute.value === '_blank') {
                    element.setAttribute('target', '_blank');
                    element.setAttribute('rel', 'noopener noreferrer');
                }
            }

            if (element.tagName === 'IMG') {
                const attributeMap = Object.fromEntries(originalAttributes.map(attribute => [attribute.name.toLowerCase(), attribute.value]));
                const src = sanitizeUrl(attributeMap.src, true);
                if (!src) {
                    element.remove();
                    return;
                }
                element.setAttribute('src', src);
                if (attributeMap.alt) element.setAttribute('alt', attributeMap.alt);
                if (attributeMap.title) element.setAttribute('title', attributeMap.title);
                if (/^\d+$/.test(attributeMap.width || '')) element.setAttribute('width', attributeMap.width);
                if (/^\d+$/.test(attributeMap.height || '')) element.setAttribute('height', attributeMap.height);
            }
        });

        return documentNode.body.innerHTML;
    };

    const renderMarkdownContent = (content = '') => {
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

    const renderFormattedContent = (content = '') => isHtmlContent(content)
        ? sanitizeHtml(content)
        : renderMarkdownContent(content);

    const getPlainText = (content = '') => {
        let text = String(content);
        if (isHtmlContent(text) && typeof DOMParser !== 'undefined') {
            const documentNode = new DOMParser().parseFromString(sanitizeHtml(text), 'text/html');
            documentNode.body.querySelectorAll('br, p, h1, h2, h3, h4, h5, h6, li').forEach(element => element.append(' '));
            text = documentNode.body.textContent || '';
        }

        return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*\n]+)\*/g, '$1')
        .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

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
        isHtmlContent,
        sanitizeHtml,
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
