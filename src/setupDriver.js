const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

async function setupDriver(useGPU) {

    let options = new chrome.Options();
    options.enableBidi();

    options.addArguments('--headless');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--mute-audio');
    options.addArguments("--log-level=3");
    //options.addArguments("--incognito");
    if (!useGPU) {
        options.addArguments('--disable-gpu');
        options.addArguments("--disable-software-rasterizer");
    }
    options.addExtensions(path.join(__dirname, 'extension', 'adblocker.crx'));

    options.setAcceptInsecureCerts(true);

    const logPath = path.join(__dirname, '..', 'chromedriver.log');
    const service = new chrome.ServiceBuilder()
        .loggingTo(logPath)
        .enableChromeLogging();
    if (process.env.CHROMEDRIVER_VERBOSE === '1') {
        service.enableVerboseLogging();
    } else {
        service.addArguments('--log-level=WARNING');
    }

    try {
        return await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .setChromeService(service)
            .build();
    } catch (error) {
        error.message += `\nChromeDriver startup log: ${logPath}`;
        let log = '';
        try {
            log = fs.readFileSync(logPath, 'utf8');
        } catch {
            // The service may have failed before creating its log.
        }
        if (process.platform === 'linux' && log.includes('No usable sandbox!')) {
            error.message += '\nChrome could not initialize its sandbox. On Ubuntu with Selenium-managed Chrome, run: bash scripts/allow-selenium-chrome.sh (see README.MD).';
        }
        throw error;
    }
}

module.exports = setupDriver;
