# Keycloak Integration Guide

This guide explains how to integrate the FDX Fine-Grained Consent Service with Keycloak authentication flows.

## Overview

The integration requires:
1. Adding a consent step to the Keycloak authentication flow
2. Creating a protocol mapper to include consent ID in access tokens
3. Configuring the consent service URL

## Option 1: Using Keycloak REST API (Recommended for Automation)

### Step 1: Add Protocol Mapper

Add a protocol mapper to include the active consent ID in access tokens:

```bash
# Get admin token
TOKEN=$(curl -s -X POST "http://keycloak:8180/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=admin" \
  -d "password=admin" | jq -r '.access_token')

# Get client ID (replace CLIENT_NAME with your client name)
CLIENT_ID=$(curl -s -X GET "http://keycloak:8180/admin/realms/fapi-demo/clients?clientId=CLIENT_NAME" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

# Create protocol mapper
curl -X POST "http://keycloak:8180/admin/realms/fapi-demo/clients/$CLIENT_ID/protocol-mappers/models" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "fdx-consent-id",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-attribute-mapper",
    "config": {
      "user.attribute": "fdx.active.consent.id",
      "claim.name": "fdxConsentId",
      "jsonType.label": "String",
      "id.token.claim": "false",
      "access.token.claim": "true",
      "userinfo.token.claim": "true"
    }
  }'
```

### Step 2: Configure Authentication Flow

For the authentication flow, you have two options:

#### Option A: Custom Authenticator SPI (Advanced)

Create a custom Keycloak authenticator that redirects to the consent service. This requires Java development and building a Keycloak SPI.

#### Option B: External Redirect (Simpler)

Modify your application's OAuth flow to:
1. After receiving the authorization code, check if consent is required
2. If consent is needed, redirect to the consent service
3. After consent is granted, complete the token exchange

## Option 2: Manual Configuration via Admin Console

### Step 1: Add Protocol Mapper

1. Login to Keycloak Admin Console
2. Navigate to **Clients** → Select your client → **Mappers** tab
3. Click **Add mapper** → **By configuration**
4. Select **User Attribute**
5. Configure:
   - **Name**: `fdx-consent-id`
   - **User Attribute**: `fdx.active.consent.id`
   - **Token Claim Name**: `fdxConsentId`
   - **Claim JSON Type**: `String`
   - **Add to ID token**: OFF
   - **Add to access token**: ON
   - **Add to userinfo**: ON
6. Click **Save**

### Step 2: Configure Authentication Flow

Currently, Keycloak doesn't have a built-in way to redirect to an external consent service during authentication. You have these options:

#### Option A: Post-Authentication Redirect

Modify your application to:
1. After user authenticates, check if they have an active consent
2. If not, redirect to: `http://consent-service:8900/consent?access_token={token}&user_id={user_id}&redirect_uri={redirect_uri}`
3. After consent is granted, continue with the OAuth flow

#### Option B: Custom Authenticator

Implement a custom Keycloak authenticator SPI that:
1. Checks if user has active consent
2. If not, redirects to consent service
3. After consent is granted, continues the flow

## Option 3: Application-Level Integration

The simplest approach is to handle consent at the application level:

### Flow

1. **User authenticates** with Keycloak (normal OAuth flow)
2. **Application receives access token**
3. **Application checks** if user has active consent (via consent service API)
4. **If no consent**, redirect user to consent service
5. **User selects accounts** and grants consent
6. **Consent service stores** consent in Keycloak user attributes
7. **User is redirected** back to application
8. **Application continues** with normal flow

### Implementation Example

```javascript
// In your application's OAuth callback handler
async function handleOAuthCallback(code) {
  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);
  
  // Check if user has active consent
  const userId = tokens.id_token.sub;
  const consents = await fetch(`http://consent-service:8900/api/consents/${userId}`);
  const hasActiveConsent = consents.consents.some(c => c.status === 'ACTIVE');
  
  if (!hasActiveConsent) {
    // Redirect to consent service
    const consentUrl = new URL('http://consent-service:8900/consent');
    consentUrl.searchParams.set('access_token', tokens.access_token);
    consentUrl.searchParams.set('user_id', userId);
    consentUrl.searchParams.set('redirect_uri', window.location.href);
    window.location.href = consentUrl.toString();
    return;
  }
  
  // Continue with normal application flow
  proceedWithApplication(tokens);
}
```

## Testing the Integration

### 1. Test Protocol Mapper

After adding the protocol mapper, test that consent ID is included in tokens:

```bash
# Get access token
TOKEN=$(curl -s -X POST "http://keycloak:8180/realms/fapi-demo/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=your-client" \
  -d "username=user" \
  -d "password=password" | jq -r '.access_token')

# Decode token (or use jwt.io)
echo $TOKEN | cut -d. -f2 | base64 -d | jq .
# Should include "fdxConsentId" claim
```

### 2. Test Consent Storage

```bash
# Create a consent
curl -X POST http://consent-service:8900/api/consents \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "selectedAccounts": ["account-id-1"],
    "dataClusters": ["ACCOUNT_DETAILED", "TRANSACTIONS"],
    "durationType": "TIME_BOUND",
    "durationPeriod": 365
  }'

# Verify consent is stored
curl http://consent-service:8900/api/consents/user-uuid
```

### 3. Test FDX Consent API

```bash
# Get consent grant
curl http://consent-service:8900/consents/{consentId} \
  -H "Authorization: Bearer {access-token}" \
  -H "x-fapi-interaction-id: {uuid}"

# Revoke consent
curl -X PUT http://consent-service:8900/consents/{consentId}/revocation \
  -H "Authorization: Bearer {access-token}" \
  -H "Content-Type: application/json" \
  -H "x-fapi-interaction-id: {uuid}" \
  -d '{
    "reason": "USER_ACTION",
    "initiator": "INDIVIDUAL"
  }'
```

## Troubleshooting

### Consent ID not in token

- Verify protocol mapper is configured correctly
- Check that user has `fdx.active.consent.id` attribute set
- Ensure protocol mapper is enabled for the client

### Consent service not accessible

- Verify consent service is running: `curl http://consent-service:8900/healthz`
- Check network connectivity between Keycloak and consent service
- Verify Docker network configuration

### Accounts not loading

- Verify FDX Core API is accessible from consent service
- Check access token is valid
- Verify user has accounts in FDX system

## Next Steps

1. **Implement Custom Authenticator** (if needed) - For seamless integration
2. **Add Consent Expiration Handling** - Check and refresh expired consents
3. **Add Consent Revocation UI** - Allow users to revoke consents
4. **Implement Consent Updates** - Support modifying existing consents
5. **Add Audit Logging** - Log all consent operations



