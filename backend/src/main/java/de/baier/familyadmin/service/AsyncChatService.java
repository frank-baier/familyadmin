package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.ChatResponse;
import de.baier.familyadmin.model.ChatHistory;
import de.baier.familyadmin.repository.ChatHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncChatService {

    private final RAGService ragService;
    private final ChatHistoryRepository chatHistoryRepository;

    @Async
    public void processQuery(UUID historyId, String question) {
        try {
            ChatResponse result = ragService.query(question);
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
