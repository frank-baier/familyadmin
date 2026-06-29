package de.baier.familyadmin.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class OllamaService {

    private static final Logger log = LoggerFactory.getLogger(OllamaService.class);

    // Ollama on CPU-only Hetzner can only run one model at a time.
    // embed() uses nomic-embed-text; generate() uses phi3.5.
    // Concurrent calls across models force an expensive unload/reload cycle and cause
    // the response to come back with application/octet-stream (bad content-type).
    //
    // ReadWriteLock solution:
    //   embed()    → read lock  (multiple embeds in parallel, same model)
    //   generate() → write lock (exclusive: waits for all embeds to finish before
    //                            switching to phi3.5, then blocks new embeds)
    private static final ReadWriteLock OLLAMA_LOCK = new ReentrantReadWriteLock(true);
    private static final int GENERATE_MAX_RETRIES = 2;
    private static final long GENERATE_RETRY_DELAY_MS = 8_000;

    private final RestClient restClient;

    @Value("${ollama.embedding-model:nomic-embed-text}")
    private String embeddingModel;

    @Value("${ollama.chat-model:phi3.5}")
    private String chatModel;

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
        Exception lastException = null;
        for (int attempt = 1; attempt <= GENERATE_MAX_RETRIES; attempt++) {
            OLLAMA_LOCK.writeLock().lock();
            try {
                var response = restClient.post()
                        .uri("/api/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(new GenerateRequest(chatModel, prompt, false))
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

    private record EmbeddingRequest(String model, String prompt) {}
    private record EmbeddingResponse(float[] embedding) {}
    private record GenerateRequest(String model, String prompt, boolean stream) {}
    private record GenerateResponse(String response) {}
}
