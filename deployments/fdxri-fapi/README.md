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
- Access to FDX Docker registry (credentials in `key/fdx_ri_copy.json`)
- Tyk Demo deployment with Portal and Keycloak DCR services
- Required hostnames in `/etc/hosts`:
  - `tyk-gateway.localhost` → `127.0.0.1`
  - `tyk-portal.localhost` → `127.0.0.1`
  - `tyk-dashboard.localhost` → `127.0.0.1`

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

5. **Portal Webhook Service** (Containerized)
   - Node.js Express service in Docker container
   - Listens for Tyk Portal webhook events
   - Automatically configures Keycloak clients with scopes and consent settings
   - Configuration via `.env` file (auto-updated by bootstrap.sh)
   - Runs on port `8899`
   - Health check endpoint: `/healthz`

6. **Tyk gRPC Plugin** (Containerized)
   - Go-based gRPC plugin for Tyk Gateway
   - Implements DPoP validation and FAPI 2.0 compliance
   - Runs on port `5555`
   - Communicates with Tyk Gateway via gRPC

7. **FDX Web UI** (Containerized)
   - React-based web application for testing FDX APIs
   - DPoP signing service (port `3010`)
   - Vite development server (port `3030`)
   - Hot-reload enabled for development
   - OAuth 2.0 flow with DPoP support

## 🔧 Setup Instructions

### 1. Start Prerequisites

First, bring up the required Tyk services:

```bash
./up.sh portal fdxri-fapi
```

This will start:
- Tyk Gateway
- Tyk Dashboard
- Tyk Portal
- Keycloak (with DCR support)
- FDX RI services (PostgreSQL, Tomcat)
- Containerized services (tyk-grpc-plugin, portalwebhook, fdxwebui)

### 2. Configuration Files

#### Portal Webhook `.env` File

The portalwebhook service uses a `.env` file for configuration. The bootstrap script automatically:
- Creates the `.env` file if it doesn't exist
- Updates `TYK_PORTAL_ADMIN_API_KEY` with the token retrieved from Tyk Portal

**Location**: `deployments/fdxri-fapi/portalwebhook/.env`

**Required Variables**:
```env
# Tyk Portal Admin API Configuration
TYK_PORTAL_BASE_URL=http://tyk-portal.localhost:3100
TYK_PORTAL_ADMIN_API_KEY=<auto-populated by bootstrap.sh>

# Keycloak Configuration
KC_BASE_URL=http://keycloak:8180
KC_REALM=fapi-demo
KC_ADMIN_USERNAME=admin
KC_ADMIN_PASSWORD=admin
KC_ADMIN_REALM=master
KC_ADMIN_CLIENT_ID=admin-cli

# Defaults applied if webhook doesn't send them
DEFAULT_CONSENT_TEXT=This app will access your account data to provide personalized services.
DEFAULT_LOGIN_THEME=bank-theme

# Server Port
PORT=8899
```

**Note**: The `TYK_PORTAL_ADMIN_API_KEY` is automatically updated by `bootstrap.sh` - you don't need to manually configure it.

#### FDX Web UI Environment Variables

The fdxwebui container uses environment variables set in `docker-compose.yml`:

```yaml
environment:
  - VITE_KEYCLOAK_URL=http://keycloak:8180
  - VITE_KEYCLOAK_REALM=fapi-demo
  - VITE_CLIENT_ID=fdx-sample-webapp
  - VITE_REDIRECT_URI=http://localhost:3030/callback
  - VITE_DPOP_SERVICE_URL=http://localhost:3010
  - VITE_FDX_CORE_API_URL=http://tyk-gateway.localhost:8080/fdxfapi
  - VITE_FDX_CUSTOMER_API_URL=http://tyk-gateway.localhost:8080/fdxapi
```

You can override these by setting environment variables in the main `.env` file or docker-compose.yml.

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
- ✅ **Update portalwebhook `.env` file** with Portal Admin API token
- ✅ **Start tyk-grpc-plugin container** (gRPC service on port 5555)
- ✅ **Start portalwebhook container** (webhook service on port 8899)
- ✅ **Start fdxwebui container** (DPoP service on port 3010, UI on port 3030)

**Note:** The bootstrap script automatically sets up the Keycloak `fapi-demo` realm with all FAPI 2.0 configurations, so no manual Keycloak setup is required. All services are containerized and started automatically.

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
├── portalwebhook/                # Portal webhook service (containerized)
│   ├── server.js                 # Webhook server
│   ├── Dockerfile                # Container definition
│   ├── .env                      # Configuration (auto-updated by bootstrap)
│   └── README.md                 # Webhook documentation
├── tyk-grpc-plugin/              # Tyk gRPC plugin (containerized)
│   ├── main.go                   # Plugin source code
│   ├── Dockerfile                # Container definition
│   └── proto/                    # Protocol buffer definitions
├── fdxwebui/                     # FDX Web UI (containerized)
│   ├── src/                      # React application source
│   ├── Dockerfile                # Container definition
│   ├── dpop-signing-service.js  # DPoP signing service
│   └── vite.config.js           # Vite configuration
├── postmandpop/                   # DPoP testing tools
│   └── files/                    # Postman collection & DPoP helpers
├── fdxscopes.json                # FDX scope definitions
├── users.json                    # Keycloak user seed data
└── docker-compose.yml            # All service definitions (FDX RI, Keycloak, containers)
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

### Service Endpoints and Ports

| Service | URL | Port | Description |
|---------|-----|------|-------------|
| **FDX RI (Tomcat)** | `http://localhost:8090/fdxapi` | 8090 | FDX Reference Implementation API |
| **Tyk Gateway (FDX FAPI)** | `http://tyk-gateway.localhost:8080/fdxfapi` | 8080 | Tyk Gateway with FAPI policies |
| **Tyk Gateway (FDX Customer)** | `http://tyk-gateway.localhost:8080/fdxapi` | 8080 | Tyk Gateway for customer APIs |
| **Tyk Portal** | `http://tyk-portal.localhost:3100` | 3100 | Developer Portal |
| **Tyk Dashboard** | `http://tyk-dashboard.localhost:3000` | 3000 | API Management Dashboard |
| **Keycloak** | `http://localhost:8180` | 8180 | OAuth2/OIDC Authorization Server |
| **Keycloak (internal)** | `http://keycloak:8180` | 8180 | Internal Docker network address |
| **Portal Webhook** | `http://localhost:8899/webhooks/tyk` | 8899 | Webhook endpoint for Portal events |
| **Portal Webhook Health** | `http://localhost:8899/healthz` | 8899 | Health check endpoint |
| **Tyk gRPC Plugin** | `tcp://localhost:5555` | 5555 | gRPC service for Tyk Gateway |
| **FDX Web UI** | `http://localhost:3030` | 3030 | React web application |
| **DPoP Signing Service** | `http://localhost:3010` | 3010 | DPoP proof generation service |
| **PostgreSQL (FDX RI)** | `localhost:7432` | 7432 | FDX RI database |
| **PostgreSQL (Keycloak)** | `localhost:25432` | 25432 | Keycloak database |

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

1. **Verify webhook container is running**
   ```bash
   docker ps | grep portalwebhook
   curl http://localhost:8899/healthz
   ```

2. **Check webhook container logs**
   ```bash
   docker logs portalwebhook-fapi
   ```

3. **Verify Portal Admin API Key** in `.env` file
   ```bash
   cat deployments/fdxri-fapi/portalwebhook/.env | grep TYK_PORTAL_ADMIN_API_KEY
   ```
   The bootstrap script should have automatically updated this.

4. **Verify .env file is mounted correctly**
   ```bash
   docker exec portalwebhook-fapi cat /app/.env
   ```

5. **Test webhook manually**
   ```bash
   curl -X POST http://localhost:8899/webhooks/tyk \
     -H "Content-Type: application/json" \
     -d '{"Message":{"AppID":"test-app-id"}}'
   ```

### Container Issues

1. **Check all containers are running**
   ```bash
   docker ps | grep -E "fdxri-fapi|portalwebhook|tyk-grpc|fdxwebui"
   ```

2. **View container logs**
   ```bash
   docker logs portalwebhook-fapi
   docker logs tyk-grpc-plugin-fapi
   docker logs fdxwebui
   ```

3. **Rebuild containers if needed**
   ```bash
   cd deployments/fdxri-fapi
   docker compose build portalwebhook tyk-grpc-plugin fdxwebui
   docker compose up -d portalwebhook tyk-grpc-plugin fdxwebui
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

The Portal Admin API Key changes when Tyk Portal restarts. The bootstrap script automatically updates it in:
- `portalwebhook/.env` - `TYK_PORTAL_ADMIN_API_KEY` (auto-updated by bootstrap.sh)

If you need to manually update it:
```bash
# Edit the .env file
nano deployments/fdxri-fapi/portalwebhook/.env

# Or update via sed (replace YOUR_KEY_HERE with actual key)
sed -i '' 's|TYK_PORTAL_ADMIN_API_KEY=.*|TYK_PORTAL_ADMIN_API_KEY=YOUR_KEY_HERE|' \
  deployments/fdxri-fapi/portalwebhook/.env

# Restart the container to pick up changes
docker restart portalwebhook-fapi
```

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
- All services are containerized and managed via Docker Compose
- The webhook service automatically starts with the deployment
- All services must be on the same Docker network (`tyk` or `tyk-demo_tyk`)
- The portalwebhook `.env` file is automatically created/updated by bootstrap.sh
- fdxwebui supports hot-reload for development (source code is mounted as volumes)
- tyk-grpc-plugin and portalwebhook are built from source during deployment

## 🐳 Docker Services

The deployment includes the following containerized services:

### Core Services
- **postgres** - FDX RI database (port 7432)
- **tomcat** - FDX Reference Implementation (port 8090)
- **keycloak-db** - Keycloak database (port 25432)
- **keycloak** - OAuth2/OIDC server (port 8180)

### Containerized Services
- **tyk-grpc-plugin** - gRPC plugin for Tyk Gateway (port 5555)
- **portalwebhook** - Portal webhook service (port 8899)
- **fdxwebui** - Web UI and DPoP service (ports 3010, 3030)

All services are defined in `docker-compose.yml` and started automatically by the bootstrap script.

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review service logs
3. Verify all prerequisites are met
4. Ensure all services are running and accessible

---

**Last Updated**: Based on FDX RI v6.2.0 and FAPI 2.0 Security Profile
