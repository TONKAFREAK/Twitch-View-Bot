const { exec } = require('child_process');

exec('chromedriver --version', (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
    }
    console.log(`Chromedriver version: ${stdout}`);
});
