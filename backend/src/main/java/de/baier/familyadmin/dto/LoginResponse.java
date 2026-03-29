package de.baier.familyadmin.dto;

public record LoginResponse(
        String accessToken,
        UserResponse user
) {}
