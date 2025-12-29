# FDX Open Banking Flow Web UI

A comprehensive web application showcasing the complete Open Banking flow from PAR (Pushed Authorization Request) to DPoP (Demonstrating Proof-of-Possession), with a Teller view for displaying customer accounts and transactions.

## Features

- **Complete OAuth Flow**: PAR → Authorization → Token Exchange → DPoP API Calls
- **API Call Monitoring**: Real-time display of all API requests and responses with DPoP proof details
- **Teller View**: Three-panel interface showing:
  - Customers (from FDX Customer API)
  - Accounts (from FDX Core API)
  - Transactions (from FDX Core API)

## Architecture

- **Frontend**: React 18 with Vite
- **DPoP Signing**: Separate Node.js service for cryptographic signing
- **APIs**: FDX Customer API and FDX Core API
- **Authentication**: Keycloak with FAPI 2.0 DPoP flow

## Prerequisites

- Node.js 18+ and npm
- Keycloak running with FAPI 2.0 DPoP enabled
- FDX RI services running (Customer API and Core API)
- DPoP signing service (included)

## Setup

### 1. Install Dependencies

```bash
cd fdxwebui
npm install
```

### 2. Install DPoP Signing Service Dependencies

```bash
npm install express cors body-parser jose
```

### 3. Generate DPoP Keys

You need to generate ES256 key pairs for DPoP signing. You can use the existing key generation script from the postmandpop directory:

```bash
# Copy the key generation script or use an existing one
# The keys should be in JWK format and saved as dpop-keys.json
```

Or generate keys using Node.js:

```bash
node -e "
const { generateKeyPair } = require('jose');
generateKeyPair('ES256').then(async (keyPair) => {
  const publicJWK = await keyPair.publicKey.export({ format: 'jwk' });
  const privateJWK = await keyPair.privateKey.export({ format: 'jwk' });
  const crypto = require('crypto');
  const thumbprint = crypto.createHash('sha256')
    .update(JSON.stringify(publicJWK))
    .digest('base64url');
  console.log(JSON.stringify({ publicJWK, privateJWK, thumbprint }, null, 2));
}).then(keys => {
  require('fs').writeFileSync('dpop-keys.json', JSON.stringify(keys, null, 2));
  console.log('Keys saved to dpop-keys.json');
});
"
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and update with your configuration:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:
- Keycloak URL and realm
- Client ID
- FDX API URLs
- DPoP service URL

### 5. Start DPoP Signing Service

In one terminal:

```bash
node dpop-signing-service.js
```

The service will run on port 3010 by default.

### 6. Start the Web Application

In another terminal:

```bash
npm run dev
```

The application will be available at `http://localhost:3002`

## Usage

1. **Start OAuth Flow**: Click "Start OAuth Flow" in the left pane
2. **Authorize**: Complete the authorization in the popup window
3. **View API Calls**: All API calls are logged in the API Call pane with full request/response details
4. **Browse Customers**: Select a customer from the Teller view
5. **View Accounts**: Accounts for the selected customer will appear
6. **View Transactions**: Select an account to see its transactions

## API Call Monitoring

The API Call pane shows:
- Request method and URL
- Request headers (including DPoP proof preview)
- Request body
- Response status and data
- Duration
- Error details (if any)

Click on any API call to see full details including:
- Complete DPoP proof
- Request/response headers
- Full request/response bodies

## Teller View

The Teller view consists of three panels:

1. **Customers Panel**: Lists all customers from the FDX Customer API
2. **Accounts Panel**: Shows accounts for the selected customer
3. **Transactions Panel**: Displays transactions for the selected account

## DPoP Flow Details

The application demonstrates:

1. **PAR Request**: Pushed Authorization Request with DPoP proof
2. **Authorization**: User authorization via Keycloak
3. **Token Exchange**: Exchange authorization code for DPoP-bound access token
4. **API Calls**: All FDX API calls use DPoP tokens with fresh proofs for each request

Each API call includes:
- DPoP proof in the `DPoP` header
- Access token in `Authorization: DPoP <token>` header
- Proof includes `ath` (access token hash) claim for API calls

## Troubleshooting

### DPoP Service Not Available

- Ensure the DPoP signing service is running on port 3010
- Check that `dpop-keys.json` exists and contains valid JWK format keys

### OAuth Flow Fails

- Verify Keycloak is running and accessible
- Check that the client ID matches your Keycloak configuration
- Ensure redirect URI is whitelisted in Keycloak

### API Calls Fail

- Verify FDX APIs are running and accessible
- Check that the access token is valid and not expired
- Ensure DPoP proofs are being generated correctly

### No Customers/Accounts/Transactions

- Verify you're authenticated (OAuth flow completed)
- Check that the FDX APIs are returning data
- Review the API Call pane for error details

## Development

### Project Structure

```
fdxwebui/
├── src/
│   ├── components/       # React components
│   │   ├── OAuthFlow.jsx
│   │   ├── ApiCallPane.jsx
│   │   └── TellerView.jsx
│   ├── services/         # Service modules
│   │   ├── oauthService.js
│   │   ├── dpopService.js
│   │   ├── fdxApiService.js
│   │   └── apiLogger.js
│   ├── App.jsx           # Main application
│   └── main.jsx          # Entry point
├── dpop-signing-service.js  # DPoP signing service
├── package.json
└── vite.config.js
```

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## License

Part of the FDX Reference Implementation demo.

