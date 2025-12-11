# Troubleshooting FDX Consent Authenticator

## Common Issues

### Authenticator Not Appearing in "Add Step" Dropdown

**Symptoms:**
- JAR is deployed to `/opt/keycloak/providers/`
- Keycloak logs show warning: `KC-SERVICES0047: fdx-consent-authenticator is implementing the internal SPI authenticator`
- Authenticator doesn't appear in the "Add step" dropdown

**Possible Causes & Solutions:**

1. **Keycloak Version Mismatch**
   - Ensure POM.xml uses the correct Keycloak version (24.0.1)
   - Rebuild: `mvn clean package`
   - Redeploy JAR to Keycloak

2. **JAR Not Properly Loaded**
   ```bash
   # Verify JAR is in container
   docker exec tyk-demo-keycloak-1 ls -la /opt/keycloak/providers/ | grep fdx
   
   # Check JAR contents
   docker exec tyk-demo-keycloak-1 unzip -l /opt/keycloak/providers/fdx-consent-authenticator-1.0.0.jar | grep META-INF
   ```

3. **Keycloak Not Fully Restarted**
   - Wait 30-60 seconds after restart
   - Check logs: `docker logs tyk-demo-keycloak-1 | tail -50`
   - Look for "Keycloak started" message

4. **Browser Cache**
   - Clear browser cache
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Try incognito/private window

5. **Service File Missing**
   - Verify `META-INF/services/org.keycloak.authentication.AuthenticatorFactory` exists
   - Should contain: `com.fdx.consent.FdxConsentAuthenticatorFactory`

### Error When Selecting Authenticator

**If you see an error when clicking on the authenticator:**

1. **Check Keycloak Logs:**
   ```bash
   docker logs tyk-demo-keycloak-1 2>&1 | tail -100 | grep -A 10 -B 10 -i "error\|exception"
   ```

2. **Common Errors:**
   - **ClassNotFoundException**: JAR not properly built or missing dependencies
   - **NoClassDefFoundError**: Missing dependencies in JAR
   - **NullPointerException**: Configuration issue

3. **Verify JAR Contents:**
   ```bash
   cd consent-service/keycloak-authenticator-spi
   unzip -l target/fdx-consent-authenticator-1.0.0.jar
   ```
   
   Should contain:
   - `com/fdx/consent/FdxConsentAuthenticator.class`
   - `com/fdx/consent/FdxConsentAuthenticatorFactory.class`
   - `META-INF/services/org.keycloak.authentication.AuthenticatorFactory`

### Authenticator Appears But Doesn't Work

1. **Check Configuration:**
   - Ensure all config properties are set:
     - Consent Service URL
     - FDX API Base URL
     - Required Data Clusters

2. **Check Network Connectivity:**
   ```bash
   # From Keycloak container
   docker exec tyk-demo-keycloak-1 curl -s http://consent-service:8900/healthz
   ```

3. **Check Logs During Authentication:**
   ```bash
   docker logs tyk-demo-keycloak-1 -f | grep -i "fdx\|consent"
   ```

## Debugging Steps

### Step 1: Verify Deployment

```bash
# Check JAR exists
docker exec tyk-demo-keycloak-1 ls -la /opt/keycloak/providers/fdx-consent-authenticator-1.0.0.jar

# Check JAR size (should be ~8KB)
docker exec tyk-demo-keycloak-1 stat -c%s /opt/keycloak/providers/fdx-consent-authenticator-1.0.0.jar
```

### Step 2: Check Keycloak Logs

```bash
# View recent logs
docker logs tyk-demo-keycloak-1 2>&1 | tail -100

# Search for authenticator-related messages
docker logs tyk-demo-keycloak-1 2>&1 | grep -i "fdx\|consent\|authenticator"
```

### Step 3: Verify Service Registration

```bash
# Extract and check service file
docker exec tyk-demo-keycloak-1 unzip -p /opt/keycloak/providers/fdx-consent-authenticator-1.0.0.jar META-INF/services/org.keycloak.authentication.AuthenticatorFactory
```

Should output:
```
com.fdx.consent.FdxConsentAuthenticatorFactory
```

### Step 4: Test Authenticator Loading

```bash
# Restart Keycloak and watch logs
docker restart tyk-demo-keycloak-1
sleep 10
docker logs tyk-demo-keycloak-1 2>&1 | grep -i "fdx\|consent" | tail -5
```

You should see:
```
WARN [org.key.services] KC-SERVICES0047: fdx-consent-authenticator (com.fdx.consent.FdxConsentAuthenticatorFactory) is implementing the internal SPI authenticator
```

This warning is **expected** and means the authenticator is loading.

## Still Not Working?

1. **Check Keycloak Version:**
   ```bash
   docker exec tyk-demo-keycloak-1 /opt/keycloak/bin/kc.sh --version
   ```
   
   Should match version in `pom.xml` (24.0.1)

2. **Rebuild from Scratch:**
   ```bash
   cd consent-service/keycloak-authenticator-spi
   mvn clean
   rm -rf target
   mvn package
   ```

3. **Verify Java Version:**
   ```bash
   java -version  # Should be 17+
   mvn -version   # Should use Java 17+
   ```

4. **Check for Compilation Errors:**
   ```bash
   cd consent-service/keycloak-authenticator-spi
   mvn clean compile
   ```

## Getting Help

If the authenticator still doesn't work:

1. **Collect Information:**
   - Keycloak version: `docker exec tyk-demo-keycloak-1 /opt/keycloak/bin/kc.sh --version`
   - Java version: `java -version`
   - Maven version: `mvn -version`
   - Full error message from Keycloak logs
   - Screenshot of the error in Admin Console

2. **Check Keycloak Community:**
   - [Keycloak Forums](https://forum.keycloak.org/)
   - [Keycloak GitHub Issues](https://github.com/keycloak/keycloak/issues)

3. **Alternative Approach:**
   If the authenticator SPI approach doesn't work, consider using the application-level integration method (see `app-integration-example.js`).



