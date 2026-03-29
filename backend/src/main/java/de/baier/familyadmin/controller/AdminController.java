package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.RegisterRequest;
import de.baier.familyadmin.dto.UserResponse;
import de.baier.familyadmin.model.Role;
import de.baier.familyadmin.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserService userService;

    @PostMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody RegisterRequest request) {
        var user = userService.createUser(request.name(), request.email(), request.password(), Role.MEMBER);
        return ResponseEntity
                .created(URI.create("/api/admin/users/" + user.getId()))
                .body(UserResponse.from(user));
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> listUsers() {
        List<UserResponse> users = userService.findAll().stream()
                .map(UserResponse::from)
                .toList();
        return ResponseEntity.ok(users);
    }
}
