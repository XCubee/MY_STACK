# Start the Expo Go server on EC2 without SSH

This setup uses EC2 User Data for first-time installation and a systemd
service for every later instance start. It requires **no SSH key, inbound SSH
rule, or SSH client**. The Expo tunnel connects outbound, so do not open port
8081 or add a public inbound rule.

## 1. Prepare and upload the app ZIP

From PowerShell in `expo-client/`, create a source-only deployment ZIP:

```powershell
.\deploy\package-ec2.ps1
```

The script creates `my-stack-expo-client.zip` in the parent folder. It omits
`node_modules`, Expo caches, local `.env` files, and generated build state.

In the AWS Console:

1. Create a private S3 bucket in the region where you will create the instance.
2. Keep Block Public Access enabled.
3. Upload `my-stack-expo-client.zip` to the bucket root. Do not make the object
   public.

## 2. Make the Expo login token available safely

The Expo Go app and Expo CLI must be signed in to the same Expo account. The
EC2 server is headless, so it authenticates with an Expo access token:

1. Sign in to your Expo account and create an access token in the Expo account
   settings.
2. In AWS Systems Manager > Parameter Store, create a **SecureString**
   parameter named `/my-stack/expo-token`. Paste the token directly into the
   AWS console. Never put it in the app ZIP, Git, EC2 User Data, or this chat.
3. Do not give out this token; rotate/revoke it if it is exposed.
4. Add SecureString parameters `/my-stack/supabase-url` and
   `/my-stack/supabase-publishable-key` containing the Supabase project URL and
   publishable key. These are needed for account sign-in and cloud sync. Do not
   use a `service_role` or secret key in this mobile app.

## 3. Create a no-SSH EC2 role

Create an EC2 IAM role with:

- `AmazonSSMManagedInstanceCore`, so Systems Manager can manage the instance.
- This custom least-privilege policy, with the bucket, region, and account ID
  replaced by yours:

  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::YOUR_BUCKET/my-stack-expo-client.zip"
      },
      {
        "Effect": "Allow",
        "Action": "ssm:GetParameter",
        "Resource": [
          "arn:aws:ssm:YOUR_REGION:YOUR_ACCOUNT_ID:parameter/my-stack/expo-token",
          "arn:aws:ssm:YOUR_REGION:YOUR_ACCOUNT_ID:parameter/my-stack/supabase-url",
          "arn:aws:ssm:YOUR_REGION:YOUR_ACCOUNT_ID:parameter/my-stack/supabase-publishable-key"
        ]
      }
    ]
  }
  ```

Use the role as the instance profile. The token parameter uses the AWS-managed
SSM key; if you choose a customer-managed KMS key, also grant the role
`kms:Decrypt` on that one key.

## 4. Launch the instance

1. Launch Ubuntu Server 24.04 LTS, 64-bit x86, in the same region as the S3
   bucket. A `t3.medium` (2 vCPU, 4 GiB RAM) is a practical starting size for
   Metro. Attach the IAM role above.
2. Do not create or use an SSH key pair. Do not add an inbound SSH rule.
3. Ensure the instance can reach the internet outbound over HTTPS (for S3,
   Systems Manager, NodeSource, npm, and the Expo tunnel). A public subnet with
   outbound internet access is the simplest beginner setup; inbound ports
   remain closed.
4. In Advanced details > User data, paste the contents of
   `ec2-user-data.sh`. Change `REPLACE_WITH_YOUR_S3_BUCKET` to the bucket name.
   Keep the object key and parameter name unchanged if you used the defaults.
5. Launch and wait for both EC2 status checks to pass and for the instance to
   appear as **Online** in Systems Manager Fleet Manager.

On first boot, User Data installs Node.js 22, downloads the ZIP using the
instance role, installs dependencies, obtains the Expo token and Supabase
client settings from Parameter Store, and enables `my-stack-expo.service`. The
systemd service starts automatically after every subsequent Start operation.

## 5. Get the current Expo Go link without SSH

In AWS Console > Systems Manager > Run Command:

1. Run command document `AWS-RunShellScript`.
2. Select the managed EC2 instance as the target.
3. Run this command:

   ```sh
   journalctl -u my-stack-expo.service -n 100 --no-pager
   ```

4. Open the current `exp://...` or `https://...exp.direct` development link in
   Expo Go. Sign in to Expo Go first if it asks.

Expo tunnel addresses may change whenever the tunnel restarts. Retrieve the
current link from the service log after each EC2 Start. The instance must stay
running while you use the app; stopping it stops the Expo server and its
tunnel. The EC2 instance can still incur storage charges while stopped, and
incurs compute charges while running.

## Updating the code

Run `package-ec2.ps1` again, upload the replacement ZIP to the same private S3
object, then in Systems Manager Run Command execute:

```sh
aws s3 cp s3://YOUR_BUCKET/my-stack-expo-client.zip /tmp/my-stack-expo-client.zip
systemctl stop my-stack-expo.service
rm -r /opt/my-stack/expo-client
unzip -oq /tmp/my-stack-expo-client.zip -d /opt/my-stack
rm -f /tmp/my-stack-expo-client.zip
chown -R expo:expo /opt/my-stack
runuser -u expo -- bash -lc "cd /opt/my-stack/expo-client && npm ci"
systemctl start my-stack-expo.service
```

Select the same AWS region in Systems Manager as the S3 bucket. Never include
the Expo access token in update commands or the ZIP.

This is an Expo **development** server for a few testers, not an always-on
production distribution service. Expo Go is required; native builds, App
Store/Play Store submission, and production hosting are not configured here.
