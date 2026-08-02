package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.LoginRequest;
import de.baier.familyadmin.dto.LoginResponse;
import de.baier.familyadmin.dto.UserResponse;
import de.baier.familyadmin.model.RefreshToken;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.RefreshTokenRepository;
import de.baier.familyadmin.service.JwtService;
import de.baier.familyadmin.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Arrays;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final int REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;
    private final RefreshTokenRepository refreshTokenRepository;

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletResponse response) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        User user = (User) userService.loadUserByUsername(request.email());
        String accessToken = jwtService.generateAccessToken(user);
        String jti = jwtService.generateRefreshToken();

        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .jti(jti)
                .expiresAt(Instant.now().plusSeconds(REFRESH_TTL_SECONDS))
                .build());

        setRefreshCookie(response, jti);
        return ResponseEntity.ok(new LoginResponse(accessToken, UserResponse.from(user)));
    }

    @PostMapping("/refresh")
    @Transactional
    public ResponseEntity<LoginResponse> refresh(HttpServletRequest request,
                                                 HttpServletResponse response) {
        String jti = getRefreshCookie(request);
        if (jti == null) return ResponseEntity.status(401).build();

        RefreshToken token = refreshTokenRepository.findByJti(jti).orElse(null);
        if (token == null || token.getExpiresAt().isBefore(Instant.now())) {
            if (token != null) refreshTokenRepository.deleteByJti(jti);
            clearRefreshCookie(response);
            return ResponseEntity.status(401).build();
        }

        User user = token.getUser();
        String newAccessToken = jwtService.generateAccessToken(user);
        String newJti = jwtService.generateRefreshToken();

        // Rotate: replace old token with new one
        refreshTokenRepository.deleteByJti(jti);
        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .jti(newJti)
                .expiresAt(Instant.now().plusSeconds(REFRESH_TTL_SECONDS))
                .build());

        setRefreshCookie(response, newJti);
        return ResponseEntity.ok(new LoginResponse(newAccessToken, UserResponse.from(user)));
    }

    @PostMapping("/logout")
    @Transactional
    public ResponseEntity<Void> logout(HttpServletRequest request,
                                       HttpServletResponse response) {
        String jti = getRefreshCookie(request);
        if (jti != null) {
            refreshTokenRepository.deleteByJti(jti);
        }
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(UserResponse.from(user));
    }

    private void setRefreshCookie(HttpServletResponse response, String jti) {
        Cookie cookie = new Cookie("refresh_token", jti);
        cookie.setHttpOnly(true);
        cookie.setSecure(false);
        cookie.setPath("/");
        cookie.setMaxAge(REFRESH_TTL_SECONDS);
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie("refresh_token", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
    }

    private String getRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> "refresh_token".equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
