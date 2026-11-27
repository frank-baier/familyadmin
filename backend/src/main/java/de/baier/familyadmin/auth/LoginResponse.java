package de.baier.familyadmin.auth;

import de.baier.familyadmin.user.UserResponse;

public record LoginResponse(
        String accessToken,
        UserResponse user
) {}
