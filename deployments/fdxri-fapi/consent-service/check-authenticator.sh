#!/bin/bash
# check-authenticator.sh
# Diagnostic script to check if FDX Consent Authenticator is properly deployed

echo "=== FDX Consent Authenticator Diagnostic ==="
echo ""

# Find Keycloak container
KC_CONTAINER=$(docker ps --filter "name=keycloak" --format "{{.Names}}" | head -1)

if [ -z "$KC_CONTAINER" ]; then
    echo "ERROR: Keycloak container not found"
    exit 1
fi

echo "Keycloak Container: $KC_CONTAINER"
echo ""

# Check JAR exists
echo "1. Checking JAR file..."
if docker exec $KC_CONTAINER test -f /opt/keycloak/providers/fdx-consent-authenticator-1.0.0.jar; then
    echo "   ✓ JAR file exists"
    JAR_SIZE=$(docker exec $KC_CONTAINER stat -c%s /opt/keycloak/providers/fdx-consent-authenticator-1.0.0.jar)
    echo "   JAR size: $JAR_SIZE bytes"
else
    echo "   ✗ JAR file NOT found"
    exit 1
fi
echo ""

# Check service file
echo "2. Checking service registration file..."
SERVICE_CONTENT=$(docker exec $KC_CONTAINER unzip -p /opt/keycloak/providers/fdx-consent-authenticator-1.0.0.jar META-INF/services/org.keycloak.authentication.AuthenticatorFactory 2>/dev/null)
if [ -n "$SERVICE_CONTENT" ]; then
    echo "   ✓ Service file exists"
    echo "   Content: $SERVICE_CONTENT"
else
    echo "   ✗ Service file NOT found or empty"
fi
echo ""

# Check classes
echo "3. Checking class files..."
if docker exec $KC_CONTAINER unzip -l /opt/keycloak/providers/fdx-consent-authenticator-1.0.0.jar | grep -q "FdxConsentAuthenticator.class"; then
    echo "   ✓ FdxConsentAuthenticator.class found"
else
    echo "   ✗ FdxConsentAuthenticator.class NOT found"
fi

if docker exec $KC_CONTAINER unzip -l /opt/keycloak/providers/fdx-consent-authenticator-1.0.0.jar | grep -q "FdxConsentAuthenticatorFactory.class"; then
    echo "   ✓ FdxConsentAuthenticatorFactory.class found"
else
    echo "   ✗ FdxConsentAuthenticatorFactory.class NOT found"
fi
echo ""

# Check Keycloak logs
echo "4. Checking Keycloak logs for authenticator..."
LOG_ENTRIES=$(docker logs $KC_CONTAINER 2>&1 | grep -i "fdx\|consent" | tail -5)
if [ -n "$LOG_ENTRIES" ]; then
    echo "   Recent log entries:"
    echo "$LOG_ENTRIES" | sed 's/^/   /'
else
    echo "   ⚠ No log entries found (authenticator may not have loaded)"
fi
echo ""

# Check Keycloak version
echo "5. Checking Keycloak version..."
KC_VERSION=$(docker exec $KC_CONTAINER /opt/keycloak/bin/kc.sh --version 2>&1 | head -1)
echo "   $KC_VERSION"
echo ""

# Check for errors
echo "6. Checking for errors in logs..."
ERRORS=$(docker logs $KC_CONTAINER 2>&1 | grep -i "error\|exception" | grep -i "fdx\|consent" | tail -5)
if [ -n "$ERRORS" ]; then
    echo "   ⚠ Errors found:"
    echo "$ERRORS" | sed 's/^/   /'
else
    echo "   ✓ No errors found related to FDX authenticator"
fi
echo ""

echo "=== Diagnostic Complete ==="
echo ""
echo "If authenticator still doesn't appear:"
echo "1. Clear browser cache and refresh"
echo "2. Wait 30-60 seconds after Keycloak restart"
echo "3. Check Keycloak Admin Console → Authentication → Flows → browser → Add step"
echo "4. Look for 'FDX Consent Selection' in the dropdown"



