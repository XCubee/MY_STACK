# My Stack for Expo Go

This React Native app is a phone-friendly port of My Stack. It runs in Expo Go
for a small 1–5 person test group and keeps the Flutter app alongside it.
The interface groups tools by category and uses distinct restrained gradients
for each group, alongside a charcoal/neutral base, gold favorites, haptic
touch feedback, animated loading and card borders, and native iOS transitions.
The Monitoring category uses a cool, near-white gradient; AI tools use a warm
amber gradient.

## Requirements

- Node.js 20.19.4 or newer on a supported release line (22.13+ recommended)
- Expo Go installed on the iPhone or Android phone
- A computer on the same Wi-Fi for LAN mode, or a reachable internet connection
  for tunnel mode

## Start on a phone

From this folder:

```sh
npm install
npm start
```

Open Expo Go on the phone and scan the QR code. For different networks or a
remote development machine, start an Expo tunnel instead:

```sh
npm run start:tunnel
```

Keep the development server running while using Expo Go. Tunnel mode makes the
Metro bundle reachable without opening the Metro port to the public internet;
the development machine still needs working outbound internet access.

To have the development server start each time an EC2 instance starts, without
SSH, see [the EC2 Systems Manager deployment guide](deploy/README.md).

## Optional Supabase sync

Without Supabase settings, all library features work locally on the device.
To enable private cloud sync, copy `.env.example` to `.env`, fill in the
Supabase project URL and **publishable** key, enable Anonymous Sign-Ins, and
apply the SQL in `../supabase.text`. Restart Expo after editing `.env`.

Only use the publishable/legacy anon key. Never put a database password or
service-role key in the mobile app. Keep Row Level Security enabled. The
anonymous identity is specific to that installation and cannot be recovered
after app data is cleared or the app is reinstalled.

## Checks

```sh
npm run typecheck
npx expo-doctor
```

This setup is for functional testing with a few people, not a production
release. Each install receives its own anonymous account, so testers do not
share one library unless named sign-in and account linking are added later.
