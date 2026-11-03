const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/status_final.js'), 'utf8');
const report = (icaoId = 'KOKK') => ({
    icaoId, temp: 14.4, wspd: 14, wdir: 160, visib: '10+', altim: 1020.4,
    clouds: [{ cover: 'OVC', base: 700 }], reportTime: '2026-11-03T00:00:00Z'
});

function manager(fetch, storedStation = null) {
    const status = vm.runInNewContext(source + '\nStatusManager;', {
        localStorage: { getItem: key => key === 'metar_station' ? storedStation : null },
        document: { addEventListener() {} },
        console: { error() {} }, fetch
    });
    status.updateUI = () => {};
    return status;
}

test('10+ visibility keeps complete primary station; incomplete primary falls back', async () => {
    let reports = [report(), report('KMZZ')];
    const status = manager(async () => ({ ok: true, json: async () => reports }));
    assert.equal(await status.fetchWeather(), true);
    assert.equal(status.state.station, 'KOKK');
    reports = [{ ...report(), temp: null }, report('KMZZ')];
    assert.equal(await status.fetchWeather(), true);
    assert.equal(status.state.station, 'KMZZ');
});

test('failed request leaves loading, suppresses stale OPEN status, and recovers', async () => {
    let available = false;
    const status = manager(async () => available
        ? { ok: true, json: async () => [report()] }
        : { ok: false, json: async () => { throw new Error('HTML 404 response'); } });
    assert.equal(status.getCalculatedStatus().label, 'FETCHING...');
    assert.equal(await status.fetchWeather(), false);
    assert.equal(status.getCalculatedStatus().label, 'UNAVAILABLE');
    available = true;
    assert.equal(await status.fetchWeather(), true);
    assert.equal(status.getCalculatedStatus().label, 'OPEN');
    available = false;
    await status.fetchWeather();
    assert.equal(status.getCalculatedStatus().label, 'UNAVAILABLE');
});

test('empty reports and incomplete manual station never show OPEN', async () => {
    const empty = manager(async () => ({ ok: true, json: async () => [] }));
    assert.equal(await empty.fetchWeather(), false);
    assert.equal(empty.getCalculatedStatus().label, 'UNAVAILABLE');
    const manual = manager(async () => ({ ok: true, json: async () => [
        { ...report(), wspd: null }, report('KMZZ')
    ] }), 'KOKK');
    await manual.fetchWeather();
    assert.equal(manual.state.station, 'KOKK');
    assert.equal(manual.getCalculatedStatus().label, 'UNAVAILABLE');
});
