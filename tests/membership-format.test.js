const assert = require('node:assert/strict');
const {test} = require('node:test');
const f = require('../js/membership-format');

test('meeting labels use date-specific Eastern abbreviations across DST and year boundaries', () => {
    for (const [day, expected] of [['2026-12-01','Dec 1, 2026 at 6:00 PM EST'],['2027-01-05','Jan 5, 2027 at 6:00 PM EST'],['2027-07-06','Jul 6, 2027 at 6:00 PM EDT'],['2027-03-02','Mar 2, 2027 at 6:00 PM EST'],['2027-04-06','Apr 6, 2027 at 6:00 PM EDT'],['2027-11-02','Nov 2, 2027 at 6:00 PM EDT'],['2027-12-07','Dec 7, 2027 at 6:00 PM EST']]) {
        assert.equal(f.meeting(day),expected);
        assert.equal(f.display('meetingDate',day),expected);
    }
});

test('display capitalization keeps internal values; dates never shift with timezone', () => {
    for (const [key, value, expected] of [['kind','new','New'], ['kind','renewal','Renewal'], ['category','regular','Regular'], ['category','spouse','Spouse'], ['category','junior','Junior']]) {
        assert.equal(f.display(key,value),expected);
    }
    const previous = process.env.TZ;
    try {
        for (const zone of ['America/Indianapolis','Pacific/Honolulu','Pacific/Kiritimati']) {
            process.env.TZ = zone;
            for (const [iso, expected] of [['2026-11-14','Nov 14, 2026'], ['2026-01-01','Jan 1, 2026'], ['2028-02-29','Feb 29, 2028'], ['2026-12-31','Dec 31, 2026']]) {
                assert.equal(f.date(iso), expected);
            }
        }
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
    assert.equal(f.date(''), '');
    assert.throws(() => f.date('2026-02-29'));
});

test('phones accept common separators, preserve leading zeroes, reject extra digits and letters', () => {
    for (const value of ['3334535923', '333 453 5923', '(333) 453-5923', '333.453.5923', '333/453/5923', '333\u00a0453\u00a05923', '333–453—5923']) {
        assert.equal(f.phone(value), '(333) 453-5923');
    }
    assert.equal(f.phone('012 034 0056'), '(012) 034-0056');
    assert.equal(f.phone('  '), '');
    for (const invalid of ['333453592', '13334535923', '33345359233', '333CALL5923', '3334535923 ext 9']) {
        assert.throws(() => f.phone(invalid), /exactly 10 digits/);
    }
});

test('blur formatting and Review/Edit retain answers using the actual pilot service', async () => {
    const {browserHarness}=await import('./membership-browser-harness.mjs');
    const {sample}=await import('./pilot-fixtures.mjs');
    const b=await browserHarness();await b.advance(3000);
    await b.fill({...sample,phone:'012.034.0056',dob:'2000-01-01',kind:'renewal'});
    b.page.form.elements.phone.listeners.blur();assert.equal(b.page.form.elements.phone.value,'(012) 034-0056');
    await b.review();
    const summary=Object.fromEntries(b.page.ids['application-summary'].children.map(row=>row.children.map(el=>el.textContent)));
    assert.equal(summary.Application,'Renewal');assert.equal(summary.Category,'Regular');
    assert.equal(summary['Expected Payment Receipt'],'Nov 14, 2026');assert.equal(summary['Date of Birth'],'Jan 1, 2000');
    assert.equal(summary['Selected meeting'],'Dec 1, 2026 at 6:00 PM EST');
    assert.ok(b.page.form.elements.meetingDate.options.some(option=>option.textContent==='Jul 6, 2027 at 6:00 PM EDT'));
    await b.click('application-edit');assert.equal(b.page.form.elements.name.value,sample.name);
    assert.equal(b.page.form.elements.paymentDate.value,'2026-11-14');assert.equal(b.page.form.elements.acknowledge.checked,true);
});
