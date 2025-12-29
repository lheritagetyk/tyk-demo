#!/bin/bash

# Script to create FDX scopes in Keycloak
# Usage: ./create-fdx-scopes.sh

set -e

KEYCLOAK_URL="http://localhost:8180"
REALM="fapi-demo"
SCOPES_FILE="../../fdxscopes.json"

echo "🔄 Creating FDX scopes in Keycloak..."

# Get admin token
echo "📝 Getting admin token..."
ADMIN_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
  echo "❌ Failed to get admin token"
  exit 1
fi

echo "✅ Admin token obtained"

# Read scopes from JSON file and create them
echo "📥 Creating FDX scopes from $SCOPES_FILE..."

# Use jq to iterate through each scope in the JSON array
jq -c '.[]' "$SCOPES_FILE" | while read -r scope; do
  scope_name=$(echo "$scope" | jq -r '.name')
  scope_description=$(echo "$scope" | jq -r '.description')
  scope_type=$(echo "$scope" | jq -r '.type // "DEFAULT"')
  
  # Check if scope already exists
  EXISTING_SCOPE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$KEYCLOAK_URL/admin/realms/$REALM/client-scopes/$scope_name" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  if [ "$EXISTING_SCOPE" = "200" ]; then
    echo "⚠️  Scope '$scope_name' already exists, skipping..."
    continue
  fi
  
  # Create the scope
  echo "  Creating scope: $scope_name"
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$KEYCLOAK_URL/admin/realms/$REALM/client-scopes" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$scope")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "409" ]; then
    echo "  ✅ Scope '$scope_name' created"
  else
    echo "  ❌ Failed to create scope '$scope_name' (HTTP $HTTP_CODE)"
    echo "  Response: $(echo "$RESPONSE" | head -n-1)"
  fi
done

echo "✅ FDX scopes creation complete"

# List all scopes to verify
echo ""
echo "📋 Current client scopes in realm '$REALM':"
curl -s "$KEYCLOAK_URL/admin/realms/$REALM/client-scopes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | "  - \(.name) (\(.type))"'

