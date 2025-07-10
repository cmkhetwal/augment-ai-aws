# SAML Quick Setup Guide

## Current Status ✅

Your SAML configuration is **90% complete**. Only the certificate needs to be added.

## What's Already Done

✅ **Authentik Configuration**: SAML provider configured at `auth.bamko.net`  
✅ **Application .env**: SAML settings added to environment file  
✅ **URLs Configured**: All SAML endpoints properly set  

## What You Need to Do

### Step 1: Get SAML Certificate (Required)

**Option A: From Authentik Admin (Recommended)**
1. Go to `https://auth.bamko.net` (admin login)
2. Navigate to **System** → **Certificates**
3. Find your SAML certificate
4. Copy the certificate content (including BEGIN/END lines)

**Option B: From Command Line**
```bash
ssh -i devsecops.pem ubuntu@44.211.172.150
curl -s https://auth.bamko.net/application/saml/internal-monitoring-app/metadata/
```

### Step 2: Update .env File

```bash
# SSH to your server
ssh -i devsecops.pem ubuntu@44.211.172.150
cd /home/ubuntu/augment-ai-aws

# Edit the .env file
nano .env

# Find this line:
SAML_CERT=PLACEHOLDER_FOR_CERTIFICATE

# Replace with your actual certificate:
SAML_CERT=-----BEGIN CERTIFICATE-----
MIICXjCCAcegAwIBAgIJAL...
(your certificate content here)
-----END CERTIFICATE-----
```

### Step 3: Deploy Changes

```bash
# Deploy the updated configuration
./deploy-stack.sh

# Verify deployment
docker stack ps aws-monitor
```

### Step 4: Test SAML Login

1. Open browser: `http://44.211.172.150`
2. Click **SAML Login** or **SSO Login**
3. Login with your Authentik credentials
4. Should redirect back to dashboard

## Configuration Summary

| Setting | Value |
|---------|-------|
| **Authentik URL** | `https://auth.bamko.net` |
| **App URL** | `http://44.211.172.150` |
| **SAML Provider** | `internal-monitoring-app` |
| **Callback URL** | `http://44.211.172.150:3001/api/auth/saml/callback` |

## Current .env SAML Settings

```env
SAML_ENTRY_POINT=https://auth.bamko.net/application/saml/internal-monitoring-app/sso/binding/redirect/
SAML_ISSUER=internal-monitoring-app
SAML_CALLBACK_URL=http://44.211.172.150:3001/api/auth/saml/callback
SAML_CERT=PLACEHOLDER_FOR_CERTIFICATE  # ← Replace this
SAML_IDENTIFIER_FORMAT=urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
SAML_LOGOUT_URL=https://auth.bamko.net/application/saml/internal-monitoring-app/slo/binding/redirect/
SAML_LOGOUT_CALLBACK_URL=http://44.211.172.150:3001/api/auth/saml/logout/callback
```

## Troubleshooting

**If SAML login doesn't work:**

1. **Check logs:**
   ```bash
   docker service logs aws-monitor_backend --tail 50
   ```

2. **Verify certificate format:**
   ```bash
   grep -A 10 "SAML_CERT" .env
   ```

3. **Test metadata endpoint:**
   ```bash
   curl http://44.211.172.150:3001/api/auth/saml/metadata
   ```

## Need Help?

- Check the detailed guide: `SAML-AUTHENTIK-SETUP.md`
- Review application logs for specific error messages
- Verify Authentik configuration matches the URLs above

---

**Next Step**: Get the certificate and replace `PLACEHOLDER_FOR_CERTIFICATE` in your `.env` file!
