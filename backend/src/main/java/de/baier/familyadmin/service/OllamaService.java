package de.baier.familyadmin.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class OllamaService {

    private static final Logger log = LoggerFactory.getLogger(OllamaService.class);

    // Ollama on CPU-only Hetzner can only run one model at a time.
    // embed() uses the embedding model (bge-m3); generate() uses the chat model.
    // Concurrent calls across models force an expensive unload/reload cycle and cause
    // the response to come back with application/octet-stream (bad content-type).
    //
    // ReadWriteLock solution:
    //   embed()    → read lock  (multiple embeds in parallel, same model)
    //   generate() → write lock (exclusive: waits for all embeds to finish before
    //                            switching to the chat model, then blocks new embeds)
    private static final ReadWriteLock OLLAMA_LOCK = new ReentrantReadWriteLock(true);
    private static final int GENERATE_MAX_RETRIES = 2;
    private static final long GENERATE_RETRY_DELAY_MS = 8_000;

    private final RestClient restClient;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Value("${ollama.embedding-model:bge-m3}")
    private String embeddingModel;

    @Value("${ollama.chat-model:phi3.5}")
    private String chatModel;

    // Without an explicit num_ctx Ollama uses its small default context window and
    // silently drops the start of longer prompts — i.e. the retrieved documents.
    @Value("${ollama.num-ctx:8192}")
    private int numCtx;

    public OllamaService(@Value("${ollama.base-url:http://localhost:11434}") String baseUrl) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofMinutes(3));

        // Ollama sometimes returns application/octet-stream instead of application/json.
        // Configure Jackson converter to accept any content type.
        var jacksonConverter = new MappingJackson2HttpMessageConverter();
        jacksonConverter.setSupportedMediaTypes(List.of(MediaType.ALL));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .messageConverters(converters -> {
                    converters.removeIf(c -> c instanceof MappingJackson2HttpMessageConverter);
                    converters.add(0, jacksonConverter);
                })
                .build();
    }

    public String chatModel() {
        return chatModel;
    }

    public float[] embed(String text) {
        OLLAMA_LOCK.readLock().lock();
        try {
            var response = restClient.post()
                    .uri("/api/embeddings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new EmbeddingRequest(embeddingModel, text))
                    .retrieve()
                    .body(EmbeddingResponse.class);
            if (response == null || response.embedding() == null) {
                throw new IllegalStateException("Ollama returned null embedding");
            }
            return response.embedding();
        } finally {
            OLLAMA_LOCK.readLock().unlock();
        }
    }

    public String generate(String prompt) {
        return generate(prompt, null);
    }

    public String generate(String prompt, Double temperature) {
        Exception lastException = null;
        for (int attempt = 1; attempt <= GENERATE_MAX_RETRIES; attempt++) {
            OLLAMA_LOCK.writeLock().lock();
            try {
                var response = restClient.post()
                        .uri("/api/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(new GenerateRequest(chatModel, prompt, false, options(temperature)))
                        .retrieve()
                        .body(GenerateResponse.class);
                if (response == null) {
                    throw new IllegalStateException("Ollama returned null response");
                }
                return response.response();
            } catch (Exception e) {
                lastException = e;
                log.warn("Ollama generate attempt {}/{} failed: {}", attempt, GENERATE_MAX_RETRIES, e.getMessage());
                if (attempt < GENERATE_MAX_RETRIES) {
                    try { Thread.sleep(GENERATE_RETRY_DELAY_MS); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                }
            } finally {
                OLLAMA_LOCK.writeLock().unlock();
            }
        }
        throw new RuntimeException("Ollama generate failed after " + GENERATE_MAX_RETRIES + " attempts", lastException);
    }

    /**
     * Streams the answer token by token. {@code onPartial} receives the full text
     * generated so far after each chunk. No retry: a partial answer was already shown.
     */
    public String generateStreaming(String prompt, Double temperature, Consumer<String> onPartial) {
        OLLAMA_LOCK.writeLock().lock();
        try {
            return restClient.post()
                    .uri("/api/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new GenerateRequest(chatModel, prompt, true, options(temperature)))
                    .exchange((request, response) -> {
                        if (response.getStatusCode().isError()) {
                            throw new IllegalStateException("Ollama returned HTTP " + response.getStatusCode());
                        }
                        StringBuilder answer = new StringBuilder();
                        try (var reader = new BufferedReader(
                                new InputStreamReader(response.getBody(), StandardCharsets.UTF_8))) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                if (line.isBlank()) continue;
                                JsonNode node = MAPPER.readTree(line);
                                if (node.hasNonNull("error")) {
                                    throw new IllegalStateException("Ollama error: " + node.get("error").asText());
                                }
                                String piece = node.path("response").asText("");
                                if (!piece.isEmpty()) {
                                    answer.append(piece);
                                    onPartial.accept(answer.toString());
                                }
                                if (node.path("done").asBoolean(false)) break;
                            }
                        }
                        return answer.toString();
                    });
        } finally {
            OLLAMA_LOCK.writeLock().unlock();
        }
    }

    private Map<String, Object> options(Double temperature) {
        Map<String, Object> options = new HashMap<>();
        options.put("num_ctx", numCtx);
        if (temperature != null) options.put("temperature", temperature);
        return options;
    }

    private record EmbeddingRequest(String model, String prompt) {}
    private record EmbeddingResponse(float[] embedding) {}
    private record GenerateRequest(String model, String prompt, boolean stream, Map<String, Object> options) {}
    private record GenerateResponse(String response) {}
}
