#!/bin/bash

# Keycloak Restore Script - Uses Existing Backup Files
# Usage: ./restore-from-backup.sh

set -e

BACKUP_DIR="./deployments/fdxri-fapi/fapi-setup/export-restore/keycloak-backup"
KEYCLOAK_URL="http://localhost:8180"
REALM="fapi-demo"

echo "🔄 Starting Keycloak FAPI Demo Restore from backup files..."

# Wait for Keycloak to be ready
echo "⏳ Waiting for Keycloak to be ready..."
for i in {1..60}; do
  if curl -s "$KEYCLOAK_URL/health/ready" > /dev/null 2>&1; then
    echo "✅ Keycloak is ready"
    break
  fi
  if [ $i -eq 60 ]; then
    echo "❌ Keycloak did not become ready in time"
    exit 1
  fi
  echo "Waiting... ($i/60)"
  sleep 2
done

sleep 5

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

# Check if realm exists
REALM_EXISTS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$KEYCLOAK_URL/admin/realms/$REALM" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if [ "$REALM_EXISTS" = "200" ]; then
  echo "⚠️  Realm $REALM already exists"
  echo "Deleting existing realm..."
  curl -s -X DELETE "$KEYCLOAK_URL/admin/realms/$REALM" \
    -H "Authorization: Bearer $ADMIN_TOKEN"
  echo "✅ Realm deleted"
  sleep 3
fi

# Create realm with basic settings
echo "📥 Creating realm: $REALM..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$BACKUP_DIR/realm-fapi-demo.json"

echo "✅ Realm created"
sleep 3

# Get new admin token for the realm
ADMIN_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" | jq -r '.access_token')

# Create client scopes first
echo "📥 Creating client scopes..."

# Create payments scope
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/client-scopes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payments",
    "description": "Payment initiation access",
    "protocol": "openid-connect",
    "attributes": {
      "include.in.token.scope": "true",
      "display.on.consent.screen": "true",
      "consent.screen.text": "Initiate payments on your behalf"
    }
  }' > /dev/null 2>&1 || true

# Create payment-consent scope
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/client-scopes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payment-consent",
    "description": "Payment consent management",
    "protocol": "openid-connect",
    "attributes": {
      "include.in.token.scope": "true",
      "display.on.consent.screen": "true",
      "consent.screen.text": "Manage payment consents"
    }
  }' > /dev/null 2>&1 || true

echo "✅ Client scopes created"

# Create FDX scopes from fdxscopes.json
echo "📥 Creating FDX scopes from fdxscopes.json..."
# Path relative to where script is called from (tyk-demo root)
SCOPES_FILE="./deployments/fdxri-fapi/fdxscopes.json"
if [ -f "$SCOPES_FILE" ]; then
  # Use jq to iterate through each scope in the JSON array
  jq -c '.[]' "$SCOPES_FILE" | while read -r scope; do
    scope_name=$(echo "$scope" | jq -r '.name')
    
    # Check if scope already exists
    EXISTING_SCOPE=$(curl -s -o /dev/null -w "%{http_code}" \
      "$KEYCLOAK_URL/admin/realms/$REALM/client-scopes/$scope_name" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if [ "$EXISTING_SCOPE" = "200" ]; then
      echo "  ⚠️  Scope '$scope_name' already exists, skipping..."
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
    fi
  done
  echo "✅ FDX scopes created"
else
  echo "⚠️  Warning: $SCOPES_FILE not found, skipping FDX scope creation"
fi

# Import client profiles
echo "📥 Importing client profiles..."
curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/client-policies/profiles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$BACKUP_DIR/client-profiles.json"

echo "✅ Client profiles imported"

# Import client policies
echo "📥 Importing client policies..."
curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/client-policies/policies" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$BACKUP_DIR/client-policies.json"

echo "✅ Client policies imported"

# Import clients
echo "📥 Importing clients..."

# Prepare client files (remove id field for import)
for CLIENT_FILE in "$BACKUP_DIR"/client-*.json; do
  if [ -f "$CLIENT_FILE" ]; then
    CLIENT_NAME=$(basename "$CLIENT_FILE" .json | sed 's/client-//')
    echo "  Importing: $CLIENT_NAME..."
    
    # Remove the 'id' field and import
    jq 'del(.id)' "$CLIENT_FILE" > /tmp/client-import.json
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d @/tmp/client-import.json)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "201" ]; then
      echo "  ✅ Client created: $CLIENT_NAME"
    else
      echo "  ⚠️  Client creation response: $HTTP_CODE for $CLIENT_NAME"
    fi
  fi
done

rm -f /tmp/client-import.json

# Import users
echo "📥 Importing users..."
USERS=$(cat "$BACKUP_DIR/users.json")
echo "$USERS" | jq -c '.[]' | while read -r user; do
  USERNAME=$(echo "$user" | jq -r '.username')
  echo "  Creating user: $USERNAME..."
  
  # Remove id and create user
  USER_DATA=$(echo "$user" | jq 'del(.id)')
  
  curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$USER_DATA" > /dev/null 2>&1
  
  # Set password for the user
  USER_ID=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$USERNAME" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')
  
  if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
    curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/reset-password" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "type": "password",
        "value": "password",
        "temporary": false
      }' > /dev/null 2>&1
    
    echo "  ✅ User created: $USERNAME (password: password)"
  fi
done

echo ""
echo "🔍 Verifying restoration..."

# Verify clients
CLIENTS_FOUND=0
for CLIENT in "my-tpp" "my-tpp-public" "fapi-conformance-one" "fdx-sample-webapp" "fapi-postman"; do
  CLIENT_EXISTS=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r ".[] | select(.clientId==\"$CLIENT\") | .clientId")
  
  if [ -n "$CLIENT_EXISTS" ]; then
    echo "✅ Client verified: $CLIENT"
    CLIENTS_FOUND=$((CLIENTS_FOUND + 1))
  else
    echo "❌ Client missing: $CLIENT"
  fi
done

# Verify users
USERS_FOUND=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '. | length')

echo "✅ Users restored: $USERS_FOUND"

echo ""
if [ $CLIENTS_FOUND -eq 3 ]; then
  echo "✅ ✅ ✅ Restore completed successfully! ✅ ✅ ✅"
else
  echo "⚠️  Restore completed with warnings - some clients may be missing"
fi

echo ""
echo "🔐 Keycloak FAPI Demo Realm restored"
echo "🌐 Admin Console: $KEYCLOAK_URL/admin"
echo "🔑 Realm: $REALM"
echo ""
echo "👤 Test Users (all with password: 'password'):"
echo "   - alice"
echo "   - bob"
echo "   - test-user"
echo ""
echo "📱 Clients:"
echo "   - my-tpp (confidential)"
echo "   - my-tpp-public (public)"
echo "   - fapi-conformance-one (public)"
echo "   - fdx-sample-webapp (public)"
echo "   - fapi-postman (public)"