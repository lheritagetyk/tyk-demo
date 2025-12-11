# DPoP Implementation for Postman - Complete Guide

This guide provides everything you need to implement DPoP (Demonstrating Proof-of-Possession) in Postman for FAPI 2.0 compliance with Tyk and Keycloak.

## 📋 What's Included

1. **dpop-crypto-helper.js** - CLI tool to generate keys and sign DPoP proofs
2. **dpop-signing-service.js** - Local HTTP service for signing (recommended)
3. **dpop-postman-production.js** - Postman pre-request script
4. **package.json** - Node.js dependencies

## 🚀 Quick Start (Recommended Method)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Generate ES256 Keys

```bash
npm run generate-keys
```

This creates `dpop-keys.json` with your ES256 key pair.

**Output:**
```json
{
  "publicJWK": {
    "kty": "EC",
    "crv": "P-256",
    "x": "...",
    "y": "..."
  },
  "privateJWK": {
    "kty": "EC",
    "crv": "P-256",
    "x": "...",
    "y": "...",
    "d": "..."
  },
  "thumbprint": "...",
  "created": "2025-10-31T..."
}
```

### Step 3: Start the Signing Service

```bash
npm start
```

The service starts on `http://localhost:3000` and provides:
- `POST /generate-dpop` - Generate complete DPoP proofs
- `POST /sign-dpop` - Sign pre-built proofs
- `GET /public-key` - Get your public key
- `GET /health` - Health check

### Step 4: Configure Postman

#### A. Set Environment Variables

In your Postman environment, add:

```
dpop_mode = external
dpop_signing_service_url = http://localhost:3000/generate-dpop
dpop_public_key_jwk = {"kty":"EC","crv":"P-256","x":"...","y":"..."}
access_token = (leave empty initially)
```

#### B. Add Pre-request Script

1. Open your Postman collection or request
2. Go to **Pre-request Script** tab
3. Copy the entire contents of `dpop-postman-production.js`
4. Paste it into the script editor

### Step 5: Test Your Setup

#### Test 1: Token Request (PAR Flow)

```
POST {{auth_server}}/as/par
Headers:
  Content-Type: application/x-www-form-urlencoded
  (DPoP header added automatically by pre-request script)

Body (x-www-form-urlencoded):
  response_type: code
  client_id: {{client_id}}
  redirect_uri: {{redirect_uri}}
  scope: openid accounts
  code_challenge: {{pkce_challenge}}
  code_challenge_method: S256
```

The pre-request script will automatically add:
```
DPoP: eyJhbGciOiJFUzI1NiIsInR5cCI6ImRwb3Arand0IiwiandrIjp7Imt0eSI6IkVDIiw...
```

#### Test 2: Token Exchange

```
POST {{auth_server}}/realms/{{realm}}/protocol/openid-connect/token
Headers:
  Content-Type: application/x-www-form-urlencoded
  (DPoP header added automatically)

Body:
  grant_type: authorization_code
  code: {{authorization_code}}
  redirect_uri: {{redirect_uri}}
  code_verifier: {{pkce_verifier}}
  client_id: {{client_id}}
```

Save the access token from the response:
```json
{
  "access_token": "eyJhbG...",
  "token_type": "DPoP",
  "expires_in": 300
}
```

#### Test 3: API Request with DPoP Token

```
GET {{api_server}}/accounts
Headers:
  Authorization: DPoP {{access_token}}
  (DPoP header with ath claim added automatically)
```

The script will automatically:
1. Hash your access token (SHA-256)
2. Include it in the `ath` claim
3. Generate a new DPoP proof for this specific request

## 📖 Alternative Methods

### Method 2: Pre-generated Proofs (Manual)

If you can't run a local service, generate proofs manually:

```bash
# Generate proof for token request
node dpop-crypto-helper.js sign-dpop \
  --method=POST \
  --url=https://auth.bank.com/realms/bank/protocol/openid-connect/token

# Generate proof for API request with access token
node dpop-crypto-helper.js sign-dpop \
  --method=GET \
  --url=https://api.bank.com/accounts \
  --token=eyJhbGciOi...
```

Then in Postman:
```
dpop_mode = pregenerated
dpop_proof = eyJhbGciOiJFUzI1NiIsInR5cCI6ImRwb3Arand0Iiw...
```

**Note:** Each proof is single-use! Generate a new one for each request.

### Method 3: Simple HMAC (Testing Only)

⚠️ **WARNING:** This uses HMAC instead of ES256. Only for testing the flow!

```
dpop_mode = simple
dpop_public_key_jwk = {"kty":"EC","crv":"P-256","x":"...","y":"..."}
dpop_test_signing_key = my-test-key-not-for-production
```

This will work for testing but won't pass real FAPI 2.0 validation.

## 🔧 Advanced Configuration

### Custom Signing Service Port

```bash
PORT=8080 npm start
```

Update in Postman:
```
dpop_signing_service_url = http://localhost:8080/generate-dpop
```

### Multiple Environments

Create separate key pairs for different environments:

```bash
# Development
node dpop-crypto-helper.js generate-keys
mv dpop-keys.json dpop-keys-dev.json

# Production
node dpop-crypto-helper.js generate-keys
mv dpop-keys.json dpop-keys-prod.json
```

### Nonce Support

Some authorization servers require nonces. The signing service supports this:

```bash
node dpop-crypto-helper.js sign-dpop \
  --method=POST \
  --url=https://auth.bank.com/token \
  --nonce=server-provided-nonce
```

## 🐛 Troubleshooting

### "Keys not found" Error

Make sure you've run:
```bash
npm run generate-keys
```

And the `dpop-keys.json` file exists.

### "Cannot connect to signing service"

1. Check the service is running: `curl http://localhost:3000/health`
2. Verify the URL in Postman environment
3. Check firewall/antivirus isn't blocking port 3000

### "Invalid DPoP proof" from Server

Common causes:
1. **Clock skew** - Check your system time
2. **Wrong URL** - DPoP proof must match EXACT URL (including https://)
3. **Reused proof** - Each proof is single-use, generate a new one
4. **Missing ath** - API calls need access token hash in DPoP proof

### "DPoP proof doesn't match access token"

The `ath` claim must match the SHA-256 hash of your access token. Make sure:
1. You've saved the access token in environment: `access_token`
2. The pre-request script is running before the API request
3. You're not using an expired or different token

## 📝 DPoP Flow Summary

### 1. PAR Request
```
POST /as/par
DPoP: proof_1 (method=POST, url=/as/par)
```

### 2. Authorization Request
```
GET /authorize?request_uri=urn:...
(No DPoP needed - browser redirect)
```

### 3. Token Request
```
POST /token
DPoP: proof_2 (method=POST, url=/token)
Body: grant_type=authorization_code&code=...

Response:
{
  "access_token": "eyJ...",
  "token_type": "DPoP"  ← Notice DPoP type
}
```

### 4. API Request
```
GET /accounts
Authorization: DPoP eyJ...
DPoP: proof_3 (method=GET, url=/accounts, ath=hash_of_token)
```

## 🔐 Security Notes

1. **Private keys** - Never commit `dpop-keys.json` to version control
2. **Proof uniqueness** - Each proof can only be used once
3. **Token binding** - DPoP tokens can only be used with the same key pair
4. **HTTPS only** - DPoP should only be used over HTTPS in production

## 🎯 Testing with Your Tyk + Keycloak Setup

Based on your tyk-bank project with FAPI 2.0:

### Keycloak Configuration
Ensure your client is configured for DPoP:
```json
{
  "clientId": "bank-client",
  "publicClient": false,
  "attributes": {
    "dpop.bound.access.tokens": "true",
    "tls.client.certificate.bound.access.tokens": "false"
  }
}
```

### Tyk Gateway Policy
Your Tyk policy should accept DPoP tokens:
```json
{
  "auth_configs": {
    "oauth": {
      "enabled": true,
      "allowed_access_types": ["dpop"]
    }
  }
}
```

### Test Sequence

1. **Start signing service**: `npm start`
2. **Get PAR**: Request to `/as/par` with DPoP
3. **Authorize**: Browser flow to get auth code
4. **Exchange code**: POST to `/token` with DPoP → get DPoP-bound token
5. **Call API**: GET to Tyk gateway with DPoP-bound token + DPoP proof

## 📚 Additional Resources

- [RFC 9449 - DPoP](https://www.rfc-editor.org/rfc/rfc9449.html)
- [FAPI 2.0 Security Profile](https://openid.net/specs/fapi-2_0-security-profile.html)
- [Keycloak DPoP Documentation](https://www.keycloak.org/docs/latest/securing_apps/#_dpop)

## 💡 Tips

1. Use collection-level pre-request scripts to apply DPoP to all requests
2. Store different key pairs for dev/staging/prod in separate environments
3. The signing service logs all operations - check console for debugging
4. Use Postman's Console (View → Show Postman Console) to see script output

---

Need help? Check the console output from the pre-request script - it shows detailed info about what's happening with your DPoP proofs!
