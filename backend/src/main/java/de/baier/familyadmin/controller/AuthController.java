package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.LoginRequest;
import de.baier.familyadmin.dto.LoginResponse;
import de.baier.familyadmin.dto.UserResponse;
import de.baier.familyadmin.model.User;
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
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletResponse response) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        User user = (User) userService.loadUserByUsername(request.email());
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken();

        userService.updateRefreshJti(user.getId(), refreshToken);
        setRefreshCookie(response, refreshToken);

        return ResponseEntity.ok(new LoginResponse(accessToken, UserResponse.from(user)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(HttpServletRequest request,
                                                 HttpServletResponse response) {
        String refreshJti = getRefreshCookie(request);
        if (refreshJti == null) {
            return ResponseEntity.status(401).build();
        }

        // Find user by refresh JTI
        User user = userService.findAll().stream()
                .filter(u -> refreshJti.equals(u.getRefreshJti()))
                .findFirst()
                .orElse(null);

        if (user == null) {
            return ResponseEntity.status(401).build();
        }

        String newAccessToken = jwtService.generateAccessToken(user);
        String newRefreshToken = jwtService.generateRefreshToken();
        userService.updateRefreshJti(user.getId(), newRefreshToken);
        setRefreshCookie(response, newRefreshToken);

        return ResponseEntity.ok(new LoginResponse(newAccessToken, UserResponse.from(user)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal User user,
                                       HttpServletResponse response) {
        if (user != null) {
            userService.updateRefreshJti(user.getId(), null);
        }
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(UserResponse.from(user));
    }

    private void setRefreshCookie(HttpServletResponse response, String jti) {
        Cookie cookie = new Cookie("refresh_token", jti);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/api/auth");
        cookie.setMaxAge(7 * 24 * 60 * 60);
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie("refresh_token", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/api/auth");
        cookie.setMaxAge(0);
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
