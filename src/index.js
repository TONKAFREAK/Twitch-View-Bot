const chalk = require('chalk');
const { By, Key } = require('selenium-webdriver');
const {promptQuestion, promptExit} = require("./cli");
const setupDriver = require("./setupDriver");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendViewer() {

    try {

        promptQuestion()
        .then(async data => {
            console.log(chalk.redBright(`\n---------------------------------------------------------------------------------------------------`));
            console.log(chalk.greenBright(`Setting up driver....`));
            let driver = await setupDriver();
            console.log(chalk.greenBright(`\nDriver setup!`));
            console.log(chalk.greenBright(`Sending ${data.viewers} view(s) to ${data.streamer}....( might take some time depending on the number of viewers )`));
            
            const proxySites = [
                'https://proxyium.com/',
                'https://www.croxyproxy.com/',
                'https://www.blockaway.net/',
                'https://www.croxyproxy.rocks',
                'https://www.croxy.org',
                'https://www.croxy.network',
                'https://www.croxyproxy.net',
            ];

            let viewersPromises = [];

            let checkForDuplicate = true;
            for (let i = 1; i <= data.viewers; i++) {
                viewersPromises.push((async () => {
                try {
                    await driver.executeScript('window.open()');
                    let tabs = await driver.getAllWindowHandles();
                    await driver.switchTo().window(tabs[tabs.length - 1]);
                    
                    let proxyIndex = (i - 1) % proxySites.length;
                    let proxySite = proxySites[proxyIndex];
                    
                    await driver.get(proxySite);
                    let urlInput;
                    
                    if (proxySite.includes('proxyium')) {
                        urlInput = await driver.findElement(By.id('unique-form-control'));
                    } else {
                        urlInput = await driver.findElement(By.id('url'));
                    }
                    await urlInput.sendKeys(`https://www.twitch.tv/${data.streamer}`);
                    await urlInput.sendKeys(Key.ENTER);

                    console.log("pressed enter");

                    console.log(chalk.green(`Sending viewer ${i} using ${proxySite}`));

                    await sleep(500);

                } catch (error) {
                    console.log(chalk.red(error));
                }
            }

            )());

        }

            await Promise.all(viewersPromises);

            promptExit(data.viewers, data.streamer);

            console.log(chalk.yellowBright(`\n---------------------------------------------------------------------------------------------------`));        

            const tabs = await driver.getAllWindowHandles();
            const urls = new Set();

            for (let i = 0; i < tabs.length; i++) {
                await driver.switchTo().window(tabs[i]);

                if (checkForDuplicate) {
                    const currentUrl = await driver.executeScript("return window.location.href;");

                    if (urls.has(currentUrl)) {
                        console.log(chalk.yellow(`Duplicate proxy found on tab ${i + 1}: ${currentUrl} - Sending a new one`));
                        await driver.get('https://www.youtubeunblocked.live');
                        let urlInput = await driver.findElement(By.id('url'));
                        await urlInput.sendKeys(`https://www.twitch.tv/${data.streamer}`);
                        await urlInput.sendKeys(Key.ENTER);
                        await sleep(500);
                    } else {
                        urls.add(currentUrl);
                    }
                }

                await sleep(2000);

                if (i == tabs.length - 1) {
                    checkForDuplicate = false;
                    console.log(urls);
                    urls.clear();
                    i = 0;
                }
            }
            sleep(999999999);

        })
        .catch(error => {
            console.error(error);
        });

    } catch (error) {
        console.error(error);
    }
}

process.on('SIGINT' || 'exit', async () => {
    console.log(chalk.redBright(`\n\nShutting down the driver....`));
    process.exit();       
});

sendViewer();


/*
 Copyright 2024 TONKA

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
*/




