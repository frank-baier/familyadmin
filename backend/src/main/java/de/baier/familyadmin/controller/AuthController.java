package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.LoginRequest;
import de.baier.familyadmin.dto.LoginResponse;
import de.baier.familyadmin.dto.UserResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.JwtService;
import de.baier.familyadmin.service.RefreshTokenService;
import de.baier.familyadmin.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String COOKIE_NAME = "refresh_token";

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;
    private final RefreshTokenService refreshTokenService;

    /**
     * Domain the refresh cookie is shared across (e.g. "familyadmin.baier-family.de" makes it
     * valid for all module subdomains below it). Empty = host-only cookie (dev, single host).
     */
    @Value("${app.auth.cookie-domain:}")
    private String cookieDomain;

    @Value("${app.auth.cookie-secure:false}")
    private boolean cookieSecure;

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletResponse response) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        User user = (User) userService.loadUserByUsername(request.email());
        String jti = refreshTokenService.issue(user);

        setRefreshCookie(response, jti);
        return ResponseEntity.ok(new LoginResponse(jwtService.generateAccessToken(user), UserResponse.from(user)));
    }

    @PostMapping("/refresh")
    @Transactional
    public ResponseEntity<LoginResponse> refresh(HttpServletRequest request,
                                                 HttpServletResponse response) {
        List<String> candidates = getRefreshCookies(request);
        if (candidates.isEmpty()) return ResponseEntity.status(401).build();

        return refreshTokenService.rotate(candidates)
                .map(session -> {
                    setRefreshCookie(response, session.jti());
                    return ResponseEntity.ok(new LoginResponse(
                            jwtService.generateAccessToken(session.user()), UserResponse.from(session.user())));
                })
                .orElseGet(() -> {
                    clearRefreshCookie(response);
                    return ResponseEntity.status(401).build();
                });
    }

    @PostMapping("/logout")
    @Transactional
    public ResponseEntity<Void> logout(HttpServletRequest request,
                                       HttpServletResponse response) {
        refreshTokenService.revoke(getRefreshCookies(request));
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(UserResponse.from(user));
    }

    private void setRefreshCookie(HttpServletResponse response, String jti) {
        response.addHeader(HttpHeaders.SET_COOKIE,
                cookie(jti, Duration.ofSeconds(RefreshTokenService.REFRESH_TTL_SECONDS), cookieDomain).toString());
        if (!cookieDomain.isBlank()) {
            // Remove a pre-existing host-only cookie, otherwise the browser keeps sending both.
            response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO, "").toString());
        }
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO, cookieDomain).toString());
        if (!cookieDomain.isBlank()) {
            response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO, "").toString());
        }
    }

    private ResponseCookie cookie(String value, Duration maxAge, String domain) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(maxAge)
                .sameSite("Lax");
        if (!domain.isBlank()) builder.domain(domain);
        return builder.build();
    }

    /** All refresh_token cookies sent — during migration a host-only and a domain cookie can coexist. */
    private List<String> getRefreshCookies(HttpServletRequest request) {
        if (request.getCookies() == null) return List.of();
        return Arrays.stream(request.getCookies())
                .filter(c -> COOKIE_NAME.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> v != null && !v.isBlank())
                .distinct()
                .toList();
    }
}
