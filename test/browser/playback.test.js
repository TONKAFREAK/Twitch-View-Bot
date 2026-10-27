const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const setupDriver = require('../../src/setupDriver');
const { checkPlayback, samplePlayback } = require('../../src/playback');
const { openSession, refreshSession } = require('../../src/sessions');
const { preventAutoplay, clickPlayButton } = require('../../src/playButton');

let driver;
let server;
let origin;
const channel = 'fixture_channel';

function playerPage({ target = channel, notice = '', broken = false, button = true, covered = false } = {}) {
    return `<!doctype html><link rel="canonical" href="https://www.twitch.tv/${target}">
        ${notice}<div data-a-target="video-player"><video muted autoplay width="320" height="180"></video>
        ${button ? '<button data-a-target="player-play-pause-button" aria-label="Play">Play</button>' : ''}</div>
        ${covered ? '<div style="position:fixed;inset:0;background:white;z-index:999">Covered</div>' : ''}
        <script>
        const video = document.querySelector('video');
        const button = document.querySelector('button');
        window.playClicks = 0;
        button?.addEventListener('click', (event) => {
            window.playClicks++;
            window.clickTrusted = event.isTrusted;
            if (video.paused) video.play().catch(() => {});
            else video.pause();
        });
        for (const event of ['play', 'pause']) video.addEventListener(event, () => {
            button?.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
        });
        ${broken ? "video.src='/missing.mp4';" : `
            const canvas = document.createElement('canvas');
            canvas.width = 320; canvas.height = 180;
            const context = canvas.getContext('2d');
            let frame = 0;
            setInterval(() => {
                context.fillStyle = frame++ % 2 ? 'red' : 'blue';
                context.fillRect(0, 0, 320, 180);
            }, 100);
            video.srcObject = canvas.captureStream(10);
            video.play().catch(() => {});
        `}
        </script>`;
}

before(async () => {
    server = http.createServer((req, res) => {
        const route = new URL(req.url, 'http://fixture').pathname;
        res.setHeader('Content-Type', 'text/html');
        switch (route) {
            case '/player': return res.end(playerPage());
            case '/wrong-channel': return res.end(playerPage({ target: 'another_channel' }));
            case '/ad': return res.end(playerPage({ notice: '<div data-a-target="video-ad-label">Advertisement</div>' }));
            case '/broken': return res.end(playerPage({ broken: true }));
            case '/no-button': return res.end(playerPage({ button: false }));
            case '/covered': return res.end(playerPage({ covered: true }));
            case '/framed': return res.end(`<iframe width="640" height="360" src="http://localhost:${server.address().port}/player"></iframe>`);
            case '/proxy': return res.end('<form action="/player"><input id="url" name="url" type="url"></form>');
            case '/empty-proxy': return res.end('<form action="/submitted"><input id="url" name="url" type="url"></form>');
            case '/submitted': return res.end('<h1>Request submitted</h1>');
            case '/blocked': return res.end('<div id="challenge-running">Verify you are human</div>');
            default: res.statusCode = 404; return res.end('Not found');
        }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    driver = await setupDriver(false);
    await driver.manage().setTimeouts({ pageLoad: 10000, script: 5000 });
});

after(async () => {
    try {
        if (driver) await driver.quit();
    } finally {
        if (server) await new Promise((resolve) => server.close(resolve));
    }
});

test('real video playback is detected; pausing removes playing status', async () => {
    await driver.get(`${origin}/player`);
    assert.equal((await checkPlayback(driver, channel, { timeoutMs: 6000 })).status, 'playing');
    await driver.executeScript("document.querySelector('video').pause()");
    const paused = await checkPlayback(driver, channel, { timeoutMs: 300, pollMs: 100 });
    assert.equal(paused.status, 'unverified');
    assert.match(paused.reason, /paused/);
});

test('inspect a player in a cross-origin iframe and restore the top document', async () => {
    await driver.get(`${origin}/framed`);
    assert.equal((await checkPlayback(driver, channel, { timeoutMs: 6000 })).status, 'playing');
    assert.equal(await driver.executeScript('return location.pathname'), '/framed');
});

test('video on a different channel is not accepted', async () => {
    await driver.get(`${origin}/wrong-channel`);
    assert.equal((await checkPlayback(driver, channel, { timeoutMs: 300, pollMs: 100 })).status, 'unverified');
    assert.equal((await samplePlayback(driver, channel)).videos.length, 0);
});

test('advertisements, challenges, and broken media do not pass', async () => {
    for (const [route, expected] of [['ad', 'unverified'], ['blocked', 'blocked'], ['broken', 'failed']]) {
        await driver.get(`${origin}/${route}`);
        assert.equal((await checkPlayback(driver, channel, { timeoutMs: 700, pollMs: 100 })).status, expected, route);
    }
});

test('successful form submission without a player remains unverified', async () => {
    const session = await openSession(driver, { id: 1, proxySite: `${origin}/empty-proxy`, channel },
        (browser, target) => checkPlayback(browser, target, { timeoutMs: 300, pollMs: 100 }),
        (browser, target) => clickPlayButton(browser, target, { timeoutMs: 300, pollMs: 100 }));
    assert.equal(session.submitted, true);
    assert.equal(session.status, 'unverified');
});

test('form → channel → playback → paused → closed tab updates the same session', async () => {
    const session = await openSession(driver, { id: 2, proxySite: `${origin}/proxy`, channel });
    assert.equal(session.status, 'playing');
    assert.equal(session.playClicked, true);
    assert.equal(await driver.executeScript('return window.playClicks'), 1);
    assert.equal(await driver.executeScript('return window.clickTrusted'), true);
    await driver.executeScript("document.querySelector('video').pause()");
    await refreshSession(driver, session, channel,
        (browser, target) => checkPlayback(browser, target, { timeoutMs: 300, pollMs: 100 }));
    assert.equal(session.status, 'unverified');
    assert.equal(await driver.executeScript('return window.playClicks'), 1);
    await driver.close();
    await refreshSession(driver, session, channel);
    assert.equal(session.status, 'failed');
    await driver.switchTo().window((await driver.getAllWindowHandles())[0]);
});

async function guardedPage(route) {
    await driver.switchTo().newWindow('tab');
    await preventAutoplay(driver);
    await driver.get(`${origin}/${route}`);
}

test('autoplay stays paused until a real Play button click starts the player', async () => {
    await guardedPage('player');
    assert.equal(await driver.executeScript("return document.querySelector('video').paused"), true);
    assert.equal(await driver.executeScript("return document.querySelector('video').autoplay"), false);
    assert.equal(await driver.executeScript('return window.playClicks'), 0);
    const result = await clickPlayButton(driver, channel, { timeoutMs: 3000, pollMs: 100 });
    assert.equal(result.clicked, true);
    assert.equal(await driver.executeScript('return window.playClicks'), 1);
    assert.equal(await driver.executeScript('return window.clickTrusted'), true);
    assert.equal((await checkPlayback(driver, channel, { timeoutMs: 6000 })).status, 'playing');
});

test('a synthetic page click cannot release the autoplay guard', async () => {
    await guardedPage('player');
    await driver.executeScript("document.querySelector('button').click()");
    assert.equal(await driver.executeScript('return window.clickTrusted'), false);
    assert.equal(await driver.executeScript('return window.__manualPlayback.clicked'), false);
    assert.equal(await driver.executeScript("return document.querySelector('video').paused"), true);
});

test('block autoplay and click Play inside a cross-origin player frame', async () => {
    await guardedPage('framed');
    await driver.switchTo().frame(0);
    assert.equal(await driver.executeScript("return document.querySelector('video').paused"), true);
    await driver.switchTo().defaultContent();
    assert.equal((await clickPlayButton(driver, channel, { timeoutMs: 3000, pollMs: 100 })).clicked, true);
    assert.equal(await driver.executeScript('return location.pathname'), '/framed');
    assert.equal((await checkPlayback(driver, channel, { timeoutMs: 6000 })).status, 'playing');
});

test('missing, covered, or wrong-channel Play buttons never trigger playback', async () => {
    for (const [route, expected] of [['no-button', 'unverified'], ['covered', 'blocked'], ['wrong-channel', 'unverified']]) {
        await guardedPage(route);
        const result = await clickPlayButton(driver, channel, { timeoutMs: 400, pollMs: 100 });
        assert.equal(result.clicked, false, route);
        assert.equal(result.status, expected, route);
        assert.equal(await driver.executeScript("return document.querySelector('video').paused"), true, route);
        assert.equal(await driver.executeScript('return window.playClicks'), 0, route);
    }
});
