const { error } = require('selenium-webdriver');
const { samplePlayback } = require('./playback');

// Injected before page scripts, including scripts in frames. Only a trusted
// click on the specific button selected below releases the playback guard.
function blockAutoplay() {
    if (window.__manualPlayback) return;
    const state = { button: null, clicked: false };
    Object.defineProperty(window, '__manualPlayback', { value: state });
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
        if (!state.clicked) {
            return Promise.reject(new DOMException('Use the player Play button to start playback.', 'NotAllowedError'));
        }
        return originalPlay.apply(this, args);
    };
    const pauseAutoplay = (event) => {
        if (!state.clicked && event.target instanceof HTMLMediaElement) event.target.pause();
    };
    document.addEventListener('play', pauseAutoplay, true);
    const removeAutoplay = (node) => {
        if (!(node instanceof Element)) return;
        if (node.matches('video[autoplay], audio[autoplay]')) node.removeAttribute('autoplay');
        for (const media of node.querySelectorAll('video[autoplay], audio[autoplay]')) {
            media.removeAttribute('autoplay');
        }
    };
    const observer = new MutationObserver((changes) => {
        for (const change of changes) {
            if (change.type === 'attributes') removeAutoplay(change.target);
            else for (const node of change.addedNodes) removeAutoplay(node);
        }
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['autoplay'] });
    removeAutoplay(document.documentElement);
    const releaseOnClick = (event) => {
        if (!event.isTrusted || !state.button?.contains(event.target)) return;
        state.clicked = true;
        state.button = null;
        HTMLMediaElement.prototype.play = originalPlay;
        observer.disconnect();
        document.removeEventListener('play', pauseAutoplay, true);
        window.removeEventListener('click', releaseOnClick, true);
    };
    window.addEventListener('click', releaseOnClick, true);
}

async function preventAutoplay(driver) {
    const context = await driver.getWindowHandle();
    const bidi = await driver.getBidi();
    try {
        // BiDi applies the preload to child frames even when Chrome puts them
        // in a separate process, unlike a command sent only to the parent page.
        const response = await bidi.send({
            method: 'script.addPreloadScript',
            params: { functionDeclaration: blockAutoplay.toString(), contexts: [context] },
        });
        if (response.error || !response.result?.script) {
            throw new Error(response.message || 'Could not install the autoplay guard');
        }
    } finally {
        await bidi.close();
    }
}

function findPlayButtons(video) {
    const player = video.closest('[data-a-target="video-player"], .video-player') || document;
    return [...player.querySelectorAll('button, [role="button"]')].filter((button) => {
        const target = button.getAttribute('data-a-target');
        const label = (button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '').trim();
        // Never toggle a control that is still labelled Pause while the UI is
        // catching up with a paused video.
        if (/^pause\b/i.test(label)) return false;
        return ['player-play-pause-button', 'player-overlay-play-button'].includes(target) ||
            /^play(?: video| stream)?(?:\s*\([^)]*\))?$/i.test(label);
    });
}

async function clickPlayButton(driver, channel, { timeoutMs = 15000, pollMs = 500 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let result = { clicked: false, status: 'unverified', reason: 'No Play button found for the requested channel' };
    do {
        try {
            const snapshot = await samplePlayback(driver, channel);
            if (snapshot.issues.length) {
                const issue = snapshot.issues.find((item) => item.status === 'failed') || snapshot.issues[0];
                result = { clicked: false, ...issue };
            } else if (snapshot.videos.length === 1) {
                const video = snapshot.videos[0];
                for (const frame of video.framePath) await driver.switchTo().frame(frame);
                // Also covers frames created before the guard was installed.
                await driver.executeScript(blockAutoplay);
                const clicked = await driver.executeScript('return window.__manualPlayback.clicked');
                if (clicked) return { clicked: true };
                await driver.executeScript((element) => {
                    element.autoplay = false;
                    element.pause();
                    element.scrollIntoView({ block: 'center' });
                }, video.element);
                await driver.actions({ async: true }).move({ origin: video.element }).perform();
                const buttons = await driver.executeScript(findPlayButtons, video.element);
                result = { clicked: false, status: 'unverified', reason: 'No visible, enabled Play button found for the requested channel' };
                for (const button of buttons) {
                    if (!(await button.isDisplayed()) || !(await button.isEnabled())) continue;
                    await driver.executeScript((element) => { window.__manualPlayback.button = element; }, button);
                    try {
                        // WebDriver generates the real button click. No JS
                        // click() or media.play() fallback is used here.
                        await button.click();
                        if (await driver.executeScript('return window.__manualPlayback.clicked')) return { clicked: true };
                    } finally {
                        await driver.executeScript('window.__manualPlayback.button = null');
                    }
                }
            } else {
                result = { clicked: false, status: 'unverified', reason: snapshot.videos.length > 1
                    ? 'Multiple candidate players found; Play button is ambiguous'
                    : 'No identifiable player for the requested channel' };
            }
        } catch (err) {
            if (err instanceof error.ElementClickInterceptedError) {
                result = { clicked: false, status: 'blocked', reason: 'Play button is covered by another element' };
            } else if (err instanceof error.StaleElementReferenceError || err instanceof error.NoSuchFrameError ||
                err instanceof error.ElementNotInteractableError || err instanceof error.MoveTargetOutOfBoundsError) {
                result = { clicked: false, status: 'unverified', reason: 'Player controls changed or are not interactable yet' };
            } else {
                throw err;
            }
        } finally {
            await driver.switchTo().defaultContent();
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, remaining)));
    } while (Date.now() <= deadline);
    return result;
}

module.exports = { preventAutoplay, clickPlayButton };
