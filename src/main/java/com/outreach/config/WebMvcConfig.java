package com.outreach.config;

import com.outreach.common.RateLimitInterceptor;
import com.outreach.common.RequestCorrelationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final RateLimitInterceptor rateLimitInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/api/v1/**")
                .excludePathPatterns("/api/v1/health", "/api/v1/auth/**");
    }

    @Bean
    public FilterRegistrationBean<RequestCorrelationFilter> correlationFilter() {
        FilterRegistrationBean<RequestCorrelationFilter> bean = new FilterRegistrationBean<>();
        bean.setFilter(new RequestCorrelationFilter());
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        bean.addUrlPatterns("/api/v1/*");
        return bean;
    }
}
