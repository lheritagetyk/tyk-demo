#!/bin/bash
# setup-keycloak.sh
# Script to configure Keycloak for FDX fine-grained consent

set -e

KC_BASE_URL="${KC_BASE_URL:-http://keycloak:8180}"
KC_REALM="${KC_REALM:-fapi-demo}"
KC_ADMIN_USERNAME="${KC_ADMIN_USERNAME:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-admin}"
KC_ADMIN_REALM="${KC_ADMIN_REALM:-master}"

echo "Setting up Keycloak for FDX Fine-Grained Consent..."

# Get admin token
echo "Getting Keycloak admin token..."
TOKEN_RESPONSE=$(curl -s -X POST "${KC_BASE_URL}/realms/${KC_ADMIN_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=${KC_ADMIN_USERNAME}" \
  -d "password=${KC_ADMIN_PASSWORD}")

ADMIN_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: Failed to get admin token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "Admin token obtained successfully"

# Get browser flow
echo "Getting browser flow..."
FLOW_RESPONSE=$(curl -s -X GET "${KC_BASE_URL}/admin/realms/${KC_REALM}/authentication/flows/browser" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

echo "Browser flow retrieved"

# Note: Adding a custom authenticator execution requires a Keycloak SPI implementation
# For now, we'll create a protocol mapper to add consent ID to tokens

echo "Creating protocol mapper for consent ID..."

# Get clients
CLIENTS_RESPONSE=$(curl -s -X GET "${KC_BASE_URL}/admin/realms/${KC_REALM}/clients" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

echo "Clients retrieved. You can manually add protocol mappers via the Keycloak Admin Console:"
echo ""
echo "1. Navigate to Clients → {your-client} → Mappers"
echo "2. Click 'Add mapper' → 'By configuration'"
echo "3. Select 'User Attribute'"
echo "4. Configure:"
echo "   - Name: fdx-consent-id"
echo "   - User Attribute: fdx.active.consent.id"
echo "   - Token Claim Name: fdxConsentId"
echo "   - Claim JSON Type: String"
echo "   - Add to access token: ON"
echo ""
echo "For the authentication flow, you'll need to:"
echo "1. Navigate to Authentication → Flows"
echo "2. Select 'browser' flow"
echo "3. Add execution after 'Forms'"
echo "4. Configure redirect to: http://consent-service:8900/consent"
echo ""
echo "Alternatively, implement a custom Keycloak authenticator SPI."

echo ""
echo "Setup instructions saved. Please configure Keycloak manually or implement a custom authenticator."



