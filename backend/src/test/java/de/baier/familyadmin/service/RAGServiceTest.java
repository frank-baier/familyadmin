package de.baier.familyadmin.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RAGServiceTest {

    private OllamaService ollama;
    private AnthropicChatService claude;
    private AnthropicCreditAlertService alerts;
    private RAGService service;
    private final Consumer<String> noop = partial -> {};

    @BeforeEach
    void setUp() {
        ollama = mock(OllamaService.class);
        claude = mock(AnthropicChatService.class);
        alerts = mock(AnthropicCreditAlertService.class);
        service = new RAGService(ollama, claude, alerts, mock(JdbcTemplate.class));
        ReflectionTestUtils.setField(service, "llmProvider", "anthropic");
        when(ollama.generateStreaming(anyString(), any(), any())).thenReturn("ollama");
        when(ollama.chatModel()).thenReturn("qwen2.5:3b");
        when(claude.model()).thenReturn("claude-haiku-5-5");
    }

    @Test
    void usesClaudeWhenConfigured() {
        when(claude.isConfigured()).thenReturn(true);
        when(claude.generateStreaming("sys", List.of(), "msg", noop))
                .thenReturn(new AnthropicChatService.Result("claude", 8000, 300, new BigDecimal("0.000950")));

        var generation = service.generate("sys", List.of(), "msg", noop);
        assertThat(generation.text()).isEqualTo("claude");
        assertThat(generation.model()).isEqualTo("claude-haiku-5-5");
        assertThat(generation.costUsd()).isEqualByComparingTo("0.00095");
        verifyNoInteractions(ollama);
    }

    @Test
    void fallsBackToOllamaWhenClaudeFails() {
        when(claude.isConfigured()).thenReturn(true);
        when(claude.generateStreaming(any(), any(), any(), any())).thenThrow(new IllegalStateException("429"));

        var generation = service.generate("sys", List.of(), "msg", noop);
        assertThat(generation.text()).isEqualTo("ollama");
        assertThat(generation.model()).isEqualTo("ollama:qwen2.5:3b");
        assertThat(generation.costUsd()).isZero();
        verify(ollama).generateStreaming(contains("sys"), any(), eq(noop));
        verifyNoInteractions(alerts);
    }

    @Test
    void creditExhaustionAlertsAdminsAndMarksAnswer() {
        when(claude.isConfigured()).thenReturn(true);
        when(claude.generateStreaming(any(), any(), any(), any())).thenThrow(new IllegalStateException(
                "400: Your credit balance is too low to access the Anthropic API."));

        var generation = service.generate("sys", List.of(), "msg", noop);
        assertThat(generation.text()).isEqualTo("ollama" + RAGService.CREDIT_HINT);
        verify(alerts).notifyCreditExhausted("Dokumenten-Chat");
    }

    @Test
    void usesOllamaWithoutApiKey() {
        when(claude.isConfigured()).thenReturn(false);

        assertThat(service.generate("sys", List.of(), "msg", noop).text()).isEqualTo("ollama");
        verify(claude, never()).generateStreaming(any(), any(), any(), any());
    }

    @Test
    void usesOllamaWhenProviderIsOllama() {
        ReflectionTestUtils.setField(service, "llmProvider", "ollama");
        when(claude.isConfigured()).thenReturn(true);

        assertThat(service.generate("sys", List.of(), "msg", noop).text()).isEqualTo("ollama");
        verify(claude, never()).generateStreaming(any(), any(), any(), any());
    }

    @Test
    void costUsesPerMillionTokenPrices() {
        var real = new AnthropicChatService("", "claude-haiku-5-5", new BigDecimal("0.10"), new BigDecimal("0.50"));
        // 8000 * 0.10/1M + 500 * 0.50/1M = 0.0008 + 0.00025
        assertThat(real.cost(8000, 500)).isEqualByComparingTo("0.00105");
    }

    @Test
    void condenseRephrasesFollowUpWithClaude() {
        when(claude.isConfigured()).thenReturn(true);
        when(claude.complete(anyString(), contains("Folgefrage: und wann war das?")))
                .thenReturn(new AnthropicChatService.Result("Wann war die Autoreparatur?", 200, 20, new BigDecimal("0.00003")));

        var history = List.of(new AnthropicChatService.Turn("Welche Reparaturen hatte das Auto?", "Bremsen (rechnung.pdf)"));
        var query = service.condense("und wann war das?", history);
        assertThat(query.text()).isEqualTo("Wann war die Autoreparatur?");
        assertThat(query.costUsd()).isEqualByComparingTo("0.00003");
    }

    @Test
    void condenseFallsBackToConcatenationWithoutClaude() {
        when(claude.isConfigured()).thenReturn(false);

        var history = List.of(new AnthropicChatService.Turn("Welche Reparaturen hatte das Auto?", "Bremsen"));
        assertThat(service.condense("und wann?", history).text())
                .isEqualTo("Welche Reparaturen hatte das Auto? und wann?");
    }

    @Test
    void ollamaPromptContainsHistory() {
        when(claude.isConfigured()).thenReturn(false);

        service.generate("sys", List.of(new AnthropicChatService.Turn("Frage A", "Antwort A")), "msg", noop);
        verify(ollama).generateStreaming(contains("Frage: Frage A\nAntwort: Antwort A"), any(), eq(noop));
    }
}
