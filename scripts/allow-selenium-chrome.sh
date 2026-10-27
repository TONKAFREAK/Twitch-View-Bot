#!/usr/bin/env bash
set -euo pipefail

# Allow Selenium's downloaded Chrome to create its sandbox on Ubuntu 24.04+.
# Run as your normal user; only installing/loading the profile needs sudo.
if [[ $(id -u) == 0 ]]; then
    echo 'Run this script as your normal user, without sudo.' >&2
    exit 1
fi

if [[ ! -x /usr/sbin/apparmor_parser || ! -d /etc/apparmor.d ]]; then
    echo 'This fix requires an Ubuntu system with AppArmor installed.' >&2
    exit 1
fi

chrome_cache="$HOME/.cache/selenium/chrome/linux64"
if [[ ! -d "$chrome_cache" ]]; then
    echo "Selenium Chrome cache not found: $chrome_cache" >&2
    exit 1
fi

# Do not interpret special AppArmor pattern characters in the home directory.
case "$HOME" in
    *\"*|*\\*|*\**|*\?*|*\[*|*\]*|*\{*|*\}*|*$'\n'*)
        echo 'Unsupported characters in the home directory path.' >&2
        exit 1
        ;;
esac

profile_name="selenium-chrome-$(id -u)"
profile_file=$(mktemp)
trap 'rm -f "$profile_file"' EXIT
cat > "$profile_file" <<EOF
abi <abi/4.0>,
include <tunables/global>

profile $profile_name "$chrome_cache/*/chrome" flags=(unconfined) {
    userns,
}
EOF

# Validate before requesting administrator access or changing system policy.
/usr/sbin/apparmor_parser --skip-kernel-load --skip-cache "$profile_file"
cat "$profile_file"
if [[ "${1:-}" == '--print' ]]; then
    exit 0
fi

sudo install -o root -g root -m 644 "$profile_file" "/etc/apparmor.d/$profile_name"
sudo /usr/sbin/apparmor_parser --replace "/etc/apparmor.d/$profile_name"
echo 'Chrome sandbox profile installed. Retry node src/index.js.'
