#!/bin/sh
# Removes Crate.
#   curl -fsSL https://raw.githubusercontent.com/Tekno-Vex/crate/main/uninstall.sh | sh
set -eu

if ! command -v spicetify >/dev/null 2>&1; then
  echo "Spicetify was not found." >&2
  exit 1
fi
CONFIG=$(spicetify -c | tail -n 1)
spicetify config custom_apps crate-
spicetify apply
rm -rf "$(dirname "$CONFIG")/CustomApps/crate"
echo "Crate removed."
