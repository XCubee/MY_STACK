#!/bin/bash
set -euo pipefail

APP_BUCKET="REPLACE_WITH_YOUR_S3_BUCKET"
APP_OBJECT="my-stack-expo-client.zip"
EXPO_TOKEN_PARAMETER="/my-stack/expo-token"
APP_DIR="/opt/my-stack"

if [[ "$APP_BUCKET" == "REPLACE_WITH_YOUR_S3_BUCKET" ]]; then
  echo "Set APP_BUCKET in EC2 user data before launching the instance." >&2
  exit 1
fi

REGION="$(curl --fail --silent --show-error --retry 5 --retry-delay 2 \
  -X PUT http://169.254.169.254/latest/api/token \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600' \
  | xargs -I '{}' curl --fail --silent --show-error --retry 5 --retry-delay 2 \
    -H "X-aws-ec2-metadata-token: {}" \
    http://169.254.169.254/latest/meta-data/placement/region)"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg unzip awscli

install -d -m 0755 /etc/apt/keyrings
curl --fail --silent --show-error --location https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
chmod 0644 /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
  > /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs

node --version
npm --version

useradd --system --create-home --home-dir /home/expo --shell /usr/sbin/nologin expo
install -d -o expo -g expo -m 0750 "$APP_DIR"
aws s3 cp "s3://${APP_BUCKET}/${APP_OBJECT}" /tmp/my-stack-expo-client.zip --region "$REGION"
unzip -oq /tmp/my-stack-expo-client.zip -d "$APP_DIR"
rm -f /tmp/my-stack-expo-client.zip
chown -R expo:expo "$APP_DIR"

EXPO_TOKEN="$(aws ssm get-parameter \
  --name "$EXPO_TOKEN_PARAMETER" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text \
  --region "$REGION")"
if [[ -z "$EXPO_TOKEN" || "$EXPO_TOKEN" == "None" ]]; then
  echo "Expo token parameter is missing or empty: $EXPO_TOKEN_PARAMETER" >&2
  exit 1
fi
printf 'EXPO_TOKEN=%s\n' "$EXPO_TOKEN" > /etc/my-stack-expo.env
chmod 0600 /etc/my-stack-expo.env
unset EXPO_TOKEN

runuser -u expo -- bash -lc "cd '${APP_DIR}/expo-client' && npm ci"

cat > /etc/systemd/system/my-stack-expo.service <<'UNIT'
[Unit]
Description=My Stack Expo Go development server
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=expo
Group=expo
WorkingDirectory=/opt/my-stack/expo-client
EnvironmentFile=/etc/my-stack-expo.env
Environment=CI=1
Environment=EXPO_NO_TELEMETRY=1
ExecStart=/usr/bin/npm run start:tunnel -- --go
Restart=always
RestartSec=10
KillSignal=SIGINT
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now my-stack-expo.service
systemctl --no-pager --full status my-stack-expo.service || true
