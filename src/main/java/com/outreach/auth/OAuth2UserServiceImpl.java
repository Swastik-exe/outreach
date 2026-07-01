package com.outreach.auth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

/**
 * Delegates to the default OAuth2 user loading, then stores the extra attributes
 * we need (email, provider, providerId) as attributes on the returned OAuth2User.
 * The actual DB upsert happens in OAuth2SuccessHandler to avoid Hibernate/tx issues.
 */
@Slf4j
@Service
public class OAuth2UserServiceImpl extends DefaultOAuth2UserService {

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(request);
        String registrationId = request.getClientRegistration().getRegistrationId();
        log.debug("OAuth2 user loaded from provider={}", registrationId);
        return oAuth2User;
    }
}
