package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.ChatHistoryResponse;
import de.baier.familyadmin.dto.ChatRequest;
import de.baier.familyadmin.dto.ChatSessionResponse;
import de.baier.familyadmin.model.ChatHistory;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.ChatHistoryRepository;
import de.baier.familyadmin.service.ChatSessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatSessionService chatSessionService;
    private final ChatHistoryRepository chatHistoryRepository;

    /** Asks a question in the open session (follow-ups keep the session's context). */
    @PostMapping("/query")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ChatHistoryResponse query(
            @RequestBody @Valid ChatRequest request,
            @AuthenticationPrincipal User currentUser) {
        return chatSessionService.ask(currentUser, request.question());
    }

    /** The open session, or 204 if none has been started. */
    @GetMapping("/session")
    public ResponseEntity<ChatSessionResponse> getOpenSession(@AuthenticationPrincipal User currentUser) {
        return chatSessionService.getOpenSession(currentUser)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** Ends the open session; it moves to the history. */
    @PostMapping("/session/close")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void closeSession(@AuthenticationPrincipal User currentUser) {
        chatSessionService.closeOpenSession(currentUser);
    }

    /** Closed sessions, newest first. */
    @GetMapping("/history")
    public List<ChatSessionResponse> getHistory(@AuthenticationPrincipal User currentUser) {
        return chatSessionService.getHistory(currentUser);
    }

    @DeleteMapping("/sessions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSession(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        chatSessionService.deleteSession(currentUser, id);
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
}
