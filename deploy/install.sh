#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo 'Run with sudo from /var/www/live.asem.work'; exit 1; fi
cd /var/www/live.asem.work
node_path=$(command -v node || true)
if [ -z "$node_path" ]; then echo 'Install Node.js 24 LTS system-wide first.'; exit 1; fi
"$node_path" -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)' || { echo 'Node.js 24 or newer is required.'; exit 1; }
case "$node_path" in /root/*|/home/*) echo 'Use a system-wide Node install, not nvm under a home directory.'; exit 1;; esac
command -v nginx >/dev/null || { echo 'Install Nginx first.'; exit 1; }
if [ -e /etc/nginx/sites-available/live.asem.work ] || [ -e /etc/systemd/system/livelayer.service ]; then
 echo 'Configuration already exists. Review/update it manually; existing configuration was not overwritten.'; exit 1
fi
id livelayer >/dev/null 2>&1 || useradd --system --home /var/lib/livelayer --shell /usr/sbin/nologin livelayer
install -d -m 700 -o livelayer -g livelayer /var/lib/livelayer
find public server -type d -exec chmod 755 {} +
find public server -type f -exec chmod 644 {} +
# Source and static assets stay read-only to the service; only /var/lib/livelayer is writable.
sed "s|/usr/local/bin/node|$node_path|" deploy/livelayer.service > /etc/systemd/system/livelayer.service
install -m 644 deploy/nginx.conf /etc/nginx/sites-available/live.asem.work
ln -s /etc/nginx/sites-available/live.asem.work /etc/nginx/sites-enabled/live.asem.work
if ! nginx -t; then
 rm /etc/nginx/sites-enabled/live.asem.work
 echo 'Nginx validation failed. Live configuration was not reloaded. Fix sites-available/live.asem.work before enabling.'
 exit 1
fi
systemctl daemon-reload
systemctl enable --now livelayer
systemctl reload nginx
echo 'Installed. Complete HTTPS using Certbot before testing the meeting form.'
