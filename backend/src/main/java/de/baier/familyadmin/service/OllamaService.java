package de.baier.familyadmin.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;

@Service
public class OllamaService {

    private final RestClient restClient;

    @Value("${ollama.embedding-model:nomic-embed-text}")
    private String embeddingModel;

    @Value("${ollama.chat-model:phi3.5}")
    private String chatModel;

    public OllamaService(@Value("${ollama.base-url:http://localhost:11434}") String baseUrl) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofMinutes(3));

        // Ollama returns application/octet-stream instead of application/json —
        // configure Jackson converter to accept any content type.
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
    }

    public String generate(String prompt) {
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
    }

    private record EmbeddingRequest(String model, String prompt) {}
    private record EmbeddingResponse(float[] embedding) {}
    private record GenerateRequest(String model, String prompt, boolean stream) {}
    private record GenerateResponse(String response) {}
}
