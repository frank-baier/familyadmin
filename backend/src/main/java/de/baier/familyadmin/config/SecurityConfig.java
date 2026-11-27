package de.baier.familyadmin.config;

import de.baier.familyadmin.filter.ApiKeyAuthFilter;
import de.baier.familyadmin.filter.JwtAuthFilter;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final de.baier.familyadmin.filter.ApiKeyAuthFilter apiKeyAuthFilter;
    private final UserDetailsService userDetailsService;

    @Value("${app.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    static {
        // Fix for Java 21 virtual threads + Spring Security ThreadLocal
        SecurityContextHolder.setStrategyName(SecurityContextHolder.MODE_INHERITABLETHREADLOCAL);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/actuator/health", "/api/webhooks/whatsapp", "/api/recipes/*/photo", "/api/trips/ingest/email", "/api/health/ingest", "/api/public/**", "/error").permitAll()
                        .requestMatchers(this::requiresModule).access(this::moduleAccess)
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .addFilterBefore(apiKeyAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // Module apps live on subdomains of the portal (recipes.<portal>, tasks.<portal> …).
        // Their same-origin POSTs still carry an Origin header, so they must be allowed here —
        // otherwise /api/auth/refresh answers 403 and the app loops between page and /login.
        config.setAllowedOriginPatterns(List.of(
                "http://localhost:3000", "http://*.localhost:3000",
                frontendUrl, subdomainPattern(frontendUrl)));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    /** "https://admin.example.com" → "https://*.admin.example.com" */
    static String subdomainPattern(String origin) {
        int schemeEnd = origin.indexOf("://");
        return schemeEnd < 0 ? origin : origin.substring(0, schemeEnd + 3) + "*." + origin.substring(schemeEnd + 3);
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider(PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    // ── Module access: /api/<module paths> need authority MODULE_<module> ──
    private static final org.springframework.util.AntPathMatcher PATHS = new org.springframework.util.AntPathMatcher();

    private static java.util.Optional<String> moduleOf(jakarta.servlet.http.HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return de.baier.familyadmin.user.AppModule.API_PATHS.entrySet().stream()
                .filter(e -> e.getValue().stream().anyMatch(p -> PATHS.match(p, path) || PATHS.match(p.replace("/**", ""), path)))
                .map(java.util.Map.Entry::getKey).findFirst();
    }

    private boolean requiresModule(jakarta.servlet.http.HttpServletRequest request) {
        return moduleOf(request).isPresent();
    }

    private org.springframework.security.authorization.AuthorizationDecision moduleAccess(
            java.util.function.Supplier<org.springframework.security.core.Authentication> auth,
            org.springframework.security.web.access.intercept.RequestAuthorizationContext ctx) {
        String needed = de.baier.familyadmin.user.AppModule.authority(moduleOf(ctx.getRequest()).orElseThrow());
        var a = auth.get();
        boolean ok = a != null && a.isAuthenticated()
                && !(a instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)
                && a.getAuthorities().stream().anyMatch(g -> g.getAuthority().equals(needed));
        return new org.springframework.security.authorization.AuthorizationDecision(ok);
    }
}
