package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.ChatHistoryResponse;
import de.baier.familyadmin.dto.ChatRequest;
import de.baier.familyadmin.dto.ChatResponse;
import de.baier.familyadmin.model.ChatHistory;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.ChatHistoryRepository;
import de.baier.familyadmin.service.RAGService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final RAGService ragService;
    private final ChatHistoryRepository chatHistoryRepository;

    @PostMapping("/query")
    public ResponseEntity<ChatResponse> query(
            @RequestBody @Valid ChatRequest request,
            @AuthenticationPrincipal User currentUser) {
        ChatResponse response = ragService.query(request.question());

        String sourcesStr = response.sources().stream()
                .collect(Collectors.joining(","));
        chatHistoryRepository.save(ChatHistory.builder()
                .user(currentUser)
                .question(request.question())
                .answer(response.answer())
                .sources(sourcesStr)
                .build());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    public List<ChatHistoryResponse> getHistory(@AuthenticationPrincipal User currentUser) {
        return chatHistoryRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getId())
                .stream()
                .map(ChatHistoryResponse::from)
                .toList();
    }

    @DeleteMapping("/history/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHistory(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        ChatHistory entry = chatHistoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!entry.getUser().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        chatHistoryRepository.delete(entry);
    }
}
