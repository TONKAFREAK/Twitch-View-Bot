const chalk = require("chalk");
const { setTimeout: delay } = require("node:timers/promises");
const { promptQuestion, promptExit, printSummary } = require("./cli");
const setupDriver = require("./setupDriver");
const { openSession, refreshSession } = require("./sessions");

const proxySites = [
  "https://proxyium.com/",
  "https://www.croxyproxy.com/",
  "https://www.blockaway.net/",
  "https://www.croxyproxy.rocks",
  "https://www.croxy.org",
  "https://www.croxy.network",
  "https://www.croxyproxy.net",
];

function printSession(session) {
  const color = session.status === "playing" ? chalk.green
    : session.status === "failed" ? chalk.red : chalk.yellow;
  console.log(color(`Session ${session.id}: ${session.status.toUpperCase()} — ${session.reason} (${session.proxySite})`));
}

async function main() {
  const data = await promptQuestion();
  let driver;
  let closing;
  let stopping = false;
  const abort = new AbortController();
  const closeDriver = () => {
    if (driver && !closing) closing = driver.quit();
    return closing;
  };
  const stop = () => {
    stopping = true;
    abort.abort();
    console.log(chalk.yellow("\nClosing browser sessions..."));
    // Interrupt an in-flight navigation as well as the monitoring delay.
    closeDriver()?.catch(() => {});
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    console.log(chalk.greenBright("Setting up driver..."));
    driver = await setupDriver(data.useGPU);
    await driver.manage().setTimeouts({ pageLoad: 30000, script: 5000 });
    console.log(`Opening ${data.viewers} browser session(s) for ${data.streamer}.`);
    console.log("Playback checks do not confirm that Twitch counted a viewer.");
    const sessions = [];
    for (let i = 1; i <= data.viewers && !stopping; i++) {
      console.log(chalk.blue(`\nStarting session ${i}/${data.viewers}...`));
      const session = await openSession(driver, {
        id: i,
        proxySite: proxySites[(i - 1) % proxySites.length],
        channel: data.streamer,
      });
      sessions.push(session);
      if (!stopping) printSession(session);
    }
    if (stopping) return;
    promptExit(sessions, data.streamer);
    if (!sessions.some((session) => session.submitted)) return;

    while (!stopping) {
      await delay(30000, undefined, { signal: abort.signal });
      for (const session of sessions) {
        if (stopping) break;
        const previous = `${session.status}:${session.reason}`;
        await refreshSession(driver, session, data.streamer);
        if (!stopping && previous !== `${session.status}:${session.reason}`) printSession(session);
      }
      if (!stopping) printSummary(sessions, data.streamer);
    }
  } catch (err) {
    if (!stopping) throw err;
  } finally {
    try {
      await closeDriver();
    } finally {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red(error.message));
    process.exitCode = 1;
  });
}

module.exports = { main };

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
