package com.fdx.consent;

import org.keycloak.Config;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.authentication.ConfigurableAuthenticatorFactory;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.provider.ProviderFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * Factory for FDX Consent Authenticator
 */
public class FdxConsentAuthenticatorFactory implements AuthenticatorFactory, ConfigurableAuthenticatorFactory {
    
    public static final String PROVIDER_ID = "fdx-consent-authenticator";
    
    private static final List<ProviderConfigProperty> CONFIG_PROPERTIES = new ArrayList<>();
    
    static {
        // Consent Service URL
        ProviderConfigProperty consentServiceUrl = new ProviderConfigProperty();
        consentServiceUrl.setName("consent.service.url");
        consentServiceUrl.setLabel("Consent Service URL");
        consentServiceUrl.setType(ProviderConfigProperty.STRING_TYPE);
        consentServiceUrl.setHelpText("Base URL of the FDX Consent Service (e.g., http://consent-service:8900)");
        consentServiceUrl.setDefaultValue("http://consent-service:8900");
        CONFIG_PROPERTIES.add(consentServiceUrl);
        
        // FDX API Base URL
        ProviderConfigProperty fdxApiUrl = new ProviderConfigProperty();
        fdxApiUrl.setName("fdx.api.url");
        fdxApiUrl.setLabel("FDX API Base URL");
        fdxApiUrl.setType(ProviderConfigProperty.STRING_TYPE);
        fdxApiUrl.setHelpText("Base URL of the FDX Core API (e.g., http://fdxri-tomcat:8090/fdxapi)");
        fdxApiUrl.setDefaultValue("http://fdxri-tomcat:8090/fdxapi");
        CONFIG_PROPERTIES.add(fdxApiUrl);
        
        // Required Data Clusters
        ProviderConfigProperty dataClusters = new ProviderConfigProperty();
        dataClusters.setName("required.data.clusters");
        dataClusters.setLabel("Required Data Clusters");
        dataClusters.setType(ProviderConfigProperty.STRING_TYPE);
        dataClusters.setHelpText("Comma-separated list of required data clusters (e.g., ACCOUNT_DETAILED,TRANSACTIONS,STATEMENTS)");
        dataClusters.setDefaultValue("ACCOUNT_DETAILED,TRANSACTIONS,STATEMENTS");
        CONFIG_PROPERTIES.add(dataClusters);
    }
    
    @Override
    public String getId() {
        return PROVIDER_ID;
    }
    
    @Override
    public String getDisplayType() {
        return "FDX Consent Selection";
    }
    
    @Override
    public String getHelpText() {
        return "Ensures users have granted fine-grained consent before completing authentication. Required for Open Banking compliance.";
    }
    
    @Override
    public String getReferenceCategory() {
        return "consent";
    }
    
    @Override
    public boolean isConfigurable() {
        return true;
    }
    
    @Override
    public AuthenticationExecutionModel.Requirement[] getRequirementChoices() {
        return new AuthenticationExecutionModel.Requirement[] {
            AuthenticationExecutionModel.Requirement.REQUIRED,
            AuthenticationExecutionModel.Requirement.ALTERNATIVE,
            AuthenticationExecutionModel.Requirement.DISABLED
        };
    }
    
    @Override
    public boolean isUserSetupAllowed() {
        return false;
    }
    
    @Override
    public List<ProviderConfigProperty> getConfigProperties() {
        // Return a copy to prevent modification
        return new ArrayList<>(CONFIG_PROPERTIES);
    }
    
    @Override
    public Authenticator create(KeycloakSession session) {
        try {
            return new FdxConsentAuthenticator();
        } catch (Exception e) {
            // Log error but don't fail - let Keycloak handle it
            System.err.println("Error creating FdxConsentAuthenticator: " + e.getMessage());
            e.printStackTrace();
            return new FdxConsentAuthenticator(); // Try anyway
        }
    }
    
    @Override
    public void init(Config.Scope config) {
        // Initialization if needed
    }
    
    @Override
    public void postInit(KeycloakSessionFactory factory) {
        // Post-initialization if needed
    }
    
    @Override
    public void close() {
        // Cleanup if needed
    }
}

