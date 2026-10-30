# My Stack 

This React Native app is a phone-friendly port of My Stack. It runs in Expo Go
for a small 1–5 person test group and keeps the Flutter app alongside it.
The interface groups tools by category and uses distinct restrained gradients
for each group, alongside a charcoal/neutral base, gold favorites, haptic
touch feedback, animated loading and card borders, and native iOS transitions.
The Monitoring category uses a cool, near-white gradient; AI tools use a warm
amber gradient.

## Requirements

- Node.js 20.19.4 or newer on a supported release line (22.13+ recommended)
- Expo Go for local-only use, or a development build / standalone app for
  Supabase sign-in
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
OR
npx expo start
```

Keep the development server running while using Expo Go. Tunnel mode makes the
Metro bundle reachable without opening the Metro port to the public internet;
the development machine still needs working outbound internet access.

To have the development server start each time an EC2 instance starts





