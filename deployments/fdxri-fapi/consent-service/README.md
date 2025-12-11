# FDX Fine-Grained Consent Service

This service implements fine-grained consent management for FDX (Financial Data Exchange) API, integrated with Keycloak authentication flows.

## Overview

The service provides:
1. **Account Selection UI** - Allows users to select which accounts they want to grant access to
2. **Consent Storage** - Stores consent grants in Keycloak user attributes
3. **FDX Consent API** - Implements the FDX Consent API specification endpoints
4. **Keycloak Integration** - Seamlessly integrates with Keycloak authentication flows

## Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ 1. Authenticate
       ▼
┌─────────────┐
│  Keycloak   │ ──► 2. Redirect to Consent Service
└──────┬──────┘
       │
       │ 3. Get Accounts
       ▼
┌─────────────┐     ┌─────────────┐
│   Consent   │────►│  FDX Core   │
│   Service   │     │     API     │
└──────┬──────┘     └─────────────┘
       │
       │ 4. User Selects Accounts
       │
       │ 5. Store Consent in Keycloak
       ▼
┌─────────────┐
│  Keycloak   │ ──► User Attributes
│  (Storage)  │     - fdx.consents
└─────────────┘     - fdx.active.consent.id
```

## Components

### 1. Consent Service (`server.js`)
- REST API for managing consents
- Integrates with FDX Core API to fetch user accounts
- Stores consents in Keycloak user attributes
- Provides consent selection UI

### 2. Consent UI (`consent-ui.html`)
- User-friendly interface for account selection
- Supports different consent duration types
- Displays account information and data clusters

### 3. FDX Consent API (`fdx-consent-api.js`)
- Implements FDX Consent API specification
- Endpoints:
  - `GET /consents/{consentId}` - Get consent grant
  - `PUT /consents/{consentId}/revocation` - Revoke consent
  - `GET /consents/{consentId}/revocation` - Get revocation record

## Setup

### 1. Install Dependencies

```bash
cd consent-service
npm install
```

### 2. Configure Environment Variables

Create a `.env` file or set environment variables:

```bash
PORT=8900
KC_BASE_URL=http://keycloak:8180
KC_REALM=fapi-demo
KC_ADMIN_USERNAME=admin
KC_ADMIN_PASSWORD=admin
KC_ADMIN_REALM=fapi-demo
FDX_API_BASE_URL=http://fdxri-tomcat:8080/fdxapi
TYK_GATEWAY_URL=http://tyk-gateway.localhost:8080
```

### 3. Start the Service

```bash
npm start
```

The service will be available at:
- API: `http://localhost:8900/api/*`
- UI: `http://localhost:8900/consent`
- Health: `http://localhost:8900/healthz`

## Open Banking Compliance

**For Open Banking compliance, use the custom Keycloak Authenticator SPI.**

See `OPEN-BANKING-SETUP.md` for the single, compliant method.

This ensures:
- ✅ Consent is required before token issuance
- ✅ Consent cannot be bypassed
- ✅ Consent is part of the authorization flow
- ✅ Full audit trail in Keycloak

## Keycloak Integration

### Option 1: Manual Configuration

1. **Add Authenticator Execution**
   - Login to Keycloak Admin Console
   - Navigate to Authentication → Flows
   - Select 'browser' flow
   - Add execution after 'Forms'
   - Configure redirect to consent service

2. **Create Protocol Mapper**
   - Navigate to Clients → {client} → Mappers
   - Add mapper: User Attribute → `fdx.active.consent.id`
   - Token Claim Name: `fdxConsentId`
   - Add to access token: ON

### Option 2: Programmatic Configuration

Use the Keycloak Admin API to add the authenticator execution. See `keycloak-authenticator-config.json` for details.

## API Endpoints

### Consent Service API

#### `POST /api/accounts`
Fetch user accounts from FDX Core API.

**Request:**
```json
{
  "accessToken": "eyJ..."
}
```

**Response:**
```json
{
  "accounts": [
    {
      "accountId": "b14e1e714693bc00",
      "name": "Checking Account",
      "accountType": "CHECKING",
      "accountNumber": "****1234"
    }
  ]
}
```

#### `POST /api/consents`
Store a consent grant.

**Request:**
```json
{
  "userId": "user-uuid",
  "selectedAccounts": ["account-id-1", "account-id-2"],
  "dataClusters": ["ACCOUNT_DETAILED", "TRANSACTIONS", "STATEMENTS"],
  "durationType": "TIME_BOUND",
  "durationPeriod": 365
}
```

**Response:**
```json
{
  "success": true,
  "consentGrant": {
    "id": "9585694d3ae58863",
    "status": "ACTIVE",
    "createdTime": "2024-01-01T00:00:00.000Z",
    "expirationTime": "2025-01-01T00:00:00.000Z",
    "durationType": "TIME_BOUND",
    "durationPeriod": 365,
    "resources": [...]
  }
}
```

#### `GET /api/consents/:userId`
Get all consent grants for a user.

#### `GET /api/consents/:userId/:consentId`
Get a specific consent grant.

#### `PUT /api/consents/:userId/:consentId/revocation`
Revoke a consent grant.

**Request:**
```json
{
  "reason": "USER_ACTION",
  "initiator": "INDIVIDUAL"
}
```

### FDX Consent API

The FDX Consent API endpoints follow the FDX specification:

- `GET /consents/{consentId}` - Get consent grant
- `PUT /consents/{consentId}/revocation` - Revoke consent
- `GET /consents/{consentId}/revocation` - Get revocation record

## Consent Grant Structure

Consent grants are stored according to the FDX Consent Grant specification:

```json
{
  "id": "9585694d3ae58863",
  "status": "ACTIVE",
  "parties": [
    {
      "name": "Data Provider",
      "type": "DATA_PROVIDER",
      "registry": "FDX",
      "registeredEntityName": "Data Provider",
      "registeredEntityId": "..."
    },
    {
      "name": "Data Recipient",
      "type": "DATA_RECIPIENT",
      "registry": "FDX",
      "registeredEntityName": "Data Recipient",
      "registeredEntityId": "..."
    }
  ],
  "createdTime": "2024-01-01T00:00:00.000Z",
  "expirationTime": "2025-01-01T00:00:00.000Z",
  "durationType": "TIME_BOUND",
  "durationPeriod": 365,
  "lookbackPeriod": 60,
  "resources": [
    {
      "resourceType": "ACCOUNT",
      "resourceId": "b14e1e714693bc00",
      "dataClusters": [
        "ACCOUNT_DETAILED",
        "TRANSACTIONS",
        "STATEMENTS"
      ]
    }
  ]
}
```

## Data Clusters

Supported data clusters (per FDX specification):
- `ACCOUNT_BASIC` - Basic account information
- `ACCOUNT_DETAILED` - Detailed account information
- `TRANSACTIONS` - Transaction history
- `STATEMENTS` - Account statements
- `CUSTOMER_CONTACT` - Customer contact information
- `CUSTOMER_PERSONAL` - Customer personal information
- `PAYMENT_SUPPORT` - Payment support data
- And more (see FDX specification)

## Duration Types

- **ONE_TIME** - Single use consent (expires in 24 hours)
- **TIME_BOUND** - Consent valid for a specified number of days
- **PERSISTENT** - Consent does not expire (until revoked)

## Storage in Keycloak

Consents are stored in Keycloak user attributes:

- `fdx.consents` - JSON array of all consent grants
- `fdx.active.consent.id` - ID of the currently active consent

The active consent ID is added to the access token via a protocol mapper.

## Testing

### Test Consent Service

```bash
# Health check
curl http://localhost:8900/healthz

# Get accounts (requires access token)
curl -X POST http://localhost:8900/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"accessToken": "your-access-token"}'

# Store consent
curl -X POST http://localhost:8900/api/consents \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "selectedAccounts": ["account-id-1"],
    "dataClusters": ["ACCOUNT_DETAILED", "TRANSACTIONS"],
    "durationType": "TIME_BOUND",
    "durationPeriod": 365
  }'
```

### Test FDX Consent API

```bash
# Get consent grant
curl http://localhost:8900/consents/{consentId} \
  -H "Authorization: Bearer {access-token}" \
  -H "x-fapi-interaction-id: {uuid}"

# Revoke consent
curl -X PUT http://localhost:8900/consents/{consentId}/revocation \
  -H "Authorization: Bearer {access-token}" \
  -H "Content-Type: application/json" \
  -H "x-fapi-interaction-id: {uuid}" \
  -d '{
    "reason": "USER_ACTION",
    "initiator": "INDIVIDUAL"
  }'
```

## Docker Integration

Add to `docker-compose.yml`:

```yaml
services:
  consent-service:
    build: ./consent-service
    ports:
      - "8900:8900"
    environment:
      PORT: 8900
      KC_BASE_URL: http://keycloak:8180
      KC_REALM: fapi-demo
      KC_ADMIN_USERNAME: admin
      KC_ADMIN_PASSWORD: admin
      FDX_API_BASE_URL: http://fdxri-tomcat:8080/fdxapi
    networks:
      - tyk-demo_tyk
    depends_on:
      - keycloak
      - fdxri-tomcat
```

## Security Considerations

1. **Access Token Validation** - The service should validate access tokens before fetching accounts
2. **User Authorization** - Ensure users can only access their own consents
3. **HTTPS** - Use HTTPS in production
4. **Token Storage** - Do not store access tokens in browser storage
5. **CSRF Protection** - Implement CSRF protection for the consent UI

## Future Enhancements

- [ ] Support for consent updates (not just creation/revocation)
- [ ] Consent expiration notifications
- [ ] Consent audit logging
- [ ] Support for additional resource types (CUSTOMER, DOCUMENT)
- [ ] Integration with FDX Participant Registry
- [ ] Consent analytics and reporting

## References

- [FDX Consent API Specification](https://financialdataexchange.org/)
- [FDX User Experience Guidelines](https://financialdataexchange.org/)
- [Keycloak Authentication SPI](https://www.keycloak.org/docs/latest/server_development/#_auth_spi)

