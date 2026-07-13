package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.ChatHistoryResponse;
import de.baier.familyadmin.dto.ChatRequest;
import de.baier.familyadmin.model.ChatHistory;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.ChatHistoryRepository;
import de.baier.familyadmin.service.AsyncChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final AsyncChatService asyncChatService;
    private final ChatHistoryRepository chatHistoryRepository;

    @PostMapping("/query")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ChatHistoryResponse query(
            @RequestBody @Valid ChatRequest request,
            @AuthenticationPrincipal User currentUser) {
        ChatHistory pending = chatHistoryRepository.save(ChatHistory.builder()
                .user(currentUser)
                .question(request.question())
                .answer("")
                .sources("")
                .status("PENDING")
                .build());

        asyncChatService.processQuery(pending.getId(), request.question());
        return ChatHistoryResponse.from(pending);
    }

    @GetMapping("/history")
    public List<ChatHistoryResponse> getHistory(@AuthenticationPrincipal User currentUser) {
        return chatHistoryRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getId())
                .stream()
                .map(ChatHistoryResponse::from)
                .toList();
    }

    @GetMapping("/history/{id}")
    public ChatHistoryResponse getHistoryEntry(
            @PathVariable UUID id,
            @AuthenticationPrincipal User currentUser) {
        ChatHistory entry = chatHistoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!entry.getUser().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return ChatHistoryResponse.from(entry);
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
