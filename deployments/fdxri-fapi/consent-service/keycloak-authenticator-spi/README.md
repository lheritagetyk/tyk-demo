# Keycloak Custom Authenticator for FDX Consent

This is a proper Open Banking compliant implementation that integrates consent into the Keycloak authentication flow.

## Why This Approach

For Open Banking compliance:
- ✅ Consent must be part of the authorization flow (before token issuance)
- ✅ Consent must be stored and auditable
- ✅ User must explicitly grant consent during authentication
- ✅ Consent cannot be bypassed

## Implementation

This uses a custom Keycloak Authenticator SPI that:
1. Executes after Forms authentication
2. Checks if user has active consent
3. If not, redirects to consent service
4. After consent is granted, continues the flow
5. Stores consent in Keycloak user attributes

## Building the Authenticator

### Prerequisites

- Java 11+
- Maven 3.6+
- Keycloak 18+ (or your version)

### Build Steps

```bash
cd keycloak-authenticator-spi
mvn clean package
```

This creates a JAR file in `target/fdx-consent-authenticator-1.0.0.jar`

### Deploy to Keycloak

1. Copy the JAR to Keycloak's providers directory:
   ```bash
   cp target/fdx-consent-authenticator-1.0.0.jar /path/to/keycloak/providers/
   ```

2. Restart Keycloak

3. The authenticator will appear as "FDX Consent Selection" in the authentication flow builder

## Configuration

### Add to Browser Flow

1. Login to Keycloak Admin Console
2. Navigate to **Authentication** → **Flows**
3. Click **browser** flow
4. Click **Add execution** (or the + button)
5. Select **FDX Consent Selection** from the dropdown
6. Set it to **REQUIRED**
7. Move it to execute **after** "Forms" and **before** "Browser - Conditional OTP"
8. Click **Save**

### Configure Authenticator

1. Click on the "FDX Consent Selection" execution you just added
2. Configure:
   - **Consent Service URL**: `http://consent-service:8900`
   - **FDX API Base URL**: `http://fdxri-tomcat:8090/fdxapi`
   - **Required Data Clusters**: `ACCOUNT_DETAILED,TRANSACTIONS,STATEMENTS`
3. Click **Save**

## How It Works

1. User authenticates with username/password (Forms)
2. **FDX Consent Selection** authenticator executes
3. Authenticator checks if user has active consent
4. If no consent:
   - Redirects to consent service UI
   - User selects accounts and grants consent
   - Consent is stored in Keycloak
   - User is redirected back
   - Authenticator validates consent was created
5. If consent exists:
   - Authenticator validates it's active and not expired
6. Flow continues to token issuance

## Compliance Features

- ✅ Consent is required before token issuance
- ✅ Consent is stored in Keycloak (auditable)
- ✅ Consent cannot be bypassed
- ✅ Consent expiration is checked
- ✅ Full audit trail in Keycloak

## Testing

1. Start consent service: `npm start` in `consent-service/`
2. Deploy authenticator to Keycloak
3. Add to browser flow
4. Test authentication flow - user should be prompted for consent

## Troubleshooting

- **Authenticator not appearing**: Check JAR is in providers directory and Keycloak restarted
- **Consent service not accessible**: Verify network connectivity and URLs
- **Consent not stored**: Check Keycloak admin credentials in consent service config




