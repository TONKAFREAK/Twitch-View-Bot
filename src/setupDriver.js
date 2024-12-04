const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
async function setupDriver(useGPU) {

    let options = new chrome.Options();

    options.addArguments('--headless');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--mute-audio');
    options.addArguments("--log-level=3");
    //options.addArguments("--incognito");
    if (!useGPU) {
        options.addArguments('--disable-gpu');
        options.addArguments("--disable-software-rasterizer");
    }
    //options.addArguments('--no-sandbox');
    options.addExtensions('./src/extension/adblocker.crx');

    options.setAcceptInsecureCerts(true);

    let driver = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

    return driver;
}

module.exports = setupDriver;