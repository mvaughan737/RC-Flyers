/**
 * analytics-live.js - Netlify Function
 *
 * GET /.netlify/functions/analytics-live -> read-only GA4 reporting summary
 *
 * Environment variables:
 *   GA4_CLIENT_EMAIL - Google service account email
 *   GA4_PRIVATE_KEY  - Google service account private key
 *   GA4_PROPERTY_ID  - Numeric GA4 property ID
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

function base64Url(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function getPrivateKey() {
    return (process.env.GA4_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

async function createServiceAccountJwt() {
    const crypto = require('crypto');
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
        iss: process.env.GA4_CLIENT_EMAIL,
        scope: SCOPE,
        aud: TOKEN_URL,
        exp: now + 3600,
        iat: now
    };

    const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(getPrivateKey(), 'base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${unsigned}.${signature}`;
}

async function getAccessToken() {
    const assertion = await createServiceAccountJwt();
    const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
    });

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });

    if (!res.ok) {
        throw new Error(`Google OAuth error: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.access_token) throw new Error('Google OAuth did not return an access token.');
    return data.access_token;
}

async function runReport(accessToken, requestBody) {
    const propertyId = process.env.GA4_PROPERTY_ID;
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
        throw new Error(`GA4 Data API error: HTTP ${res.status}`);
    }

    return await res.json();
}

function metricValue(row, index) {
    return Number(row?.metricValues?.[index]?.value || 0);
}

function dimensionValue(row, index) {
    return row?.dimensionValues?.[index]?.value || '';
}

function buildSummary(totalsReport, devicesReport, pagesReport) {
    const totals = totalsReport.rows?.[0] || {};
    const averageSessionDuration = metricValue(totals, 2);

    return {
        connected: true,
        range: 'last30Days',
        summary: {
            monthlyVisitors: Math.round(metricValue(totals, 0)),
            pageViews: Math.round(metricValue(totals, 1)),
            averageSessionSeconds: Math.round(averageSessionDuration)
        },
        devices: (devicesReport.rows || []).map(row => ({
            category: dimensionValue(row, 0),
            activeUsers: Math.round(metricValue(row, 0))
        })),
        pages: (pagesReport.rows || []).map(row => ({
            title: dimensionValue(row, 0),
            path: dimensionValue(row, 1),
            views: Math.round(metricValue(row, 0))
        }))
    };
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed.' }) };
    }

    if (!process.env.GA4_CLIENT_EMAIL || !process.env.GA4_PRIVATE_KEY || !process.env.GA4_PROPERTY_ID) {
        return {
            statusCode: 503,
            headers: corsHeaders,
            body: JSON.stringify({ connected: false, error: 'Live analytics reporting is not connected.' })
        };
    }

    try {
        const accessToken = await getAccessToken();
        const dateRanges = [{ startDate: '30daysAgo', endDate: 'today' }];

        const [totalsReport, devicesReport, pagesReport] = await Promise.all([
            runReport(accessToken, {
                dateRanges,
                metrics: [
                    { name: 'activeUsers' },
                    { name: 'screenPageViews' },
                    { name: 'averageSessionDuration' }
                ]
            }),
            runReport(accessToken, {
                dateRanges,
                dimensions: [{ name: 'deviceCategory' }],
                metrics: [{ name: 'activeUsers' }],
                orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
            }),
            runReport(accessToken, {
                dateRanges,
                dimensions: [{ name: 'pageTitle' }, { name: 'pagePath' }],
                metrics: [{ name: 'screenPageViews' }],
                orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
                limit: 5
            })
        ]);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(buildSummary(totalsReport, devicesReport, pagesReport))
        };
    } catch (err) {
        return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({ connected: false, error: err.message })
        };
    }
};
