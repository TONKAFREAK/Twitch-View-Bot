const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
async function setupDriver() {

    let options = new chrome.Options();

    options.addArguments('--headless=old');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--mute-audio');
    options.addArguments("--log-level=3");
    options.addArguments("--disable-software-rasterizer");
    //options.addArguments("--incognito");
    options.addArguments('--disable-gpu');
    options.addArguments('--no-sandbox');
    options.addExtensions('./src/extension/adblocker.crx');

    options.setAcceptInsecureCerts(true);

    let driver = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

    return driver;
}

module.exports = setupDriver;