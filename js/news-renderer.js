/**
 * Safe display helpers for Admin-managed News content.
 */
const NewsRenderer = (() => {
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

    return {
        escapeHtml,
        renderFormattedContent,
        renderPreview,
        isLongContent,
        newsId
    };
})();
