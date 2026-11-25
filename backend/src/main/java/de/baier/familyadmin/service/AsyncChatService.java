package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.ChatResponse;
import de.baier.familyadmin.model.ChatHistory;
import de.baier.familyadmin.repository.ChatHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncChatService {

    // How often the partial answer is written to the DB while it is being generated.
    // The frontend polls the history and shows the answer as it grows.
    private static final long PARTIAL_SAVE_INTERVAL_MS = 1_500;

    private final RAGService ragService;
    private final ChatHistoryRepository chatHistoryRepository;

    @Async
    public void processQuery(UUID historyId, String question) {
        try {
            AtomicLong lastSave = new AtomicLong(System.currentTimeMillis());
            ChatResponse result = ragService.query(question, partial -> {
                long now = System.currentTimeMillis();
                if (now - lastSave.get() < PARTIAL_SAVE_INTERVAL_MS) return;
                lastSave.set(now);
                chatHistoryRepository.findById(historyId).ifPresent(entry -> {
                    entry.setAnswer(partial);
                    chatHistoryRepository.save(entry);
                });
            });
            chatHistoryRepository.findById(historyId).ifPresent(entry -> {
                entry.setAnswer(result.answer());
                entry.setSources(result.sources().stream().collect(Collectors.joining(",")));
                entry.setStatus("DONE");
                chatHistoryRepository.save(entry);
            });
            log.info("Async RAG query completed for history {}", historyId);
        } catch (Exception e) {
            log.error("Async RAG query failed for history {}: {}", historyId, e.getMessage());
            chatHistoryRepository.findById(historyId).ifPresent(entry -> {
                entry.setAnswer("Fehler bei der Verarbeitung: " + e.getMessage());
                entry.setStatus("ERROR");
                chatHistoryRepository.save(entry);
            });
        }
    }
}
