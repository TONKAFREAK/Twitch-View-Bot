const { By, Key, error } = require('selenium-webdriver');
const { checkPlayback } = require('./playback');
const { preventAutoplay, clickPlayButton } = require('./playButton');

async function openSession(driver, { id, proxySite, channel }, verify = checkPlayback, start = clickPlayButton) {
    const session = { id, proxySite, handle: null, submitted: false, playClicked: false, status: 'failed', reason: '' };
    let stage = 'opening tab';
    try {
        await driver.switchTo().newWindow('tab');
        session.handle = await driver.getWindowHandle();
        stage = 'disabling autoplay';
        await preventAutoplay(driver);
        stage = 'loading proxy';
        await driver.get(proxySite);
        stage = 'finding proxy URL input';
        // Retry stale inputs as proxies often replace the form during load.
        const input = await driver.wait(async () => {
            const inputs = await driver.findElements(By.css('#unique-form-control, #url, input[type="url"]'));
            for (const candidate of inputs) {
                try {
                    if (await candidate.isDisplayed() && await candidate.isEnabled()) return candidate;
                } catch (err) {
                    if (!(err instanceof error.StaleElementReferenceError)) throw err;
                }
            }
            return false;
        }, 10000, 'No visible, enabled proxy URL input');
        stage = 'submitting channel URL';
        await input.clear();
        await input.sendKeys(`https://www.twitch.tv/${channel}`);
        await input.sendKeys(Key.ENTER);
        session.submitted = true;
        stage = 'clicking Play';
        await startAndVerify(driver, session, channel, verify, start);
    } catch (err) {
        session.status = 'failed';
        session.reason = `${stage}: ${err.message.split('\n')[0]}`;
    }
    session.checkedAt = new Date().toISOString();
    return session;
}

async function startAndVerify(driver, session, channel, verify, start, options) {
    if (!session.playClicked) {
        const result = await start(driver, channel, options);
        session.playClicked = result.clicked;
        if (!result.clicked) {
            session.status = result.status;
            session.reason = result.reason;
            return;
        }
    }
    Object.assign(session, await verify(driver, channel, options));
}

async function refreshSession(driver, session, channel, verify = checkPlayback, start = clickPlayButton) {
    if (!session.submitted || !session.handle) return;
    try {
        await driver.switchTo().window(session.handle);
        await startAndVerify(driver, session, channel, verify, start, { timeoutMs: 4000 });
    } catch (err) {
        session.status = 'failed';
        session.reason = `checking playback: ${err.message.split('\n')[0]}`;
    }
    session.checkedAt = new Date().toISOString();
}

function summarizeSessions(sessions) {
    const counts = { total: sessions.length, playing: 0, unverified: 0, blocked: 0, failed: 0 };
    for (const session of sessions) counts[session.status]++;
    return counts;
}

module.exports = { openSession, refreshSession, summarizeSessions };
