const test = require('node:test');
const assert = require('node:assert/strict');
const { PlaybackTracker } = require('../src/playback');

const video = (time, overrides = {}) => ({
    id: 'player-1', source: 'stream', time, frames: time * 30,
    paused: false, ended: false, seeking: false, readyState: 4,
    width: 640, height: 360, error: null, ...overrides,
});
const snapshot = (videos = [], issues = []) => ({ videos, issues, inspectionErrors: 0 });

test('requires multiple advancing observations, not just a loaded video', () => {
    const tracker = new PlaybackTracker();
    assert.equal(tracker.observe(snapshot([video(0)]), 0).status, 'unverified');
    assert.equal(tracker.observe(snapshot([video(1)]), 1000).status, 'unverified');
    assert.equal(tracker.observe(snapshot([video(2)]), 2000).status, 'playing');
});

for (const [name, overrides] of [
    ['paused', { paused: true }], ['ended', { ended: true }],
    ['buffering', { readyState: 1 }], ['seeking', { seeking: true }],
    ['no decoded picture', { width: 0 }], ['no advancing frames', { frames: 0 }],
]) {
    test(`${name} cannot be reported as playing`, () => {
        const tracker = new PlaybackTracker();
        for (let n = 0; n < 5; n++) {
            assert.equal(tracker.observe(snapshot([video(n, overrides)]), n * 1000).status, 'unverified');
        }
    });
}

test('a frozen timeline cannot be reported as playing', () => {
    const tracker = new PlaybackTracker();
    for (let n = 0; n < 5; n++) {
        assert.equal(tracker.observe(snapshot([video(3, { frames: n * 30 })]), n * 1000).status, 'unverified');
    }
});

test('video errors are failures', () => {
    const result = new PlaybackTracker().observe(snapshot([video(1, { error: 4 })]), 0);
    assert.equal(result.status, 'failed');
    assert.match(result.reason, /code 4/);
});

test('ads and access gates reset previous playback evidence', () => {
    for (const issue of [
        { status: 'unverified', reason: 'Advertisement visible' },
        { status: 'blocked', reason: 'Access challenge' },
    ]) {
        const tracker = new PlaybackTracker();
        tracker.observe(snapshot([video(0)]), 0);
        tracker.observe(snapshot([video(1)]), 1000);
        assert.equal(tracker.observe(snapshot([video(2)], [issue]), 2000).status, issue.status);
        assert.equal(tracker.observe(snapshot([video(3)]), 3000).status, 'unverified');
    }
});

test('a player replacement, source change, or seek cannot complete earlier evidence', () => {
    for (const replacement of [video(2, { id: 'new-player' }), video(2, { source: 'other' }), video(200)]) {
        const tracker = new PlaybackTracker();
        tracker.observe(snapshot([video(0)]), 0);
        tracker.observe(snapshot([video(1)]), 1000);
        assert.equal(tracker.observe(snapshot([replacement]), 2000).status, 'unverified');
    }
});

test('a vanished player loses playing status and must be verified again', () => {
    const tracker = new PlaybackTracker();
    for (let n = 0; n < 3; n++) tracker.observe(snapshot([video(n)]), n * 1000);
    assert.equal(tracker.observe(snapshot(), 3000).status, 'unverified');
    assert.equal(tracker.observe(snapshot([video(4)]), 4000).status, 'unverified');
});

test('multiple candidate players cannot produce a false positive', () => {
    const tracker = new PlaybackTracker();
    for (let n = 0; n < 3; n++) {
        const result = tracker.observe(snapshot([video(n), video(n, { id: 'preview' })]), n * 1000);
        assert.equal(result.status, 'unverified');
        assert.match(result.reason, /ambiguous/);
    }
});

test('browsers without frame counters still require sustained time advancement', () => {
    const tracker = new PlaybackTracker();
    assert.equal(tracker.observe(snapshot([video(0, { frames: null })]), 0).status, 'unverified');
    assert.equal(tracker.observe(snapshot([video(1, { frames: null })]), 1000).status, 'unverified');
    assert.equal(tracker.observe(snapshot([video(2, { frames: null })]), 2000).status, 'playing');
});
