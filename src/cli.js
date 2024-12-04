const readline = require('readline');
const chalk = require('chalk');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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
    console.log(chalk.red(tonka));

    return new Promise((resolve, reject) => {
        rl.question(chalk.green("Use GPU? (y/n): "), (useGPU) => {
            useGPU = useGPU === 'y' || useGPU === 'Y' ? true : false;
            rl.question(chalk.green("Enter your Channel Name: "), (streamer) => {
                rl.question(chalk.cyanBright("Enter number of viewers: "), (viewers) => {
                    if (!isNaN(parseInt(viewers))) {
                        resolve({ streamer, viewers: parseInt(viewers), useGPU });
                        rl.close();
                    } else {
                        console.log(chalk.red("Invalid number. Please try again."));
                        rl.question(chalk.cyanBright("Enter number of viewers: "), (viewers) => {
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

function promptExit(viewers, streamer) {
    console.log(chalk.greenBright("\nSent "+viewers+" view(s) to "+streamer+"!"));
    console.log(chalk.greenBright("Keep this console open to maintain the viewers!"));
    console.log(chalk.redBright("Press \"CTRL + C\" to exit or just close the console."));
    console.log(chalk.yellow("Dont forget to star the repo! https://github.com/TONKAFREAK/Twitch-View-Bot"));
}

module.exports = { promptQuestion, promptExit };