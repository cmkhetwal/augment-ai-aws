# SAML Integration with Authentik

This guide explains how to configure SAML authentication between your AWS Monitor application and Authentik.

## Prerequisites

1. Running Authentik instance (https://goauthentik.io/)
2. AWS Monitor application deployed and accessible
3. Admin access to both systems

## Step 1: Configure Authentik

### 1.1 Create a SAML Provider in Authentik

1. Log into your Authentik admin interface
2. Go to **Applications** → **Providers**
3. Click **Create** and select **SAML Provider**
4. Configure the following settings:

**Basic Settings:**
- **Name**: `AWS Monitor SAML`
- **Authentication flow**: `default-authentication-flow`
- **Authorization flow**: `default-provider-authorization-explicit-consent`

**Protocol Settings:**
- **ACS URL**: `http://34.229.57.190:3001/api/auth/saml/callback`
- **Issuer**: `aws-monitor`
- **Service Provider Binding**: `Post`
- **Audience**: `aws-monitor`

**Advanced Settings:**
- **Signing Certificate**: Select your certificate or create a new one
- **Property mappings**: Select the default SAML mappings

### 1.2 Create an Application in Authentik

1. Go to **Applications** → **Applications**
2. Click **Create**
3. Configure:
   - **Name**: `AWS Monitor`
   - **Slug**: `aws-monitor`
   - **Provider**: Select the SAML provider created above
   - **Launch URL**: `http://34.229.57.190`

### 1.3 Get SAML Metadata

1. Go to your SAML provider settings
2. Copy the **Metadata URL** or download the metadata XML
3. Note the **SSO URL** (Single Sign-On URL)
4. Copy the **Certificate** content

## Step 2: Configure AWS Monitor Application

### 2.1 Update Environment Variables

Update your `.env` file with the following SAML configuration:

```env
# SAML Configuration for Authentik Integration
SAML_ENTRY_POINT=https://your-authentik-domain/application/saml/aws-monitor/sso/binding/redirect/
SAML_ISSUER=aws-monitor
SAML_CALLBACK_URL=http://34.229.57.190:3001/api/auth/saml/callback
SAML_CERT=-----BEGIN CERTIFICATE-----
MIICXjCCAcegAwIBAgIJAL...
(Your Authentik certificate content here)
-----END CERTIFICATE-----
SAML_IDENTIFIER_FORMAT=urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
```

### 2.2 Replace Authentik Domain

Replace `your-authentik-domain` with your actual Authentik domain:
- Example: `https://auth.yourcompany.com/application/saml/aws-monitor/sso/binding/redirect/`

### 2.3 Certificate Configuration

To get the certificate from Authentik:
1. Go to **System** → **Certificates** in Authentik
2. Find your certificate and click **Download Certificate**
3. Copy the certificate content (including BEGIN/END lines)
4. Paste it in the `SAML_CERT` environment variable

## Step 3: Deploy Updated Configuration

### 3.1 Rebuild and Deploy

```bash
cd augment-ai-aws
./build-images.sh
./deploy-stack.sh
```

### 3.2 Verify Deployment

Check that the services are running:
```bash
docker stack ps aws-monitor
```

## Step 4: Test SAML Authentication

### 4.1 Access SAML Login

1. Go to `http://34.229.57.190`
2. Click on **SAML Login** or **SSO Login**
3. You should be redirected to Authentik login page

### 4.2 Complete Authentication

1. Enter your Authentik credentials
2. Grant consent if prompted
3. You should be redirected back to AWS Monitor dashboard

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
   curl http://34.229.57.190:3001/api/auth/saml/metadata
   ```

3. **Verify Environment Variables**:
   ```bash
   docker exec $(docker ps -q -f name=aws-monitor_backend) env | grep SAML
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

## Support

For additional support:
1. Check Authentik documentation: https://goauthentik.io/docs/
2. Review application logs for detailed error messages
3. Test with SAML debugging tools
