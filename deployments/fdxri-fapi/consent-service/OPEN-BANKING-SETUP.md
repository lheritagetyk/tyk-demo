# Open Banking Compliant Setup - Single Method

This is the **only method** you need for Open Banking compliance. It integrates consent directly into the Keycloak authentication flow.

## Why This Method

For Open Banking compliance, consent **must** be:
- ✅ Part of the authorization flow (before token issuance)
- ✅ Required and cannot be bypassed
- ✅ Stored and auditable
- ✅ Explicitly granted by the user

This method uses a **custom Keycloak Authenticator** that enforces consent as part of the authentication flow.

## Step 1: Build the Authenticator

```bash
cd consent-service/keycloak-authenticator-spi
mvn clean package
```

This creates: `target/fdx-consent-authenticator-1.0.0.jar`

## Step 2: Deploy to Keycloak

### Option A: Docker/Container

If Keycloak is in a container:

```bash
# Find your Keycloak container name
docker ps --filter "name=keycloak" --format "{{.Names}}"

# Copy JAR to Keycloak container (replace CONTAINER_NAME with your container name)
# Example: tyk-demo-keycloak-1
docker cp target/fdx-consent-authenticator-1.0.0.jar CONTAINER_NAME:/opt/keycloak/providers/

# Restart Keycloak
docker restart CONTAINER_NAME
```

**Note:** If using docker-compose, the container name is typically based on your project name. For example, if your project is `tyk-demo`, the container might be `tyk-demo-keycloak-1`.

### Option B: Local Installation

```bash
# Copy JAR to Keycloak providers directory
cp target/fdx-consent-authenticator-1.0.0.jar /path/to/keycloak/providers/

# Restart Keycloak
```

## Step 3: Copy the Browser Flow

**⚠️ IMPORTANT**: You cannot modify built-in flows like "browser" directly. You must copy the flow first.

1. **Login** to Keycloak Admin Console
2. **Navigate** to Authentication → Flows
3. **Find the "browser" flow** in the list
4. **Click the dropdown menu** (three dots) next to "browser"
5. **Select "Copy"**
6. **Name it** (e.g., "browser-fdx" or "browser with consent")
7. **Click "Save"**

## Step 4: Add Authenticator to the New Flow

1. **Select your new flow** (not the original "browser" flow)
2. **Click "Add step"**
3. **Select "FDX Consent Selection"** from the dropdown
4. **Click "Add"** to add it to the flow
5. **Set requirement** to "REQUIRED" (you'll see a dropdown next to the step)
6. **Move** it to execute **after** "Forms" and **before** "Browser - Conditional OTP"
   - Use the up/down arrows or drag the step to reorder
7. **Click** on the "FDX Consent Selection" step you just added to configure it:
   - **Consent Service URL**: `http://consent-service:8900`
   - **FDX API Base URL**: `http://fdxri-tomcat:8090/fdxapi`
   - **Required Data Clusters**: `ACCOUNT_DETAILED,TRANSACTIONS,STATEMENTS`
8. **Click Save** (at the bottom of the page)

## Step 5: Update Clients to Use New Flow

After creating the new flow, you need to tell your clients to use it:

1. **Navigate** to Clients → [Your Client]
2. **Go to the "Advanced" tab**
3. **Find "Browser Flow"** dropdown
4. **Select your new flow** (e.g., "browser-fdx")
5. **Click "Save"**

## Step 4: Add Protocol Mapper

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

## Step 5: Start Consent Service

```bash
cd consent-service
npm install
npm start
```

## How It Works

1. User authenticates with username/password
2. **FDX Consent Selection** authenticator executes
3. Checks if user has active consent
4. **If no consent:**
   - Redirects to consent service
   - User selects accounts
   - Consent is stored in Keycloak
   - User returns to Keycloak
   - Authenticator validates consent
5. **If consent exists:**
   - Validates it's active
6. Flow continues to token issuance

## Compliance Checklist

- ✅ Consent is required before token issuance
- ✅ Consent cannot be bypassed (REQUIRED execution)
- ✅ Consent is stored in Keycloak (auditable)
- ✅ Consent expiration is checked
- ✅ Full audit trail in Keycloak logs
- ✅ User explicitly grants consent

## Testing

1. **Start services:**
   ```bash
   # Start consent service
   cd consent-service && npm start
   
   # Ensure Keycloak is running with authenticator deployed
   ```

2. **Test authentication flow:**
   - Go to your application's login
   - Authenticate with username/password
   - You should be redirected to consent service
   - Select accounts and grant consent
   - You should be redirected back and receive tokens

3. **Verify consent in token:**
   ```bash
   # Decode access token
   # Should contain "fdxConsentId" claim
   ```

## Troubleshooting

### Authenticator not appearing

- Verify JAR is in `/opt/keycloak/providers/` (or your providers directory)
- Check Keycloak logs for errors
- Ensure Keycloak was restarted after deployment

### Consent service not accessible

- Verify consent service is running: `curl http://consent-service:8900/healthz`
- Check network connectivity between Keycloak and consent service
- Verify URLs in authenticator configuration

### User stuck in redirect loop

- Check Keycloak logs for errors
- Verify consent is being stored: Check user attributes in Keycloak
- Ensure consent service is returning properly

## Important Notes

- **This is the only method** - no application-level checks needed
- **Consent is enforced** at the authentication level
- **Compliant with Open Banking** requirements
- **All consent operations** are logged in Keycloak

## Next Steps

1. Build and deploy authenticator
2. Configure in Keycloak
3. Test authentication flow
4. Verify consent in tokens
5. Monitor Keycloak logs for compliance audit

That's it. This single method provides full Open Banking compliance.

