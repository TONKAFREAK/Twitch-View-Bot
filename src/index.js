const chalk = require('chalk');
const { By, Key } = require('selenium-webdriver');
const {promptQuestion, promptExit} = require("./cli");
const setupDriver = require("./setupDriver");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendViewer() {

    promptQuestion()
    .then(async data => {
        console.log(chalk.redBright(`\n---------------------------------------------------------------------------------------------------`));
        console.log(chalk.greenBright(`Setting up driver....`));
        let driver = await setupDriver();
        console.log(chalk.greenBright(`\nDriver setup!`));
        console.log(chalk.greenBright(`Sending ${data.viewers} view(s) to ${data.streamer}....( might take some time depending on the number of viewers )`));
        for (let i = 1; i < data.viewers+1; i++) {
            try {
                await driver.executeScript('window.open()');
                let tabs = await driver.getAllWindowHandles();
                await driver.switchTo().window(tabs[tabs.length - 1]); 
                await driver.get(`https://www.blockaway.net/`);
                let urlInput = await driver.findElement(By.id('url'));
                await urlInput.sendKeys(`https://www.twitch.tv/${data.streamer}`);
                await urlInput.sendKeys(Key.ENTER);
                if (i == 1){
                    //console.log(chalk.green(`Sending ${i}st viewer`));
                } else if (i == 2){
                    //console.log(chalk.green(`Sending ${i}nd viewer`));
                } else if (i == 3){
                    //console.log(chalk.green(`Sending ${i}rd viewer`));
                } else {
                    //console.log(chalk.green(`Sending ${i}th viewer`));
                }
                await sleep(500);
               
            } catch (error) {
                console.log(chalk.red(error));
            }
        }

        promptExit(data.viewers, data.streamer);

        let tabs = await driver.getAllWindowHandles();
        for (let i = 0; i < tabs.length; i++) {
            await driver.switchTo().window(tabs[i]);
            //console.log(chalk.green(`Switching to tab ${i + 1} and staying for 5 seconds`));
            await sleep(2000);
            
            if (i == tabs.length - 1) {
                i = 0;
            }
        }

        sleep(999999999);
    })
    .catch(error => {
        console.error(error);
    });


}

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




