package de.baier.familyadmin.service;

import de.baier.familyadmin.model.RefreshToken;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Issues, rotates and revokes refresh tokens.
 *
 * Rotation grace period: several apps (tasks, recipes, travel …) open in the same browser
 * share one refresh cookie. When two of them refresh at nearly the same time, the second
 * request still carries the token the first one just rotated away. Instead of logging the
 * user out, a token rotated within the last {@link #GRACE} is accepted once more and
 * answered with its successor, so both apps end up with the same, current cookie.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenService {

    public static final int REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
    static final Duration GRACE = Duration.ofSeconds(30);

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;

    /** old jti → successor, kept for {@link #GRACE}. In memory: single backend instance. */
    private final Map<String, Rotation> recentlyRotated = new ConcurrentHashMap<>();

    public record Session(User user, String jti) {}

    private record Rotation(String successorJti, UUID userId, Instant until) {}

    @Transactional
    public String issue(User user) {
        String jti = jwtService.generateRefreshToken();
        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .jti(jti)
                .expiresAt(Instant.now().plusSeconds(REFRESH_TTL_SECONDS))
                .build());
        return jti;
    }

    /**
     * Rotates the first usable token among {@code candidates} (a browser can send more than
     * one refresh_token cookie while host-only cookies are migrated to the shared domain).
     */
    @Transactional
    public Optional<Session> rotate(List<String> candidates) {
        Instant now = Instant.now();
        for (String jti : candidates) {
            Optional<RefreshToken> stored = refreshTokenRepository.findByJti(jti);
            if (stored.isPresent()) {
                RefreshToken token = stored.get();
                if (token.getExpiresAt().isBefore(now)) {
                    refreshTokenRepository.deleteByJti(jti);
                    continue;
                }
                User user = (User) Hibernate.unproxy(token.getUser());
                refreshTokenRepository.deleteByJti(jti);
                String successor = issue(user);
                remember(jti, successor, user.getId(), now);
                return Optional.of(new Session(user, successor));
            }

            Rotation rotation = recentlyRotated.get(jti);
            if (rotation != null && rotation.until().isAfter(now)) {
                Optional<RefreshToken> successor = refreshTokenRepository.findByJti(rotation.successorJti());
                if (successor.isPresent() && successor.get().getUser().getId().equals(rotation.userId())) {
                    log.debug("Refresh token reused within grace period — answering with successor");
                    return Optional.of(new Session(
                            (User) Hibernate.unproxy(successor.get().getUser()), rotation.successorJti()));
                }
            }
        }
        return Optional.empty();
    }

    @Transactional
    public void revoke(List<String> candidates) {
        for (String jti : candidates) {
            refreshTokenRepository.deleteByJti(jti);
            recentlyRotated.remove(jti);
        }
    }

    private void remember(String oldJti, String successorJti, UUID userId, Instant now) {
        recentlyRotated.values().removeIf(r -> r.until().isBefore(now));
        recentlyRotated.put(oldJti, new Rotation(successorJti, userId, now.plus(GRACE)));
    }
}
