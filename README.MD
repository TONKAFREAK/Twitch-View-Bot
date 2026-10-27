## ⭐ No Proxy Needed! Please consider giving this project a star if you find it helpful. It's free and open source, and you can leave a star by clicking on the top right corner. ⭐
---
* This software uses Selenium to submit a Twitch channel URL through proxy websites and check observable browser playback. Browser sessions do not prove an increase in Twitch's viewer count.

* Each session is reported as playing, unverified, blocked, or failed, with a reason. Submitted sessions are checked again while the program remains open.

> ***⚠️ Important: Many browser tabs can use substantial RAM and CPU.***

## 📥 USAGE
---
* Node.js must be installed.


**WINDOWS**
```cmd
git clone https://github.com/TONKAFREAK/Twitch-View-Bot tonkaviewbot

cd tonkaviewbot

run.bat
```
**LINUX**
```cmd
git clone https://github.com/TONKAFREAK/Twitch-View-Bot tonkaviewbot

cd tonkaviewbot

npm i

node src/index.js
```
### Reading the session results

Each new session blocks automatic media playback before loading the page. After
submitting the channel URL, it locates the requested channel's player (including
inside frames), pauses any detected playback, and uses Selenium to click its
visible, enabled **Play** button. The playback checks run after that click.
A missing or inaccessible Play button is reported as unverified or blocked;
there is no direct `video.play()` fallback. Monitoring retries a missing button,
but does not click the Play/Pause toggle again after a successful click.

Submitting a URL is only an attempt. The console reports each browser session as:

* **Playing:** a visible player associated with the requested channel advanced
  across multiple observations over at least two seconds, with presented frames
  advancing when the browser exposes that information.
* **Unverified:** the player could not be identified or inspected, is paused or
  stalled, or is displaying a recognized advertisement.
* **Blocked:** a recognized access challenge, offline notice, or player gate is
  visible.
* **Failed:** navigation, form submission, tab access, or video playback failed.

The checker looks inside visible frames and uses the channel/player URL or
canonical page metadata to identify the requested channel. A proxy that hides
this evidence remains unverified. Page markup and ad indicators can change, so
these are conservative browser observations, not a guarantee that live stream
content is playing or that Twitch counted a viewer. Twitch's
[Get Streams API](https://dev.twitch.tv/docs/api/reference/#get-streams) exposes
an aggregate viewer count; it cannot attribute a count increase to one of these
browser sessions.

Totals reflect observed outcomes, including failures. After setup, the program
pauses for 30 seconds between monitoring passes and reports status changes.
Each pass takes additional time to inspect all submitted sessions. Identical
proxy URLs do not prove duplicate viewers and no longer cause tabs to be replaced.
Press Ctrl+C to close the browser.

Run regression tests with `npm test`. The optional browser checks use only local
fixture pages and require working Chrome setup:

```bash
node --test test/browser/playback.test.js
```

### Chrome exits immediately on Ubuntu

If startup fails with `SessionNotCreatedError`, check `chromedriver.log` in the
project directory. If it contains `No usable sandbox!`, Ubuntu's AppArmor user
namespace restrictions may be preventing Selenium's downloaded Chrome from
starting. Chrome and ChromeDriver can have matching versions and still hit this
error.

For full driver diagnostics, run `CHROMEDRIVER_VERBOSE=1 node src/index.js`.

For the default Selenium cache on Ubuntu 24.04+, run this once as your normal
user from the project directory (it requests your sudo password):

```bash
bash scripts/allow-selenium-chrome.sh
node src/index.js
```

The script validates and installs an AppArmor profile for only
`$HOME/.cache/selenium/chrome/linux64/*/chrome`. It allows Chrome to create its
sandbox, including after Selenium updates Chrome. Review the generated profile
without installing it with `bash scripts/allow-selenium-chrome.sh --print`.
The profile grants user namespace access to any executable at that path, so keep
that cache under your control. See the
[Chromium documentation](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md)
for background. Chrome's sandbox remains enabled.

## Support
---
> If have any questions feel free to join my [Discord](https://discord.gg/HVpmQWMs8F) server and ask!!

## Full disclaimer
---
This project was established to contribute to open-source collaboration and showcase the educational value of reverse engineering. Although its primary purpose is for learning and understanding, users must be aware that altering viewer metrics on platforms such as Twitch violates their Terms of Service and could lead to legal repercussions. We urge users to engage with this tool responsibly. Misuse is solely at your discretion and risk. Discussions promoting illegal activities will be promptly removed.

# TANK YOU FOR USING MY SOFTWARE! ❤

