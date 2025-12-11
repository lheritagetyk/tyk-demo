# DPoP for Postman - Quick Start Guide

## ⚡ 5-Minute Setup

### Prerequisites
- Node.js installed (v18+)
- Postman installed

### Step 1: Install & Generate Keys (2 minutes)

```bash
# Install dependencies
npm install

# Generate ES256 key pair
npm run generate-keys
```

**Output**: `dpop-keys.json` file created with your keys

### Step 2: Start Signing Service (30 seconds)

```bash
npm start
```

You should see:
```
🚀 DPoP Signing Service running!
📡 Server: http://localhost:3000
✓ Ready to sign DPoP proofs!
```

### Step 3: Configure Postman (2 minutes)

#### A. Create/Select Environment

In Postman, create a new environment or select existing one.

#### B. Add Required Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `dpop_mode` | `external` | Use signing service |
| `dpop_signing_service_url` | `http://localhost:3000/generate-dpop` | Signing service URL |
| `auth_server` | `https://your-keycloak.com` | Your Keycloak URL |
| `api_server` | `https://your-tyk-gateway.com` | Your Tyk Gateway URL |
| `realm` | `bank` | Your Keycloak realm |
| `client_id` | `bank-client` | Your OAuth client ID |
| `redirect_uri` | `https://oauth.pstmn.io/v1/callback` | OAuth callback |

#### C. Generate PKCE Parameters

```bash
node generate-pkce.js
```

Copy the output and add to your Postman environment:
- `pkce_verifier`
- `pkce_challenge`

#### D. Add Pre-request Script

1. Open your collection in Postman
2. Click on the collection name
3. Go to **Pre-request Scripts** tab
4. Copy the entire contents of `dpop-postman-final.js`
5. Paste into the script editor
6. Save

### Step 4: Import Collection (30 seconds)

1. In Postman, click **Import**
2. Select `postman-collection-example.json`
3. Click **Import**

### Step 5: Test! (1 minute)

Run the requests in order:

1. **PAR Request** - Get request_uri
2. **Authorization** - Open in browser, login, copy code
3. **Token Request** - Get DPoP-bound token
4. **Get Accounts** - Call API with DPoP token

✅ If all succeed, your DPoP setup is working!

## 🎯 What's Happening?

### On Each Request:

1. **Pre-request script runs**
   ```
   → Checks dpop_mode (external)
   → Calls signing service at localhost:3000
   → Sends method + URL + access_token (if applicable)
   ```

2. **Signing service**
   ```
   → Loads your private key
   → Builds DPoP proof payload with jti, htm, htu, iat, ath
   → Signs with ES256
   → Returns JWT
   ```

3. **Pre-request script**
   ```
   → Receives signed DPoP proof
   → Adds as "DPoP" header to request
   → Request proceeds with DPoP header
   ```

4. **Server validates**
   ```
   → Verifies DPoP signature
   → Checks method/URL match
   → Validates access token binding (ath)
   → Grants access if valid
   ```

## 🔍 Troubleshooting

### "Cannot connect to signing service"

**Solution**: Make sure service is running
```bash
npm start
```

Check: `curl http://localhost:3000/health`

### "Invalid DPoP proof"

**Common causes**:
1. Clock skew - check system time
2. URL mismatch - ensure exact URL (https://...)
3. Reused proof - each is single-use
4. Missing ath - API calls need access token hash

**Debug**: Check Postman Console (View → Show Postman Console)

### "DPoP header not added"

**Check**:
1. Pre-request script is saved
2. Environment is selected
3. dpop_mode is set to "external"
4. Signing service is running

### Request shows no DPoP header

**Solution**: Open Postman Console to see pre-request script logs

The script logs:
```
=================================================
    DPoP Proof Generator
=================================================
Mode: external
Request: POST https://...
✅ DPoP proof added to request
```

## 📊 Verification Checklist

- [ ] `npm install` completed
- [ ] `dpop-keys.json` exists
- [ ] `npm start` shows "Ready to sign DPoP proofs"
- [ ] Postman environment variables set
- [ ] Pre-request script added to collection
- [ ] PKCE parameters generated
- [ ] Test requests succeed

## 🎓 Understanding DPoP

### Token Request
```
POST /token
DPoP: eyJ... (proof with jti, htm=/token, htu=https://...)

Response:
{
  "access_token": "...",
  "token_type": "DPoP"  ← Token is bound to your key!
}
```

### API Request
```
GET /accounts
Authorization: DPoP <token>
DPoP: eyJ... (NEW proof with ath=hash_of_token)
```

### Key Points

1. **Each request needs unique DPoP proof** - Never reuse!
2. **DPoP binds token to key** - Token only works with your private key
3. **ath claim proves token possession** - Server validates you have the token
4. **HTTP method + URL must match** - Proof is specific to request

## 🚀 Next Steps

1. **Test with your real Keycloak + Tyk**
   - Update environment variables
   - Configure Keycloak client for DPoP
   - Set up Tyk policy for DPoP tokens

2. **Customize for your flow**
   - Add nonce support if needed
   - Handle token refresh
   - Implement error handling

3. **Production deployment**
   - Secure key storage
   - Consider hardware security modules
   - Implement key rotation

## 📚 Additional Files

- `README.md` - Comprehensive documentation
- `dpop-crypto-helper.js` - CLI for manual operations
- `test-dpop.js` - Verify your setup
- `generate-pkce.js` - Generate PKCE parameters

## 💡 Pro Tips

- Use collection-level pre-request script for all requests
- Keep signing service running during Postman session
- Generate fresh PKCE for each auth flow
- Check Postman Console for detailed logs
- Use `npm test` to verify setup

---

**Need help?** Check the full README.md for detailed documentation!
