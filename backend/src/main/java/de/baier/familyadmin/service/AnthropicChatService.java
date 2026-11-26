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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.concurrent.atomic.AtomicLong;
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
    private static final BigDecimal MILLION = BigDecimal.valueOf(1_000_000);

    private final String model;
    private final BigDecimal inputPricePerMTok;
    private final BigDecimal outputPricePerMTok;
    private final AnthropicClient client;

    public record Result(String text, long inputTokens, long outputTokens, BigDecimal costUsd) {}

    public AnthropicChatService(@Value("${anthropic.api-key:}") String apiKey,
                                @Value("${rag.anthropic-model:claude-haiku-5-5}") String model,
                                @Value("${rag.anthropic-price-input-usd-per-mtok:0.10}") BigDecimal inputPricePerMTok,
                                @Value("${rag.anthropic-price-output-usd-per-mtok:0.50}") BigDecimal outputPricePerMTok) {
        this.model = model;
        this.inputPricePerMTok = inputPricePerMTok;
        this.outputPricePerMTok = outputPricePerMTok;
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
    public Result generateStreaming(String system, String userMessage, Consumer<String> onPartial) {
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
        AtomicLong inputTokens = new AtomicLong();
        AtomicLong outputTokens = new AtomicLong();
        try (StreamResponse<RawMessageStreamEvent> stream = client.messages().createStreaming(params)) {
            stream.stream().forEach(event -> {
                event.messageStart().ifPresent(start ->
                        inputTokens.set(start.message().usage().inputTokens()));
                // output_tokens in message_delta is cumulative and includes thinking tokens.
                event.messageDelta().ifPresent(delta ->
                        outputTokens.set(delta.usage().outputTokens()));
                event.contentBlockDelta()
                        .flatMap(delta -> delta.delta().text())
                        .ifPresent(text -> {
                            answer.append(text.text());
                            onPartial.accept(answer.toString());
                        });
            });
        }
        if (answer.isEmpty()) {
            throw new IllegalStateException("Claude lieferte keine Antwort (" + model + ")");
        }
        BigDecimal cost = cost(inputTokens.get(), outputTokens.get());
        log.info("Claude answer ({}): {} in / {} out tokens, ${}", model, inputTokens.get(), outputTokens.get(), cost);
        return new Result(answer.toString(), inputTokens.get(), outputTokens.get(), cost);
    }

    BigDecimal cost(long inputTokens, long outputTokens) {
        return inputPricePerMTok.multiply(BigDecimal.valueOf(inputTokens))
                .add(outputPricePerMTok.multiply(BigDecimal.valueOf(outputTokens)))
                .divide(MILLION, 6, RoundingMode.HALF_UP);
    }
}
