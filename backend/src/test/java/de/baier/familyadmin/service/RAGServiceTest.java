package de.baier.familyadmin.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RAGServiceTest {

    private OllamaService ollama;
    private AnthropicChatService claude;
    private RAGService service;
    private final Consumer<String> noop = partial -> {};

    @BeforeEach
    void setUp() {
        ollama = mock(OllamaService.class);
        claude = mock(AnthropicChatService.class);
        service = new RAGService(ollama, claude, mock(JdbcTemplate.class));
        ReflectionTestUtils.setField(service, "llmProvider", "anthropic");
        when(ollama.generateStreaming(anyString(), any(), any())).thenReturn("ollama");
    }

    @Test
    void usesClaudeWhenConfigured() {
        when(claude.isConfigured()).thenReturn(true);
        when(claude.generateStreaming("sys", "msg", noop)).thenReturn("claude");

        assertThat(service.generate("sys", "msg", noop)).isEqualTo("claude");
        verifyNoInteractions(ollama);
    }

    @Test
    void fallsBackToOllamaWhenClaudeFails() {
        when(claude.isConfigured()).thenReturn(true);
        when(claude.generateStreaming(any(), any(), any())).thenThrow(new IllegalStateException("429"));

        assertThat(service.generate("sys", "msg", noop)).isEqualTo("ollama");
        verify(ollama).generateStreaming(contains("sys"), any(), eq(noop));
    }

    @Test
    void usesOllamaWithoutApiKey() {
        when(claude.isConfigured()).thenReturn(false);

        assertThat(service.generate("sys", "msg", noop)).isEqualTo("ollama");
        verify(claude, never()).generateStreaming(any(), any(), any());
    }

    @Test
    void usesOllamaWhenProviderIsOllama() {
        ReflectionTestUtils.setField(service, "llmProvider", "ollama");
        when(claude.isConfigured()).thenReturn(true);

        assertThat(service.generate("sys", "msg", noop)).isEqualTo("ollama");
        verify(claude, never()).generateStreaming(any(), any(), any());
    }
}
