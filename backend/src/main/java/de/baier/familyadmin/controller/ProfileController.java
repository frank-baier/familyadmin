package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.UpdateProfileRequest;
import de.baier.familyadmin.dto.UserResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<UserResponse> getProfile(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @PutMapping
    public ResponseEntity<UserResponse> updateProfile(@AuthenticationPrincipal User user,
                                                      @Valid @RequestBody UpdateProfileRequest request) {
        User updated = userService.updateProfile(user.getId(), request.name(), request.whatsappPhone());
        return ResponseEntity.ok(UserResponse.from(updated));
    }
}
