package de.baier.familyadmin.sport;

import de.baier.familyadmin.user.User;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class HealthServiceTest {

    private final ObjectMapper json = new ObjectMapper();
    private HealthDailyMetricRepository metrics;
    private HealthSyncTokenRepository tokens;
    private HealthService service;
    private final UUID userId = UUID.randomUUID();
    private String rawToken;

    @BeforeEach
    void setUp() {
        metrics = mock(HealthDailyMetricRepository.class);
        tokens = mock(HealthSyncTokenRepository.class);
        service = new HealthService(metrics, tokens);

        User user = new User();
        user.setId(userId);
        when(tokens.findById(userId)).thenReturn(Optional.empty());
        ArgumentCaptor<HealthSyncToken> saved = ArgumentCaptor.forClass(HealthSyncToken.class);
        HealthTokenResponse r = service.rotateToken(user);
        verify(tokens).save(saved.capture());
        rawToken = r.token();
        when(tokens.findByTokenHash(saved.getValue().getTokenHash())).thenReturn(Optional.of(saved.getValue()));
    }

    @Test
    void storesWhitelistedValuesAndWarnsOnTheRest() throws Exception {
        String body = """
                {"date":"2026-11-24","steps":"8’421","weight_kg":"78,4 kg","resting_hr":0,
                 "hrv_ms":900,"sleep_minutes":432,"mood":5,"vo2max":""}
                """;
        HealthIngestResult r = service.ingest(rawToken, json.readTree(body));

        LocalDate d = LocalDate.of(2026, 11, 24);
        verify(metrics).upsert(userId, d, "steps", 8421.0);
        verify(metrics).upsert(userId, d, "weight_kg", 78.4);
        verify(metrics).upsert(userId, d, "sleep_hours", 7.2);
        verify(metrics, never()).upsert(any(), any(), eq("resting_hr"), anyDouble());
        verify(metrics, never()).upsert(any(), any(), eq("hrv_ms"), anyDouble());
        assertThat(r.saved()).isEqualTo(3);
        assertThat(r.warnings()).hasSize(2); // hrv implausible + unknown "mood"; resting_hr 0 and empty vo2max are silent
    }

    @Test
    void acceptsSeveralDays() throws Exception {
        String body = """
                {"days":[{"date":"2026-11-23","steps":100},{"date":"2026-11-24T00:00:00+01:00","steps":200},{"steps":5}]}
                """;
        HealthIngestResult r = service.ingest(rawToken, json.readTree(body));
        assertThat(r.saved()).isEqualTo(2);
        assertThat(r.warnings()).singleElement().asString().contains("Datum");
    }

    @Test
    void rejectsMissingOrWrongToken() throws Exception {
        var body = json.readTree("{\"date\":\"2026-11-24\",\"steps\":1}");
        assertThatThrownBy(() -> service.ingest(null, body)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.ingest("fah_wrong", body)).isInstanceOf(ResponseStatusException.class);
        verify(metrics, never()).upsert(any(), any(), any(), anyDouble());
    }
}
