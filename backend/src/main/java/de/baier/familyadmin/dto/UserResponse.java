package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.Role;
import de.baier.familyadmin.model.User;

import java.util.UUID;

public record UserResponse(
        UUID id,
        String name,
        String email,
        Role role,
        String whatsappPhone
) {
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getRole(), user.getWhatsappPhone());
    }
}
