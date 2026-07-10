const http = require('http');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const PORT = process.env.PORT || 8080;
const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const ALLOWED_ORIGINS = new Set([
    'https://converse-flying-eagles.netlify.app',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:8080'
]);

const analyticsClient = new BetaAnalyticsDataClient();

function corsHeaders(origin) {
    const headers = {
        'Content-Type': 'application/json',
        'Vary': 'Origin'
    };

    if (ALLOWED_ORIGINS.has(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
        headers['Access-Control-Max-Age'] = '3600';
    }

    return headers;
}

function sendJson(res, statusCode, body, origin) {
    res.writeHead(statusCode, corsHeaders(origin));
    res.end(JSON.stringify(body));
}

function metricValue(row, index) {
    return Number(row?.metricValues?.[index]?.value || 0);
}

function dimensionValue(row, index) {
    return row?.dimensionValues?.[index]?.value || '';
}

function safeErrorResponse() {
    return {
        connected: false,
        error: 'Live analytics reporting is not connected. Open Google Analytics to view current stats.',
        updatedAt: new Date().toISOString()
    };
}

async function runReport(request) {
    const [report] = await analyticsClient.runReport({
        property: `properties/${PROPERTY_ID}`,
        ...request
    });
    return report;
}

function buildSummary(totalsReport, devicesReport, pagesReport) {
    const totals = totalsReport.rows?.[0] || {};

    return {
        connected: true,
        range: 'last30Days',
        updatedAt: new Date().toISOString(),
        summary: {
            activeUsers: Math.round(metricValue(totals, 0)),
            monthlyVisitors: Math.round(metricValue(totals, 0)),
            screenPageViews: Math.round(metricValue(totals, 1)),
            pageViews: Math.round(metricValue(totals, 1)),
            averageSessionDuration: metricValue(totals, 2),
            averageSessionSeconds: Math.round(metricValue(totals, 2))
        },
        devices: (devicesReport.rows || []).map(row => ({
            category: dimensionValue(row, 0),
            activeUsers: Math.round(metricValue(row, 0))
        })),
        pages: (pagesReport.rows || []).map(row => ({
            title: dimensionValue(row, 0),
            path: dimensionValue(row, 1),
            screenPageViews: Math.round(metricValue(row, 0)),
            views: Math.round(metricValue(row, 0))
        }))
    };
}

async function getAnalyticsSummary() {
    if (!PROPERTY_ID) {
        throw new Error('Missing GA4_PROPERTY_ID.');
    }

    const dateRanges = [{ startDate: '30daysAgo', endDate: 'today' }];

    const [totalsReport, devicesReport, pagesReport] = await Promise.all([
        runReport({
            dateRanges,
            metrics: [
                { name: 'activeUsers' },
                { name: 'screenPageViews' },
                { name: 'averageSessionDuration' }
            ]
        }),
        runReport({
            dateRanges,
            dimensions: [{ name: 'deviceCategory' }],
            metrics: [{ name: 'activeUsers' }],
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
        }),
        runReport({
            dateRanges,
            dimensions: [{ name: 'pageTitle' }, { name: 'pagePath' }],
            metrics: [{ name: 'screenPageViews' }],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit: 5
        })
    ]);

    return buildSummary(totalsReport, devicesReport, pagesReport);
}

const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || '';
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const isAllowedPath = url.pathname === '/' || url.pathname === '/analytics';

    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders(origin));
        res.end();
        return;
    }

    if (req.method !== 'GET' || !isAllowedPath) {
        sendJson(res, 404, { connected: false, error: 'Not found.' }, origin);
        return;
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
        sendJson(res, 403, { connected: false, error: 'Origin not allowed.' }, origin);
        return;
    }

    try {
        const summary = await getAnalyticsSummary();
        sendJson(res, 200, summary, origin);
    } catch (err) {
        console.error('GA4 analytics request failed:', {
            message: err.message,
            propertyConfigured: Boolean(PROPERTY_ID)
        });
        sendJson(res, 503, safeErrorResponse(), origin);
    }
});

server.listen(PORT, () => {
    console.log(`GA4 analytics service listening on port ${PORT}`);
});
