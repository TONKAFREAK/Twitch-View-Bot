const { By, error } = require('selenium-webdriver');

// Runs inside each document. Proxy URLs and links in chat/sidebar alone are
// deliberately not treated as proof that the requested channel loaded.
function readPlayerState(channel) {
    const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const matchesChannel = (value) => {
        try {
            const url = new URL(value);
            if (url.hostname === 'player.twitch.tv') {
                return url.searchParams.get('channel')?.toLowerCase() === channel;
            }
            return ['twitch.tv', 'www.twitch.tv', 'm.twitch.tv'].includes(url.hostname) &&
                url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase() === channel;
        } catch {
            return false;
        }
    };
    const target = [location.href,
        document.querySelector('link[rel="canonical"]')?.href,
        document.querySelector('meta[property="og:url"]')?.content,
    ].some(matchesChannel);
    const embed = location.hostname === 'player.twitch.tv' && target;
    const notices = [
        ['failed', '[data-a-target="player-error-message"]', 'Player error'],
        ['blocked', '[data-a-target="offline-channel-main-content"]', 'Channel is offline'],
        ['blocked', '[data-a-target="content-overlay-gate"], [data-a-target="player-overlay-content-gate"]', 'Player requires user interaction'],
        ['blocked', '#challenge-running, #challenge-error-text, .cf-error-details, iframe[src*="recaptcha"][src*="bframe"]', 'Proxy verification or access challenge'],
        ['unverified', '[data-a-target="video-ad-label"], [data-a-target="video-ad-countdown"]', 'Advertisement visible; stream playback unverified'],
    ];
    const issues = [];
    for (const [status, selector, reason] of notices) {
        if ([...document.querySelectorAll(selector)].some(visible)) {
            issues.push({ status, reason });
        }
    }
    const videos = [...document.querySelectorAll('video')]
        .filter((video) => visible(video) && target &&
            (embed || video.closest('[data-a-target="video-player"], .video-player')))
        .map((video) => {
            const quality = video.getVideoPlaybackQuality?.();
            return {
                element: video,
                source: video.currentSrc,
                time: video.currentTime,
                paused: video.paused,
                ended: video.ended,
                seeking: video.seeking,
                readyState: video.readyState,
                width: video.videoWidth,
                height: video.videoHeight,
                error: video.error?.code || null,
                frames: quality ? quality.totalVideoFrames - quality.droppedVideoFrames : null,
            };
        });
    return { target, videos, issues };
}

async function samplePlayback(driver, channel) {
    const result = { videos: [], issues: [], inspectionErrors: 0 };
    let visited = 0;
    async function visit(depth, framePath = []) {
        visited++;
        const state = await driver.executeScript(readPlayerState, channel.toLowerCase());
        // Unrelated advertising frames must not override the channel's status.
        if (depth === 0 || state.target) result.issues.push(...state.issues);
        for (const video of state.videos) {
            const { element, ...properties } = video;
            result.videos.push({ ...properties, id: await element.getId(), element, framePath });
        }
        if (depth >= 4) return;
        const frames = await driver.findElements(By.css('iframe, frame'));
        for (const frame of frames) {
            if (visited >= 20) break;
            let entered = false;
            try {
                if (!(await frame.isDisplayed())) continue;
                await driver.switchTo().frame(frame);
                entered = true;
                await visit(depth + 1, [...framePath, frame]);
            } catch (err) {
                if (!(err instanceof error.StaleElementReferenceError || err instanceof error.NoSuchFrameError)) throw err;
                result.inspectionErrors++;
            } finally {
                if (entered) await driver.switchTo().parentFrame();
            }
        }
    }
    await driver.switchTo().defaultContent();
    try {
        await visit(0);
        return result;
    } finally {
        await driver.switchTo().defaultContent();
    }
}

class PlaybackTracker {
    constructor(minObservationMs = 2000) {
        this.minObservationMs = minObservationMs;
        this.previous = new Map();
    }

    observe(snapshot, now) {
        if (snapshot.issues.length) {
            this.previous.clear();
            return snapshot.issues.find((issue) => issue.status === 'failed') || snapshot.issues[0];
        }
        if (snapshot.videos.length > 1) {
            this.previous.clear();
            return { status: 'unverified', reason: 'Multiple candidate players found; channel playback is ambiguous' };
        }
        const next = new Map();
        let outcome = { status: 'unverified', reason: snapshot.inspectionErrors
            ? 'Page changed during inspection; playback unverified'
            : 'No identifiable player for the requested channel' };
        for (const video of snapshot.videos) {
            if (video.error) {
                outcome = { status: 'failed', reason: `Video playback error (code ${video.error})` };
                continue;
            }
            if (video.paused || video.ended || video.seeking || video.readyState < 2 || !video.width || !video.height) {
                outcome = { status: 'unverified', reason: video.paused ? 'Player is paused'
                    : video.ended ? 'Video has ended' : 'Player is loading, buffering, or seeking' };
                continue;
            }
            const before = this.previous.get(video.id);
            const delta = before ? video.time - before.video.time : 0;
            const elapsed = before ? (now - before.at) / 1000 : 0;
            const advances = before && before.video.source === video.source && delta > 0.05 &&
                delta <= elapsed * 4 + 0.5 &&
                (video.frames === null || before.video.frames === null || video.frames > before.video.frames);
            const track = {
                video, at: now,
                since: advances ? before.since : now,
                startTime: advances ? before.startTime : video.time,
                advances: advances ? before.advances + 1 : 0,
            };
            next.set(video.id, track);
            if (track.advances >= 2 && now - track.since >= this.minObservationMs && video.time - track.startTime >= 1) {
                this.previous = next;
                return { status: 'playing', reason: 'Channel video advanced across multiple samples; Twitch count unverified' };
            }
            outcome = { status: 'unverified', reason: 'Video playback has not advanced consistently yet' };
        }
        this.previous = next;
        return outcome;
    }
}

async function checkPlayback(driver, channel, { timeoutMs = 15000, pollMs = 1000 } = {}) {
    const tracker = new PlaybackTracker();
    const deadline = Date.now() + timeoutMs;
    let outcome;
    do {
        outcome = tracker.observe(await samplePlayback(driver, channel), Date.now());
        if (outcome.status === 'playing') return outcome;
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, remaining)));
    } while (Date.now() <= deadline);
    return outcome;
}

module.exports = { checkPlayback, samplePlayback, PlaybackTracker };
