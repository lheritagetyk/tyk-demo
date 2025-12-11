# FDX Fine-Grained Consent - Quick Start Guide

## Open Banking Compliant Setup

**For Open Banking compliance, this is the only method you need.**

This uses a **custom Keycloak Authenticator** that integrates consent directly into the authentication flow, ensuring:
- ✅ Consent is required before token issuance
- ✅ Consent cannot be bypassed
- ✅ Full audit trail in Keycloak
- ✅ Compliant with Open Banking requirements

## Quick Setup

### 1. Build the Keycloak Authenticator

```bash
cd consent-service/keycloak-authenticator-spi
mvn clean package
```

This creates: `target/fdx-consent-authenticator-1.0.0.jar`

### 2. Deploy to Keycloak

```bash
# Find your Keycloak container name
docker ps --filter "name=keycloak" --format "{{.Names}}"

# Copy JAR to Keycloak container (replace CONTAINER_NAME with your container name)
# Example: tyk-demo-keycloak-1
docker cp target/fdx-consent-authenticator-1.0.0.jar CONTAINER_NAME:/opt/keycloak/providers/

# Restart Keycloak
docker restart CONTAINER_NAME
```

**Note:** If using docker-compose, find your container name first. For example: `tyk-demo-keycloak-1`

### 3. Configure in Keycloak Admin Console

1. **Login** to Keycloak Admin Console
2. **Navigate** to Authentication → Flows
3. **Click** on "browser" flow
4. **Click** "Add step" (this is the button you see)
5. **Select** "FDX Consent Selection" from the "Add step" dropdown
6. **Click** "Add" to add it to the flow
7. **Set requirement** to "REQUIRED" (dropdown next to the step)
8. **Move** it to execute **after** "Forms" and **before** "Browser - Conditional OTP"
   - Use the up/down arrows or drag to reorder
9. **Click** on the "FDX Consent Selection" step to configure it:
   - **Consent Service URL**: `http://consent-service:8900`
   - **FDX API Base URL**: `http://fdxri-tomcat:8090/fdxapi`
   - **Required Data Clusters**: `ACCOUNT_DETAILED,TRANSACTIONS,STATEMENTS`
10. **Click Save** (at the bottom of the page)

### 4. Add Protocol Mapper

To include consent ID in access tokens:

1. **Navigate** to Clients → Your Client → Mappers
2. **Click** "Add mapper" → "By configuration" → "User Attribute"
3. **Configure**:
   - Name: `fdx-consent-id`
   - User Attribute: `fdx.active.consent.id`
   - Token Claim Name: `fdxConsentId`
   - Claim JSON Type: `String`
   - Add to access token: **ON**
4. **Click Save**

### 5. Start Consent Service

```bash
cd consent-service
npm install
npm start
```

The service will be available at `http://localhost:8900`

### 6. Test It

1. **Test authentication flow:**
   - Go to your application's login
   - Authenticate with username/password
   - You should be redirected to consent service
   - Select accounts and grant consent
   - You should be redirected back and receive tokens

2. **Verify consent in token:**
   ```bash
   # Decode access token - should contain "fdxConsentId" claim
   ```

## What You Get

✅ **Open Banking compliant** - Consent required before token issuance  
✅ **Fine-grained consent** - Users select specific accounts  
✅ **FDX Consent API** - Full implementation of FDX Consent API specification  
✅ **Keycloak integration** - Consents stored in Keycloak user attributes  
✅ **Beautiful UI** - Modern, user-friendly consent selection interface  
✅ **FDX Core API integration** - Automatically fetches user accounts  

## How It Works

1. User authenticates with username/password (Forms)
2. **FDX Consent Selection** authenticator executes
3. Authenticator checks if user has active consent
4. **If no consent:**
   - Redirects to consent service UI
   - User selects accounts and grants consent
   - Consent is stored in Keycloak
   - User is redirected back
   - Authenticator validates consent was created
5. **If consent exists:**
   - Authenticator validates it's active and not expired
6. Flow continues to token issuance

## Using Docker

The consent service is already configured in `docker-compose.yml`. Start it with:

```bash
docker-compose up -d consent-service
```

Make sure to deploy the Keycloak authenticator JAR to the Keycloak container as described in step 2 above.

## API Endpoints

### Consent Service API

- `POST /api/accounts` - Get user accounts from FDX Core API
- `POST /api/consents` - Store a consent grant
- `GET /api/consents/:userId` - Get all consents for a user
- `GET /api/consents/:userId/:consentId` - Get specific consent
- `PUT /api/consents/:userId/:consentId/revocation` - Revoke consent

### FDX Consent API (FDX Specification)

- `GET /consents/{consentId}` - Get consent grant (FDX spec)
- `PUT /consents/{consentId}/revocation` - Revoke consent (FDX spec)
- `GET /consents/{consentId}/revocation` - Get revocation record (FDX spec)

### UI

- `GET /consent` - Consent selection UI

## Consent Grant Structure

```json
{
  "id": "9585694d3ae58863",
  "status": "ACTIVE",
  "createdTime": "2024-01-01T00:00:00.000Z",
  "expirationTime": "2025-01-01T00:00:00.000Z",
  "durationType": "TIME_BOUND",
  "durationPeriod": 365,
  "resources": [
    {
      "resourceType": "ACCOUNT",
      "resourceId": "account-id-1",
      "dataClusters": ["ACCOUNT_DETAILED", "TRANSACTIONS", "STATEMENTS"]
    }
  ]
}
```

## Environment Variables

```bash
PORT=8900                                    # Service port
KC_BASE_URL=http://keycloak:8180            # Keycloak URL
KC_REALM=fapi-demo                          # Keycloak realm
KC_ADMIN_USERNAME=admin                     # Keycloak admin username
KC_ADMIN_PASSWORD=admin                     # Keycloak admin password
FDX_API_BASE_URL=http://fdxri-tomcat:8090/fdxapi  # FDX Core API URL
```

## Next Steps

1. ✅ **Build authenticator** - `mvn clean package` in `keycloak-authenticator-spi/`
2. ✅ **Deploy to Keycloak** - Copy JAR to providers directory
3. ✅ **Configure flow** - Add execution to browser flow
4. ✅ **Add protocol mapper** - Include consent ID in tokens
5. ✅ **Start consent service** - `npm start` in `consent-service/`
6. ✅ **Test authentication flow** - Verify consent is required

## Need Help?

- See `OPEN-BANKING-SETUP.md` for complete step-by-step instructions
- See `README.md` for detailed documentation
- Check service logs: `docker logs fdx-consent-service`
- Check Keycloak logs for authenticator errors

## Important Notes

- **This is the only method** for Open Banking compliance
- **No application-level checks needed** - consent is enforced at authentication level
- **Consent cannot be bypassed** - it's a REQUIRED execution in the flow
- **All operations are audited** in Keycloak logs

## FDX Consent API

The service includes a full FDX Consent API implementation at `/consents/{consentId}` endpoints:
- `GET /consents/{consentId}` - Get consent grant
- `PUT /consents/{consentId}/revocation` - Revoke consent
- `GET /consents/{consentId}/revocation` - Get revocation record

This provides:
- Standardized consent management
- Compliance with FDX requirements
- Interoperability with other FDX implementations
- Consent revocation and audit capabilities
