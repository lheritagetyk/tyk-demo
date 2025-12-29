# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Keycloak running on port 8180
- FDX RI services running
- DPoP signing service dependencies installed

## Step 1: Install Dependencies

```bash
cd fdxwebui
npm install
npm install express cors body-parser jose
```

## Step 2: Set Up DPoP Keys

You have two options:

### Option A: Use Existing Keys (if available)

If you have keys from the `postmandpop/files` directory:

```bash
cp ../postmandpop/files/dpop-keys.json .
```

### Option B: Generate New Keys

```bash
node generate-keys.js
```

This will create `dpop-keys.json` with ES256 key pair in JWK format.

## Step 3: Configure Environment

Create `.env` file (or copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=fapi-demo
VITE_CLIENT_ID=329df529-6f6e-4759-a996-df52882c1fb8
VITE_REDIRECT_URI=http://localhost:3002/callback

VITE_DPOP_SERVICE_URL=http://localhost:3010

VITE_FDX_CORE_API_URL=http://tyk-gateway.localhost:8080/account-information/
VITE_FDX_CUSTOMER_API_URL=http://tyk-gateway.localhost:8080/fdxri/
```

## Step 4: Start DPoP Signing Service

In terminal 1:

```bash
node dpop-signing-service.js
```

You should see:
```
🚀 DPoP Signing Service running!
📡 Server: http://localhost:3010
```

## Step 5: Start Web Application

In terminal 2:

```bash
npm run dev
```

The application will be available at `http://localhost:3002`

## Step 6: Use the Application

1. **Start OAuth Flow**: Click "Start OAuth Flow" button
2. **Authorize**: Complete authorization in the popup window
3. **View API Calls**: All API calls appear in the left pane with full details
4. **Browse Data**: 
   - Select a customer from the Teller view
   - View their accounts
   - Select an account to see transactions

## Troubleshooting

### DPoP Service Not Available

- Check that `dpop-signing-service.js` is running
- Verify `dpop-keys.json` exists and is valid
- Check port 3010 is not in use

### OAuth Flow Fails

- Verify Keycloak is running and accessible
- Check client ID matches Keycloak configuration
- Ensure redirect URI is whitelisted in Keycloak client settings

### API Calls Fail

- Verify FDX APIs are running
- Check access token is valid (not expired)
- Review API Call pane for detailed error messages

### No Data Displayed

- Ensure OAuth flow completed successfully
- Check API Call pane for errors
- Verify FDX APIs are returning data

## Features

- **Complete OAuth Flow**: PAR → Authorization → Token Exchange → DPoP API Calls
- **API Monitoring**: Real-time logging of all API requests/responses
- **DPoP Details**: View DPoP proofs and validation details
- **Teller View**: Three-panel interface for customers, accounts, and transactions
- **Error Handling**: Detailed error messages and troubleshooting info

## Next Steps

- Customize the UI styling
- Add more FDX API endpoints
- Implement token refresh
- Add export functionality for API call logs

