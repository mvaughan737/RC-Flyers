/**
 * metar-live.js - Netlify Function
 *
 * GET /.netlify/functions/metar-live -> public read of live METAR data
 *
 * Fetches AviationWeather METAR data server-side so the browser does not rely
 * on third-party CORS proxies.
 */

const METAR_URL = 'https://aviationweather.gov/api/data/metar?ids=KOKK,KMZZ,KGUS&format=json';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed. Use GET for METAR data.' })
        };
    }

    try {
        const response = await fetch(METAR_URL, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({
                    error: 'Unable to retrieve METAR data from AviationWeather.',
                    upstreamStatus: response.status
                })
            };
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({
                    error: 'Unexpected METAR response format from AviationWeather.'
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({
                error: 'Weather data is temporarily unavailable. Please try again later.',
                detail: error.message
            })
        };
    }
};
