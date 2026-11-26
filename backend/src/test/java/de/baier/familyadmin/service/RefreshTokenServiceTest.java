package de.baier.familyadmin.service;

import de.baier.familyadmin.model.RefreshToken;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class RefreshTokenServiceTest {

    private final Map<String, RefreshToken> db = new ConcurrentHashMap<>();
    private RefreshTokenService service;
    private User user;

    @BeforeEach
    void setUp() {
        RefreshTokenRepository repo = mock(RefreshTokenRepository.class);
        when(repo.findByJti(anyString())).thenAnswer(i -> Optional.ofNullable(db.get(i.<String>getArgument(0))));
        doAnswer(i -> db.remove(i.<String>getArgument(0))).when(repo).deleteByJti(anyString());
        when(repo.save(any(RefreshToken.class))).thenAnswer(i -> {
            RefreshToken t = i.getArgument(0);
            db.put(t.getJti(), t);
            return t;
        });

        JwtService jwt = mock(JwtService.class);
        AtomicInteger n = new AtomicInteger();
        when(jwt.generateRefreshToken()).thenAnswer(i -> "jti-" + n.incrementAndGet());

        service = new RefreshTokenService(repo, jwt);
        user = new User();
        user.setId(UUID.randomUUID());
    }

    @Test
    void rotatesValidToken() {
        String first = service.issue(user);
        var session = service.rotate(List.of(first)).orElseThrow();

        assertThat(session.jti()).isNotEqualTo(first);
        assertThat(db).containsOnlyKeys(session.jti());
    }

    @Test
    void secondAppReusingRotatedTokenGetsSuccessorInsteadOfLogout() {
        String shared = service.issue(user);
        String successor = service.rotate(List.of(shared)).orElseThrow().jti();

        // The second app still sends the old cookie a moment later.
        var second = service.rotate(List.of(shared)).orElseThrow();

        assertThat(second.jti()).isEqualTo(successor);
        assertThat(second.user().getId()).isEqualTo(user.getId());
        assertThat(db).containsOnlyKeys(successor);
    }

    @Test
    void reuseAfterLogoutIsRejected() {
        String shared = service.issue(user);
        String successor = service.rotate(List.of(shared)).orElseThrow().jti();
        service.revoke(List.of(successor));

        assertThat(service.rotate(List.of(shared))).isEmpty();
    }

    @Test
    void unknownOrExpiredTokensAreRejected() {
        assertThat(service.rotate(List.of("nope"))).isEmpty();

        db.put("old", RefreshToken.builder().user(user).jti("old")
                .expiresAt(Instant.now().minusSeconds(1)).build());
        assertThat(service.rotate(List.of("old"))).isEmpty();
        assertThat(db).doesNotContainKey("old");
    }

    @Test
    void picksTheValidCookieWhenHostOnlyAndDomainCookieCoexist() {
        String valid = service.issue(user);
        var session = service.rotate(List.of("stale-host-only", valid)).orElseThrow();

        assertThat(session.user().getId()).isEqualTo(user.getId());
    }
}
