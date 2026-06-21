/**
 * gallery-live.js - Netlify Function
 *
 * GET  /.netlify/functions/gallery-live  -> public read of live gallery metadata from Netlify Blobs
 * POST /.netlify/functions/gallery-live  -> admin write to Netlify Blobs (requires EVENTS_ADMIN_TOKEN)
 *
 * This stores metadata only. Gallery media binaries are not stored in Netlify Blobs.
 *
 * Environment variables (set in Netlify Dashboard -> Site Settings -> Environment Variables):
 *   NETLIFY_API_TOKEN  - Netlify Personal Access Token (PAT) for Blobs API access
 *   EVENTS_ADMIN_TOKEN - Shared secret that protects the POST endpoint
 *   SITE_ID            - Auto-provided by Netlify at runtime
 */

const STORE = 'rc-flyers';
const KEY   = 'galleries';

function blobUrl() {
    const siteId = process.env.SITE_ID;
    return `https://api.netlify.com/api/v1/blobs/${siteId}/${STORE}/${KEY}`;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    if (event.httpMethod === 'GET') {
        const netlifyToken = process.env.NETLIFY_API_TOKEN;
        if (!netlifyToken) {
            return {
                statusCode: 503,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Server not configured (missing NETLIFY_API_TOKEN).' })
            };
        }

        try {
            const res = await fetch(blobUrl(), {
                headers: { 'Authorization': `Bearer ${netlifyToken}` }
            });

            if (res.status === 404) {
                return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'No live gallery data yet.' }) };
            }

            if (!res.ok) {
                return {
                    statusCode: 502,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: `Blobs API error: HTTP ${res.status}` })
                };
            }

            const data = await res.json();
            return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };

        } catch (err) {
            return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
        }
    }

    if (event.httpMethod === 'POST') {
        const adminToken   = process.env.EVENTS_ADMIN_TOKEN;
        const netlifyToken = process.env.NETLIFY_API_TOKEN;

        if (!adminToken || !netlifyToken) {
            return {
                statusCode: 503,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Server not configured (missing environment variables).' })
            };
        }

        const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
        const sentToken  = authHeader.replace(/^Bearer\s+/i, '').trim();

        if (!sentToken || sentToken !== adminToken) {
            return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized.' }) };
        }

        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch {
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
        }

        if (!body.galleries || !Array.isArray(body.galleries)) {
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Payload must contain a galleries array.' }) };
        }

        try {
            const res = await fetch(blobUrl(), {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${netlifyToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ galleries: body.galleries }, null, 2)
            });

            if (!res.ok) {
                let errMsg = `Blobs API error: HTTP ${res.status}`;
                try { const e = await res.json(); errMsg = e.message || errMsg; } catch { /* noop */ }
                return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: errMsg }) };
            }

            return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };

        } catch (err) {
            return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
        }
    }

    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed.' }) };
};
