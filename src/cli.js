const readline = require('readline');
const chalk = require('chalk');
const { summarizeSessions } = require('./sessions');

const tonka = `
\t\t\t  ▄▄▄█████▓ ▒█████   ███▄    █  ██ ▄█▀▄▄▄         
\t\t\t  ▓  ██▒ ▓▒▒██▒  ██▒ ██ ▀█   █  ██▄█▒▒████▄       
\t\t\t  ▒ ▓██░ ▒░▒██░  ██▒▓██  ▀█ ██▒▓███▄░▒██  ▀█▄     
\t\t\t  ░ ▓██▓ ░ ▒██   ██░▓██▒  ▐▌██▒▓██ █▄░██▄▄▄▄██    
\t\t\t    ▒██▒ ░ ░ ████▓▒░▒██░   ▓██░▒██▒ █▄▓█   ▓██▒   
\t\t\t    ▒ ░░   ░ ▒░▒░▒░ ░ ▒░   ▒ ▒ ▒ ▒▒ ▓▒▒▒   ▓▒█░   
\t\t\t      ░      ░ ▒ ▒░ ░ ░░   ░ ▒░░ ░▒ ▒░ ▒   ▒▒ ░   
\t\t\t    ░      ░ ░ ░ ▒     ░   ░ ░ ░ ░░ ░  ░   ▒      
\t\t\t               ░ ░           ░ ░  ░        ░  ░   
\tIf you encounter any issues with the code, feel free to join my Discord for support.
\t\t\t\t   https://discord.gg/HVpmQWMs8F\n\n`;

function promptQuestion() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(chalk.red(tonka));

    return new Promise((resolve, reject) => {
        rl.question(chalk.green("Use GPU? (y/n): "), (useGPU) => {
            useGPU = useGPU === 'y' || useGPU === 'Y' ? true : false;
            //console.log(useGPU);
            rl.question(chalk.green("Enter your Channel Name: "), (streamer) => {
                streamer = streamer.trim();
                rl.question(chalk.cyanBright("Enter number of browser sessions: "), (viewers) => {
                    if (!isNaN(parseInt(viewers))) {
                        resolve({ streamer, viewers: parseInt(viewers), useGPU });
                        rl.close();
                    } else {
                        console.log(chalk.red("Invalid number. Please try again."));
                        rl.question(chalk.cyanBright("Enter number of browser sessions: "), (viewers) => {
                            if (!isNaN(parseInt(viewers))) {
                                resolve({ streamer, viewers: parseInt(viewers), useGPU });
                                rl.close();
                            } else {
                                console.log(chalk.red("Invalid number. Terminating the program..."));
                                rl.close();
                                process.exit();
                            }
                        });
                    }
                });
            });
        });
    });
}

function printSummary(sessions, streamer) {
    const counts = summarizeSessions(sessions);
    console.log(`\nLatest checks for ${streamer}: ${counts.total} attempted | ${counts.playing} playing | ${counts.unverified} unverified | ${counts.blocked} blocked | ${counts.failed} failed`);
    console.log('Playing means observed video playback. Twitch-counted viewers: unknown.');
}

function promptExit(sessions, streamer) {
    printSummary(sessions, streamer);
    if (sessions.some((session) => session.submitted)) {
        console.log('Rechecking playback after each 30-second monitoring pause.');
        console.log(chalk.redBright('Press CTRL + C to close the browser and exit.'));
    } else {
        console.log('No sessions were submitted. Closing the browser.');
    }
}

module.exports = { promptQuestion, promptExit, printSummary };
