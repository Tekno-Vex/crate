#!/bin/sh
# Installs Crate (Spicetify custom app) from the latest GitHub release.
#   curl -fsSL https://raw.githubusercontent.com/Tekno-Vex/crate/main/install.sh | sh
# Dev/testing only: CRATE_ZIP=<local zip> instead of downloading; CRATE_SKIP_APPLY=1.
set -eu

REPO="Tekno-Vex/crate"

if ! command -v spicetify >/dev/null 2>&1; then
  echo "Spicetify was not found. Install it first: https://spicetify.app" >&2
  exit 1
fi
if ! command -v unzip >/dev/null 2>&1; then
  echo "unzip is required (e.g. sudo apt install unzip)." >&2
  exit 1
fi

VERSION=$(spicetify -v | tail -n 1)
case "$VERSION" in
  2.[0-9].* | 2.[1-3][0-9].* | 2.4[0-5].*)
    echo "Spicetify $VERSION is older than 2.46 - right-click menus break on Spotify 1.3.5+." >&2
    echo "Update first: spicetify upgrade && spicetify restore backup apply" >&2
    ;;
esac

CONFIG=$(spicetify -c | tail -n 1)
DEST="$(dirname "$CONFIG")/CustomApps/crate"

ZIP="${CRATE_ZIP:-}"
TMP=""
if [ -z "$ZIP" ]; then
  TMP=$(mktemp -d)
  ZIP="$TMP/crate.zip"
  echo "Downloading Crate..."
  curl -fsSL "https://github.com/$REPO/releases/latest/download/crate.zip" -o "$ZIP"
fi
rm -rf "$DEST"
mkdir -p "$DEST"
unzip -q -o "$ZIP" -d "$DEST"
[ -n "$TMP" ] && rm -rf "$TMP"
echo "Installed to $DEST"

# Register once — custom_apps is a "|"-separated list in config-xpui.ini.
APPS=$(sed -n 's/^[[:space:]]*custom_apps[[:space:]]*=[[:space:]]*//p' "$CONFIG" | head -n 1)
case "|$(echo "$APPS" | tr -d ' ')|" in
  *"|crate|"*) ;;
  *) spicetify config custom_apps crate ;;
esac

if [ -n "${CRATE_SKIP_APPLY:-}" ]; then
  echo "Skipping spicetify apply (CRATE_SKIP_APPLY)."
  exit 0
fi
spicetify apply
echo "Done - open Crate from the top bar in Spotify."
