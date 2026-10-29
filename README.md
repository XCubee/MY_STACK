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
```

Keep the development server running while using Expo Go. Tunnel mode makes the
Metro bundle reachable without opening the Metro port to the public internet;
the development machine still needs working outbound internet access.

To have the development server start each time an EC2 instance starts, without
SSH, see [the EC2 Systems Manager deployment guide](deploy/README.md).

## Supabase accounts and cloud sync

Without Supabase settings, the app remains in local-only mode. To enable
accounts and private cloud sync:

1. In the Supabase SQL Editor, run [`supabase-auth-setup.sql`](./supabase-auth-setup.sql).
   It creates the user profile table and replaces the `profiles` and `tools`
   policies with owner-only Row Level Security rules.
2. Copy `.env.example` to `.env` and set the Supabase project URL and
   **publishable** key. Restart Expo after editing `.env`.
3. In Supabase Auth, enable email/password sign-in and configure Google and
   Apple providers with their credentials. Provider secrets belong in
   Supabase, never in the app.
4. Add `mystack://auth/callback` to Supabase Auth's allowed redirect URLs.
   Add the same callback to the redirect URL settings for email confirmation.
5. Use a development build or a standalone app for OAuth callbacks. Expo Go
   remains available for local-only testing but does not use the app's custom
   scheme for provider sign-in.

Only use the publishable/legacy anon key. Never put a database password or
service-role key in the mobile app. A new signed-in user completes a four-step
profile setup once; completed profiles skip onboarding on later sign-ins.
Tool data and its on-device cache are separated by Supabase user ID. The
existing shared on-device list is not assigned to the first account and
remains available only in local-only mode; data in an older anonymous cloud
session remains attached to that anonymous identity.

## Subscription renewal reminders

Run [`supabase-subscriptions-setup.sql`](./supabase-subscriptions-setup.sql)
in the Supabase SQL Editor to create the user-private subscriptions table.
The detailed steps and reminder limitations are in
[`SUPABASE_REMINDERS_SETUP.txt`](./SUPABASE_REMINDERS_SETUP.txt). Renewal
reminders are local notifications scheduled on each device; they are not a
server-side guarantee and do not cancel a subscription.

## Learning, referrals, and shared workspace schema

The additive schema foundation is in
[`supabase-workspace-setup.sql`](./supabase-workspace-setup.sql). When the
workspace modules are available in the app, run the setup files in this order
from the Supabase SQL Editor:

1. [`supabase-auth-setup.sql`](./supabase-auth-setup.sql)
2. [`supabase-subscriptions-setup.sql`](./supabase-subscriptions-setup.sql)
3. [`supabase-workspace-setup.sql`](./supabase-workspace-setup.sql)

The workspace script depends on the existing `public.tools` and
`public.subscriptions` tables. It adds user-owned tables with explicit grants
and Row Level Security, and does not modify or delete existing records. Running
the SQL creates database tables only; the app screens and data services must
also be present before these modules become usable.

## Checks

```sh
npm run lint
npm run typecheck
npx expo-doctor
```

This setup is for functional testing with a few people, not a production
release. Each named account has its own library; sign out in Settings to use a
different account on the same device.
