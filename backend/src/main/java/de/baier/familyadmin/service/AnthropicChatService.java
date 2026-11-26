package de.baier.familyadmin.service;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.http.StreamResponse;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.RawMessageStreamEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.function.Consumer;

/**
 * Answers document-chat questions with a Claude model via the Anthropic API.
 * Only the retrieved excerpts and the question leave the server; retrieval and
 * embeddings stay local (Ollama + pgvector).
 */
@Slf4j
@Service
public class AnthropicChatService {

    private static final long MAX_TOKENS = 4096L;

    private final String model;
    private final AnthropicClient client;

    public AnthropicChatService(@Value("${anthropic.api-key:}") String apiKey,
                                @Value("${rag.anthropic-model:claude-haiku-5-5}") String model) {
        this.model = model;
        this.client = StringUtils.hasText(apiKey)
                ? AnthropicOkHttpClient.builder().apiKey(apiKey).build()
                : null;
    }

    public boolean isConfigured() {
        return client != null;
    }

    public String model() {
        return model;
    }

    /**
     * Streams the answer; {@code onPartial} receives the full text generated so far.
     * Throws if the model returns no text (e.g. a refusal), so the caller can fall back.
     */
    public String generateStreaming(String system, String userMessage, Consumer<String> onPartial) {
        if (client == null) {
            throw new IllegalStateException("ANTHROPIC_API_KEY ist nicht konfiguriert");
        }
        MessageCreateParams params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(MAX_TOKENS)
                // Short factual answers from given excerpts: low effort keeps latency and cost down.
                .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
                .system(system)
                .addUserMessage(userMessage)
                .build();

        StringBuilder answer = new StringBuilder();
        try (StreamResponse<RawMessageStreamEvent> stream = client.messages().createStreaming(params)) {
            stream.stream()
                    .flatMap(event -> event.contentBlockDelta().stream())
                    .flatMap(delta -> delta.delta().text().stream())
                    .forEach(text -> {
                        answer.append(text.text());
                        onPartial.accept(answer.toString());
                    });
        }
        if (answer.isEmpty()) {
            throw new IllegalStateException("Claude lieferte keine Antwort (" + model + ")");
        }
        return answer.toString();
    }
}
