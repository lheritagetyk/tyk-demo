# Tyk Portal Webhook - Keycloak Integration

A minimal Express webhook server that automatically updates Keycloak client configurations when applications are approved in the Tyk Portal. This webhook ensures that approved applications have the correct OAuth 2.0 settings, consent screens, and scopes configured in Keycloak.

## Features

- Automatically configures Keycloak clients when Tyk Portal applications are approved
- Sets up consent screens with customizable text and themes
- Configures OAuth 2.0 settings (PAR, DPoP, PKCE, etc.)
- Assigns default client scopes (openid, FDX scopes)
- Resolves Tyk Portal App IDs to Keycloak client IDs

## Prerequisites

- Node.js 18+ (or add a fetch polyfill for older versions)
- Access to Tyk Portal Admin API
- Access to Keycloak Admin API
- Keycloak realm with FDX scopes configured

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy the `.env` file and configure it:
```bash
cp .env.example .env  # If you have an example file
# Or create .env manually (see Configuration section)
```

## Configuration

The webhook uses environment variables loaded from a `.env` file. Create a `.env` file in the `portalwebhook` directory with the following variables:

### Required Environment Variables

```env
# Tyk Portal Admin API Configuration
TYK_PORTAL_BASE_URL=http://tyk-portal.localhost:3100
TYK_PORTAL_ADMIN_API_KEY=your-portal-admin-api-key-here

# Keycloak Configuration
KC_BASE_URL=http://keycloak:8180
KC_REALM=fapi-demo
KC_ADMIN_USERNAME=admin
KC_ADMIN_PASSWORD=admin
KC_ADMIN_REALM=master
KC_ADMIN_CLIENT_ID=admin-cli

# Server Configuration
PORT=8899
```

### Optional Environment Variables

```env
# Defaults applied if webhook doesn't send them
DEFAULT_CONSENT_TEXT=This app will access your account data to provide personalized services.
DEFAULT_LOGIN_THEME=bank-theme
```

### Environment Variable Descriptions

| Variable | Description | Example |
|----------|-------------|---------|
| `TYK_PORTAL_BASE_URL` | Base URL of the Tyk Portal | `http://tyk-portal.localhost:3100` |
| `TYK_PORTAL_ADMIN_API_KEY` | Admin API key for Tyk Portal | JWT token from Portal |
| `KC_BASE_URL` | Base URL of Keycloak server | `http://keycloak:8180` |
| `KC_REALM` | Keycloak realm name | `fapi-demo` |
| `KC_ADMIN_USERNAME` | Keycloak admin username | `admin` |
| `KC_ADMIN_PASSWORD` | Keycloak admin password | `admin` |
| `KC_ADMIN_REALM` | Realm for admin authentication | `master` |
| `KC_ADMIN_CLIENT_ID` | Client ID for admin CLI | `admin-cli` |
| `PORT` | Port for the webhook server | `8899` |
| `DEFAULT_CONSENT_TEXT` | Default consent screen text | Custom message |
| `DEFAULT_LOGIN_THEME` | Default login theme | `bank-theme` |

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on the port specified in the `PORT` environment variable (default: 8899).

## Endpoints

### `POST /webhooks/tyk`
Main webhook endpoint that receives events from Tyk Portal.

**Expected Payload:**
```json
{
  "Event": "AccessRequestApproved",
  "Message": {
    "AppID": "your-app-id"
  },
  "Timestamp": "2024-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "ok": true,
  "clientId": "resolved-client-id",
  "scopesAdded": ["openid", "fdx:account.basic:read", ...]
}
```

### `HEAD /webhooks/tyk`
Health check endpoint for webhook connectivity verification.

### `GET /healthz`
Health check endpoint that returns server status.

**Response:**
```json
{
  "ok": true
}
```

## How It Works

1. **Webhook Receives Event**: When a Tyk Portal application is approved, Tyk sends a webhook event to `/webhooks/tyk`

2. **Resolve Client ID**: The webhook uses the App ID from the event to:
   - Fetch the application name from Tyk Portal Admin API
   - Search for a matching Keycloak client by name or client ID

3. **Update Keycloak Client**: The webhook updates the Keycloak client with:
   - Consent screen configuration
   - Login theme
   - OAuth 2.0 settings (PAR, DPoP, PKCE)
   - Default client scopes (openid, FDX scopes)

4. **Return Response**: Returns success status and the configured client ID

## Keycloak Client Configuration

The webhook automatically configures the following Keycloak client attributes:

- `consentRequired`: `true`
- `publicClient`: `true`
- `display.on.consent.screen`: `"true"`
- `consent.screen.text`: Custom consent text
- `login_theme`: Theme name
- `require.pushed.authorization.requests`: `"true"`
- `dpop.bound.access.tokens`: `"true"`
- `pkce.code.challenge.method`: `"S256"`
- `id.token.signed.response.alg`: `"ES256"`
- `iaccess.token.signed.response.alg`: `"ES256"`

### Default Scopes Added

The following scopes are automatically added as default client scopes:

- `openid`
- `fdx:account.basic:read`
- `fdx:account.detail:read`
- `fdx:transaction:read`
- `fdx:payment:write`

## Setting Up the Webhook in Tyk Portal

1. Navigate to Tyk Portal Admin settings
2. Go to Webhooks configuration
3. Add a new webhook with:
   - **URL**: `http://your-server:8899/webhooks/tyk`
   - **Event**: `AccessRequestApproved`
   - **Method**: `POST`

## Troubleshooting

### Missing Environment Variables
If you see an error about missing environment variables, ensure your `.env` file contains all required variables. The server will exit with a clear error message listing missing variables.

### Keycloak Authentication Failed
- Verify `KC_ADMIN_USERNAME` and `KC_ADMIN_PASSWORD` are correct
- Ensure `KC_ADMIN_REALM` is set to `master` (default admin realm)
- Check that `KC_BASE_URL` is accessible from the webhook server

### Client Not Found
- Ensure the application name in Tyk Portal matches the client name or client ID in Keycloak
- Check that the client exists in the specified `KC_REALM`
- Verify the Tyk Portal Admin API key has access to fetch application details

### Scope Not Found
- Ensure all FDX scopes are created in Keycloak before running the webhook
- Check that scope names match exactly (case-sensitive)
- Verify scopes exist in the specified `KC_REALM`

## Development

### Project Structure
```
portalwebhook/
├── server.js              # Main webhook server
├── server_multigateway.js # Multi-gateway variant
├── package.json           # Dependencies
├── .env                   # Environment configuration (not in git)
└── README.md             # This file
```

### Dependencies
- `express`: Web framework
- `dotenv`: Environment variable management

## Security Notes

- **Never commit `.env` files** to version control
- Store sensitive credentials (API keys, passwords) securely
- Use environment-specific `.env` files for different deployments
- Consider using a secrets management service for production

## License

This webhook is part of the Tyk Demo deployment for FDX FAPI compliance.

