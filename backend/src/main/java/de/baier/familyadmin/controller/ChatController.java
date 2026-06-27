package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.ChatRequest;
import de.baier.familyadmin.dto.ChatResponse;
import de.baier.familyadmin.service.RAGService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final RAGService ragService;

    @PostMapping("/query")
    public ResponseEntity<ChatResponse> query(@RequestBody @Valid ChatRequest request) {
        return ResponseEntity.ok(ragService.query(request.question()));
    }
}
