# SAML Integration with Authentik (auth.bamko.net)

This guide explains how to configure SAML authentication between your AWS Monitor application and your Authentik instance at `auth.bamko.net`.

## Prerequisites

1. Running Authentik instance at `https://auth.bamko.net`
2. AWS Monitor application deployed and accessible at `http://44.211.172.150`
3. Admin access to both systems

## Current Configuration Status

✅ **Authentik SAML Provider**: Already configured as `internal-monitoring-app`
✅ **SAML URLs**: Provided and configured
⚠️ **Application .env**: Partially configured (certificate needed)
❌ **Testing**: Pending certificate configuration

## Step 1: Verify Authentik Configuration

Your Authentik instance should already have the SAML provider configured with these details:

**SAML Provider Details:**
- **Entity ID/Issuer**: `https://auth.bamko.net/application/saml/internal-monitoring-app/metadata/`
- **SSO URL (Redirect)**: `https://auth.bamko.net/application/saml/internal-monitoring-app/sso/binding/redirect/`
- **SSO URL (Post)**: `https://auth.bamko.net/application/saml/internal-monitoring-app/sso/binding/post/`
- **SLO URL (Redirect)**: `https://auth.bamko.net/application/saml/internal-monitoring-app/slo/binding/redirect/`
- **SLO URL (Post)**: `https://auth.bamko.net/application/saml/internal-monitoring-app/slo/binding/post/`

### 1.1 Verify SAML Provider Settings

1. Log into your Authentik admin interface at `https://auth.bamko.net`
2. Go to **Applications** → **Providers**
3. Find the `internal-monitoring-app` SAML provider
4. Verify these settings:

**Protocol Settings:**
- **ACS URL**: `http://44.211.172.150:3001/api/auth/saml/callback`
- **Issuer**: `internal-monitoring-app`
- **Service Provider Binding**: `Post`
- **Audience**: `internal-monitoring-app`

### 1.2 Verify Application Settings

1. Go to **Applications** → **Applications**
2. Find the `Internal Monitoring App` application
3. Verify:
   - **Name**: `Internal Monitoring App`
   - **Slug**: `internal-monitoring-app`
   - **Provider**: The SAML provider created above
   - **Launch URL**: `http://44.211.172.150`

## Step 2: Configure AWS Monitor Application (.env file)

### 2.1 Current Configuration Status

✅ **SAML configuration has been added to your `.env` file** with the following settings:

```env
# SAML Configuration for Authentik Integration
SAML_ENTRY_POINT=https://auth.bamko.net/application/saml/internal-monitoring-app/sso/binding/redirect/
SAML_ISSUER=internal-monitoring-app
SAML_CALLBACK_URL=http://44.211.172.150:3001/api/auth/saml/callback
SAML_CERT=PLACEHOLDER_FOR_CERTIFICATE
SAML_IDENTIFIER_FORMAT=urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress

# SAML Additional Configuration (Optional)
SAML_LOGOUT_URL=https://auth.bamko.net/application/saml/internal-monitoring-app/slo/binding/redirect/
SAML_LOGOUT_CALLBACK_URL=http://44.211.172.150:3001/api/auth/saml/logout/callback
```

### 2.2 ⚠️ REQUIRED: Get and Configure SAML Certificate

**You need to replace `PLACEHOLDER_FOR_CERTIFICATE` with the actual certificate from Authentik.**

#### Option A: From Authentik Admin Interface (Recommended)

1. Log into your Authentik admin interface at `https://auth.bamko.net`
2. Go to **System** → **Certificates**
3. Find the certificate used for your SAML provider
4. Click **Download Certificate** or copy the certificate content
5. The certificate should look like:
   ```
   -----BEGIN CERTIFICATE-----
   MIICXjCCAcegAwIBAgIJAL...
   (certificate content)
   -----END CERTIFICATE-----
   ```

#### Option B: From Metadata URL

1. Access the metadata URL: `https://auth.bamko.net/application/saml/internal-monitoring-app/metadata/`
2. Look for the `<X509Certificate>` tag in the XML
3. Copy the certificate content between the tags
4. Add the BEGIN/END certificate headers

#### Option C: Using Command Line

```bash
# SSH to your EC2 instance
ssh -i devsecops.pem ubuntu@44.211.172.150

# Try to extract certificate from metadata
curl -s https://auth.bamko.net/application/saml/internal-monitoring-app/metadata/ | \
  grep -o '<X509Certificate>[^<]*</X509Certificate>' | \
  sed 's/<X509Certificate>/-----BEGIN CERTIFICATE-----\n/g' | \
  sed 's/<\/X509Certificate>/\n-----END CERTIFICATE-----/g'
```

### 2.3 Update the Certificate in .env

Once you have the certificate, update your `.env` file:

```bash
# SSH to your EC2 instance
ssh -i devsecops.pem ubuntu@44.211.172.150
cd /home/ubuntu/augment-ai-aws

# Edit the .env file
nano .env

# Replace PLACEHOLDER_FOR_CERTIFICATE with your actual certificate
# Make sure to include the -----BEGIN CERTIFICATE----- and -----END CERTIFICATE----- lines
```

## Step 3: Deploy Updated Configuration

### 3.1 Rebuild and Deploy

After updating the certificate in your `.env` file, deploy the changes:

```bash
# SSH to your EC2 instance
ssh -i devsecops.pem ubuntu@44.211.172.150
cd /home/ubuntu/augment-ai-aws

# Deploy the updated configuration
./deploy-stack.sh
```

### 3.2 Verify Deployment

Check that the services are running with the new configuration:

```bash
# Check stack status
docker stack ps aws-monitor

# Verify SAML configuration is loaded
docker service logs aws-monitor_backend --tail 20

# Test SAML metadata endpoint
curl http://44.211.172.150:3001/api/auth/saml/metadata
```

## Step 4: Test SAML Authentication

### 4.1 Access SAML Login

1. Open your browser and go to `http://44.211.172.150`
2. Look for **SAML Login** or **SSO Login** button
3. Click it to initiate SAML authentication
4. You should be redirected to `https://auth.bamko.net` login page

### 4.2 Complete Authentication Flow

1. Enter your Authentik credentials at `auth.bamko.net`
2. Grant consent if prompted by Authentik
3. You should be redirected back to `http://44.211.172.150`
4. You should now be logged into the AWS Monitor dashboard

### 4.3 Verify User Creation

After successful login, verify that the user was created:

```bash
# Check application logs for user creation
docker service logs aws-monitor_backend --tail 50 | grep -i "saml\|user"
```

## Step 5: User Management

### 5.1 User Attributes Mapping

The application expects these SAML attributes:
- **Email**: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`
- **First Name**: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname`
- **Last Name**: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname`
- **Username**: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name`

### 5.2 Role Mapping

Configure role mapping in Authentik:
1. Create groups in Authentik: `aws-monitor-admin`, `aws-monitor-user`
2. Add users to appropriate groups
3. Configure group mapping in the SAML provider

## Troubleshooting

### Common Issues

1. **"Configuration validation failed"**
   - Check that all required environment variables are set
   - Verify certificate format (no extra spaces/characters)
   - Ensure SAML_ENTRY_POINT URL is correct

2. **"SAML authentication error"**
   - Check Authentik logs for detailed error messages
   - Verify ACS URL matches exactly
   - Check certificate validity

3. **"Invalid state parameter"**
   - Clear browser cache and cookies
   - Check system time synchronization
   - Verify callback URL configuration

### Debug Steps

1. **Check Application Logs**:
   ```bash
   docker service logs aws-monitor_backend --tail 50
   ```

2. **Test SAML Metadata**:
   ```bash
   curl http://44.211.172.150:3001/api/auth/saml/metadata
   ```

3. **Verify Environment Variables**:
   ```bash
   docker exec $(docker ps -q -f name=aws-monitor_backend) env | grep SAML
   ```

4. **Test Authentik Metadata**:
   ```bash
   curl -s https://auth.bamko.net/application/saml/internal-monitoring-app/metadata/
   ```

5. **Check Certificate Format**:
   ```bash
   # Verify certificate in .env file
   grep -A 20 "SAML_CERT" /home/ubuntu/augment-ai-aws/.env
   ```

## Security Considerations

1. **Use HTTPS in Production**: Replace HTTP URLs with HTTPS
2. **Certificate Management**: Regularly rotate SAML certificates
3. **Network Security**: Restrict access to SAML endpoints
4. **Audit Logging**: Enable audit logs in both systems

## Advanced Configuration

### Custom Attribute Mapping

To customize attribute mapping, update the SAML service configuration:

```javascript
// In backend/services/samlAuthService.js
const attributeMapping = {
  email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  username: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
};
```

### Multiple Identity Providers

To support multiple SAML providers, configure additional environment variables:

```env
SAML_PROVIDER_2_ENTRY_POINT=https://another-idp.com/sso
SAML_PROVIDER_2_CERT=...
```

## Quick Reference

### Current Configuration Summary

| Setting | Value |
|---------|-------|
| **Authentik Domain** | `https://auth.bamko.net` |
| **Application URL** | `http://44.211.172.150` |
| **SAML Entry Point** | `https://auth.bamko.net/application/saml/internal-monitoring-app/sso/binding/redirect/` |
| **SAML Issuer** | `internal-monitoring-app` |
| **Callback URL** | `http://44.211.172.150:3001/api/auth/saml/callback` |
| **Logout URL** | `https://auth.bamko.net/application/saml/internal-monitoring-app/slo/binding/redirect/` |
| **Metadata URL** | `https://auth.bamko.net/application/saml/internal-monitoring-app/metadata/` |

### Environment Variables Added to .env

```env
SAML_ENTRY_POINT=https://auth.bamko.net/application/saml/internal-monitoring-app/sso/binding/redirect/
SAML_ISSUER=internal-monitoring-app
SAML_CALLBACK_URL=http://44.211.172.150:3001/api/auth/saml/callback
SAML_CERT=PLACEHOLDER_FOR_CERTIFICATE
SAML_IDENTIFIER_FORMAT=urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
SAML_LOGOUT_URL=https://auth.bamko.net/application/saml/internal-monitoring-app/slo/binding/redirect/
SAML_LOGOUT_CALLBACK_URL=http://44.211.172.150:3001/api/auth/saml/logout/callback
```

### Next Steps Checklist

- [ ] Get SAML certificate from Authentik
- [ ] Replace `PLACEHOLDER_FOR_CERTIFICATE` in `.env` file
- [ ] Deploy updated configuration with `./deploy-stack.sh`
- [ ] Test SAML authentication flow
- [ ] Verify user creation and role mapping

### Common Commands

```bash
# SSH to EC2
ssh -i devsecops.pem ubuntu@44.211.172.150

# Navigate to project
cd /home/ubuntu/augment-ai-aws

# Edit .env file
nano .env

# Deploy changes
./deploy-stack.sh

# Check logs
docker service logs aws-monitor_backend --tail 50

# Test SAML metadata
curl http://44.211.172.150:3001/api/auth/saml/metadata
```

## Support

For additional support:
1. Check Authentik documentation: https://goauthentik.io/docs/
2. Review application logs for detailed error messages
3. Test with SAML debugging tools
4. Verify network connectivity between services
