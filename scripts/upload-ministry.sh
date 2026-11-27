#!/usr/bin/env bash
# admin-panel/scripts/upload-ministry.sh
# Uploads build/ to <FTP_ROOT>/<MINISTRY>/ over encrypted FTP (FTPS).
# Mirrors the folder: new files added, changed replaced, files the new build
# no longer has removed — ONLY inside that ministry's folder.
# Env: FTP_HOST FTP_USERNAME FTP_PASSWORD MINISTRY [FTP_ROOT=/] [FTP_INSECURE=1 tests only]
set -euo pipefail

# Safety: a valid folder name, never empty — an empty name would mirror into
# the root and remove the sales page.
if ! [[ "${MINISTRY:-}" =~ ^[a-z0-9][a-z0-9-]{1,39}$ ]]; then
  echo "✗ Refusing to upload: invalid ministry folder name '${MINISTRY:-}'" >&2
  exit 1
fi
case "$MINISTRY" in
  api|leads|private|cgi-bin|content|static|assets|admin|www|mail)
    echo "✗ Refusing to upload: '$MINISTRY' is reserved" >&2; exit 1 ;;
esac
for v in FTP_HOST FTP_USERNAME FTP_PASSWORD; do
  if [ -z "${!v:-}" ]; then echo "✗ Missing secret $v (Settings › Secrets and variables › Actions)" >&2; exit 1; fi
done
[ -f build/index.html ] || { echo "✗ No build/index.html — the build failed?" >&2; exit 1; }

ROOT="${FTP_ROOT:-/}"
TARGET="${ROOT%/}/$MINISTRY/"
VERIFY="yes"; [ "${FTP_INSECURE:-}" = "1" ] && VERIFY="no"

command -v lftp >/dev/null || { sudo apt-get update -qq && sudo apt-get install -y -qq lftp; }

LFTP_SETUP="set cmd:fail-exit true; set net:max-retries 3; set net:timeout 30;
set ftp:ssl-force true; set ftp:ssl-protect-data true; set ssl:verify-certificate $VERIFY;
open -u \"$FTP_USERNAME\",\"$FTP_PASSWORD\" \"$FTP_HOST\";"

echo "Uploading build/ → $FTP_HOST$TARGET"
lftp -c "$LFTP_SETUP
mkdir -p -f \"$TARGET\";
mirror --reverse --delete --parallel=2 --no-perms --exclude-glob '*.map' build/ \"$TARGET\";"

# Verify: every file on the server must have exactly the size of the build's
# file. A cut-off upload is re-sent (twice at most); if it still differs the
# deploy FAILS, so a half-uploaded site is never reported as done.
check() {
  lftp -c "$LFTP_SETUP
mirror --reverse --dry-run --ignore-time --no-perms --exclude-glob '*.map' build/ \"$TARGET\";" 2>&1 \
    | grep -E "^(get|put) " \
    | sed -E 's#//[^/@]*@#//#g; s#ftp://[^ ]*/##g; s#file:[^ ]*/build/#build/#g' || true
  # (only files still to send; addresses and passwords removed from the text)
}
for attempt in 1 2 3; do
  PENDING="$(check)"
  if [ -z "$PENDING" ]; then
    echo "✓ Verified: every file on the server matches the build"
    echo "✓ https://tv.nolimitsmedia.com/$MINISTRY/ updated"
    exit 0
  fi
  echo "! $(echo "$PENDING" | wc -l) file(s) differ on the server — re-sending (attempt $attempt)"
  [ "$attempt" -lt 3 ] && lftp -c "$LFTP_SETUP
mirror --reverse --ignore-time --no-perms --parallel=1 --exclude-glob '*.map' build/ \"$TARGET\";"
done
echo "✗ Upload could not be verified; these files still differ:" >&2
echo "$PENDING" >&2
exit 1
