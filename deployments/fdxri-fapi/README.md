# FDX Reference Implementation - FAPI 2.0 Deployment

This deployment provides a complete Financial Data Exchange (FDX) Reference Implementation with FAPI 2.0 (Financial-grade API) security profile support, integrated with Tyk Gateway, Tyk Portal, and Keycloak for OAuth2/OIDC authentication and authorization.

## 📋 Overview

This deployment implements:
- **FDX Core API v6.2.0** - Financial Data Exchange Core API with account, transaction, and payment capabilities
- **FAPI 2.0 Security Profile** - DPoP (Demonstrating Proof-of-Possession) token binding, PAR (Pushed Authorization Requests), and enhanced security
- **Dynamic Client Registration (DCR)** - Automated client registration via Tyk Portal
- **Keycloak Integration** - OAuth2/OIDC provider with FAPI 2.0 compliant configuration
- **Tyk API Gateway** - API management, rate limiting, and security policies
- **Tyk Developer Portal** - Self-service developer portal with OAuth client management

## 🏗️ Architecture

```
┌─────────────────┐
│  Tyk Portal     │ ──► OAuth Client Registration
│  (Developer)    │ ──► Product Catalog
└────────┬────────┘
         │
         │ Webhook
         ▼
┌─────────────────┐
│  Portal Webhook │ ──► Updates Keycloak Client Config
│  (Node.js)      │ ──► Sets Consent & Scopes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tyk Gateway    │ ──► API Routing & Policies
│                 │ ──► OAuth Token Validation
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Keycloak       │◄────│  OAuth Clients   │
│  (Auth Server)  │     │  (DCR)           │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  FDX RI         │
│  (Tomcat)       │ ──► Account APIs
│                 │ ──► Transaction APIs
│                 │ ──► Payment APIs
└─────────────────┘
```

## 🚀 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for portal webhook)
- Access to FDX Docker registry (credentials in `key/fdx_ri_copy.json`)
- Tyk Demo deployment with Portal and Keycloak DCR services

## 📦 Components

### Core Services

1. **FDX Reference Implementation (Tomcat)**
   - FDX Core API v6.2.0 implementation
   - PostgreSQL database backend
   - Exposed on port `8090`

2. **Keycloak**
   - OAuth2/OIDC authorization server
   - FAPI 2.0 realm configuration
   - DCR support
   - Exposed on port `8180`

3. **Tyk Gateway**
   - API gateway and management
   - OAuth token validation
   - Rate limiting and policies

4. **Tyk Portal**
   - Developer self-service portal
   - OAuth client registration
   - Product catalog management
   - Exposed on port `3100`

5. **Portal Webhook Service**
   - Node.js Express service
   - Listens for Tyk Portal webhook events
   - Automatically configures Keycloak clients with scopes and consent settings
   - Runs on port `8899`

## 🔧 Setup Instructions

### 1. Start Prerequisites

First, bring up the required Tyk services:

```bash
./up.sh portal keycloak-dcr
```

### 2. Configure Portal Webhook

1. **Get Portal Admin API Key**
   - Login to Tyk Portal as Admin
   - Navigate to Settings → API Keys
   - Copy the Portal Admin API Key

2. **Update Webhook Configuration**
   
   Edit `portalwebhook/server.js` and update the `TYK_PORTAL_ADMIN_API_KEY`:
   
   ```javascript
   TYK_PORTAL_ADMIN_API_KEY="your-portal-admin-api-key-here"
   ```
   
   **Note:** This key changes every time you restart the Tyk Portal service.

3. **Install Dependencies and Start Webhook**
   
   ```bash
   cd portalwebhook
   npm install
   node server.js
   ```
   
   The webhook will listen on `http://localhost:8899/webhooks/tyk`

### 3. Run Bootstrap Script

The bootstrap script automates the entire setup:

```bash
./bootstrap.sh
```

This script will:
- ✅ Login to FDX Docker registry
- ✅ Start FDX RI containers (PostgreSQL and Tomcat)
- ✅ **Restore Keycloak FAPI realm configuration** (creates `fapi-demo` realm, FAPI 2.0 profiles, DPoP, PAR)
- ✅ Create APIs in Tyk Dashboard:
  - FDX Core API
  - FDX Core FAPI API
  - UK Accounts and Transactions API
  - Payment Initiation API
- ✅ Create Tyk Policies:
  - UK Open Banking FAPI Policy
  - FDX Policy
  - FDX NoOp Policy
  - FDX Core Account Basic Policy
- ✅ Create Products in Tyk Portal:
  - FDX Core Product
  - UK and FDX Core FAPI Product
- ✅ Configure OAuth Provider (FDX DCR Provider)
- ✅ Create Client Type (FDX End User)
- ✅ Link client types to products
- ✅ Import users into Keycloak
- ✅ Import FDX scopes into Keycloak

**Note:** The bootstrap script automatically sets up the Keycloak `fapi-demo` realm with all FAPI 2.0 configurations, so no manual Keycloak setup is required.

## 📁 Directory Structure

```
fdxri-fapi/
├── apis/                          # API OpenAPI specifications
│   ├── fdxapi-core.json
│   ├── fdxapi-core-fapi.json
│   └── ...
├── bootstrap.sh                   # Main bootstrap script
├── data/
│   ├── tyk-dashboard/            # Tyk Dashboard API & Policy configs
│   └── tyk-portal/               # Tyk Portal product configs
├── fapi-setup/
│   ├── export-restore/           # Keycloak realm backup/restore
│   └── ukaccounts/               # UK Open Banking API specs
├── portalwebhook/                # Portal webhook service
│   └── server.js                 # Webhook server
├── postmandpop/                   # DPoP testing tools
│   └── files/                    # Postman collection & DPoP helpers
├── fdxscopes.json                # FDX scope definitions
├── users.json                    # Keycloak user seed data
└── docker-compose.yml            # FDX RI service definitions
```

## 🔐 Key Features

### FAPI 2.0 Security Profile

- **DPoP (Demonstrating Proof-of-Possession)**: Token binding using cryptographic proofs
- **PAR (Pushed Authorization Requests)**: Enhanced security for authorization requests
- **PKCE (Proof Key for Code Exchange)**: S256 code challenge method
- **ES256 Token Signing**: Elliptic curve signatures for tokens
- **Consent Management**: User consent screens with scope descriptions

### Dynamic Client Registration (DCR)

- Automatic OAuth client creation when developers register in Tyk Portal
- Client configuration synchronized between Tyk Portal and Keycloak
- Scope assignment based on product subscriptions

### Portal Webhook Integration

The webhook service (`portalwebhook/server.js`) automatically:
- Configures Keycloak clients with required scopes
- Sets up consent screens with appropriate text
- Enables FAPI 2.0 security features (DPoP, PAR, PKCE)
- Maps Tyk Portal applications to Keycloak clients

### FDX Scopes

The deployment includes comprehensive FDX scopes:
- `openid` - OpenID Connect
- `fdx:account.basic:read` - Basic account information
- `fdx:account.detail:read` - Detailed account information
- `fdx:transaction:read` - Transaction history
- `fdx:payment:write` - Payment initiation
- `fdx:statement:read` - Account statements
- `fdx:customer:read` - Customer profile
- `fdx:balance:read` - Account balance
- And more...

## 🧪 Testing

### Using Postman with DPoP

The `postmandpop/` directory contains tools for testing FAPI 2.0 flows:

1. **Generate DPoP Keys**
   ```bash
   cd postmandpop/files
   npm install
   npm run generate-keys
   ```

2. **Start DPoP Signing Service**
   ```bash
   npm start
   ```

3. **Import Postman Collection**
   - Import `FAPI 2.0 DPoP Flow - Tyk + Keycloak.postman_collection.json`
   - Import `FAPI DPop.postman_environment.json`
   - Configure environment variables

See `postmandpop/files/README.md` for detailed instructions.

### API Endpoints

- **FDX Core API**: `http://localhost:8090/fdxapi`
- **Tyk Gateway (FDX FAPI)**: `http://tyk-gateway.localhost:8080/fdxfapi`
- **Tyk Portal**: `http://tyk-portal.localhost:3100`
- **Keycloak**: `http://keycloak:8180` (internal) or `http://localhost:8180` (if exposed)
- **Portal Webhook**: `http://localhost:8899/webhooks/tyk`

## 🔍 Troubleshooting

### Bootstrap Fails

1. **Check service availability**
   ```bash
   curl http://tyk-portal.localhost:3100/ready
   curl http://keycloak:8180/realms/master
   ```

2. **Verify Portal Admin API Key**
   - Ensure the key in `portalwebhook/server.js` is current
   - Keys change when Portal restarts

3. **Check logs**
   ```bash
   tail -f logs/bootstrap.log
   ```

### Webhook Not Working

1. **Verify webhook is running**
   ```bash
   curl http://localhost:8899/healthz
   ```

2. **Check webhook logs** for errors

3. **Verify Portal Admin API Key** is correct and current

4. **Test webhook manually**
   ```bash
   curl -X POST http://localhost:8899/webhooks/tyk \
     -H "Content-Type: application/json" \
     -d '{"Message":{"AppID":"test-app-id"}}'
   ```

### Keycloak Client Scopes Not Appearing

The webhook uses Keycloak's dedicated API endpoints to add scopes. If scopes aren't appearing:

1. Check webhook logs for scope addition messages
2. Verify scopes exist in Keycloak realm
3. Check Keycloak admin API access
4. Ensure webhook has correct Keycloak credentials

### DCR Registration Fails

1. **Check Initial Access Token**
   - Bootstrap script creates an initial access token
   - Verify it's valid: `curl http://keycloak:8180/realms/fapi-demo/.well-known/openid-configuration`

2. **Verify OAuth Provider Configuration**
   - Check Tyk Portal OAuth providers
   - Ensure WellKnownURL is correct
   - Verify RegistrationAccessToken is set

## 📚 Additional Resources

- [FAPI 2.0 Security Profile](https://openid.net/specs/fapi-2_0-security-profile.html)
- [DPoP RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html)
- [FDX API Documentation](https://financialdataexchange.org/)
- [Tyk Documentation](https://tyk.io/docs/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)

## 🔄 Maintenance

### Updating Portal Admin API Key

The Portal Admin API Key changes when Tyk Portal restarts. Update it in:
- `portalwebhook/server.js` - `TYK_PORTAL_ADMIN_API_KEY`

### Adding New Scopes

1. Add scope definition to `fdxscopes.json`
2. Update `portalwebhook/server.js` - `defaultScopesToAdd` array
3. Re-run bootstrap or manually import scopes to Keycloak

### Restoring Keycloak Configuration

```bash
cd fapi-setup/export-restore
./restorekeycloak.sh
```

## 📝 Notes

- The FDX RI Docker images require authentication to the FDX registry
- Credentials are stored in `key/fdx_ri_copy.json`
- The webhook service must be running for automatic client configuration
- All services must be on the same Docker network (`tyk-demo_tyk`)

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review service logs
3. Verify all prerequisites are met
4. Ensure all services are running and accessible

---

**Last Updated**: Based on FDX RI v6.2.0 and FAPI 2.0 Security Profile
