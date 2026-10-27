const test = require('node:test');
const assert = require('node:assert/strict');
const { openSession, refreshSession, summarizeSessions } = require('../src/sessions');
const { printSummary } = require('../src/cli');

function fakeDriver(failAt) {
    let opened = false;
    let autoplayBlocked = false;
    const input = {
        isDisplayed: async () => true,
        isEnabled: async () => true,
        clear: async () => {},
        sendKeys: async () => { if (failAt === 'submit') throw new Error('Submission failed'); },
    };
    return {
        switchTo: () => ({
            newWindow: async () => { await Promise.resolve(); opened = true; },
            window: async () => { if (failAt === 'closed') throw new Error('Tab closed'); },
        }),
        getWindowHandle: async () => { assert.equal(opened, true); return 'new-tab'; },
        getBidi: async () => ({
            send: async ({ method, params }) => {
                assert.equal(method, 'script.addPreloadScript');
                assert.deepEqual(params.contexts, ['new-tab']);
                if (failAt === 'guard') throw new Error('Could not block autoplay');
                autoplayBlocked = true;
                return { result: { script: 'guard-script' } };
            },
            close: async () => {},
        }),
        get: async () => {
            assert.equal(autoplayBlocked, true, 'Autoplay guard must be installed before navigation');
            if (failAt === 'load') throw new Error('Proxy unavailable');
        },
        findElements: async () => failAt === 'input' ? [] : [input],
        wait: async (predicate) => {
            const result = await predicate();
            if (!result) throw new Error('Input timed out');
            return result;
        },
    };
}
const request = { id: 1, proxySite: 'https://proxy.invalid', channel: 'fixture_channel' };
const clickedPlay = async () => ({ clicked: true });

test('submission alone remains unverified and preserves the exact tab handle', async () => {
    const session = await openSession(fakeDriver(), request,
        async () => { assert.fail('Do not verify playback before clicking Play'); },
        async () => ({ clicked: false, status: 'unverified', reason: 'No player found' }));
    assert.equal(session.handle, 'new-tab');
    assert.equal(session.submitted, true);
    assert.equal(session.status, 'unverified');
});

for (const failure of ['guard', 'load', 'input', 'submit']) {
    test(`${failure} failure is counted and never reported as submitted or playing`, async () => {
        const session = await openSession(fakeDriver(failure), request, async () => {
            assert.fail('Playback must not be checked after a failed submission');
        });
        assert.equal(session.submitted, false);
        assert.equal(session.status, 'failed');
        assert.equal(summarizeSessions([session]).playing, 0);
    });
}

test('monitor downgrades stalled or closed tabs and can report recovery', async () => {
    const session = await openSession(fakeDriver(), request,
        async () => ({ status: 'playing', reason: 'Video advancing' }), clickedPlay);
    assert.equal(session.playClicked, true);
    await refreshSession(fakeDriver(), session, request.channel,
        async () => ({ status: 'unverified', reason: 'Playback stalled' }));
    assert.equal(session.status, 'unverified');
    await refreshSession(fakeDriver(), session, request.channel,
        async () => ({ status: 'playing', reason: 'Video advancing' }));
    assert.equal(session.status, 'playing');
    await refreshSession(fakeDriver('closed'), session, request.channel);
    assert.equal(session.status, 'failed');
});

test('a successful click is required before verification and is not repeated by monitoring', async () => {
    const events = [];
    const start = async () => { events.push('click'); return { clicked: true }; };
    const verify = async () => { events.push('verify'); return { status: 'playing', reason: 'Advancing' }; };
    const session = await openSession(fakeDriver(), request, verify, start);
    await refreshSession(fakeDriver(), session, request.channel, verify, start);
    assert.deepEqual(events, ['click', 'verify', 'verify']);
});

test('a missing Play button can be retried later without claiming playback early', async () => {
    let verified = false;
    const verify = async () => { verified = true; return { status: 'playing', reason: 'Advancing' }; };
    const session = await openSession(fakeDriver(), request, verify,
        async () => ({ clicked: false, status: 'blocked', reason: 'Play button covered' }));
    assert.equal(verified, false);
    assert.equal(session.status, 'blocked');
    await refreshSession(fakeDriver(), session, request.channel, verify, clickedPlay);
    assert.equal(session.playClicked, true);
    assert.equal(session.status, 'playing');
});

test('summary uses observed outcomes and never claims requested views were sent', () => {
    const sessions = ['playing', 'unverified', 'blocked', 'failed', 'failed'].map((status) => ({ status }));
    assert.deepEqual(summarizeSessions(sessions), { total: 5, playing: 1, unverified: 1, blocked: 1, failed: 2 });
    const output = [];
    const original = console.log;
    try {
        console.log = (message) => output.push(message);
        printSummary(sessions, request.channel);
    } finally {
        console.log = original;
    }
    assert.match(output.join('\n'), /1 playing.*1 unverified.*1 blocked.*2 failed/);
    assert.match(output.join('\n'), /Twitch-counted viewers: unknown/);
    assert.doesNotMatch(output.join('\n'), /Sent.*view/);
});
