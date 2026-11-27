package de.baier.familyadmin.documents;

import java.math.BigDecimal;
import java.util.List;

/**
* @param model      model that wrote the answer (e.g. "claude-haiku-5-5", "ollama:qwen2.5:3b"), null if none ran
* @param costUsd    API cost of the answer; zero for the local model, null if no model ran
* @param durationMs total time for retrieval + answer
*/
public record ChatResponse(String answer, List<String> sources, String model, BigDecimal costUsd, Long durationMs) {

    public ChatResponse(String answer, List<String> sources) {
        this(answer, sources, null, null, null);
    }
}
