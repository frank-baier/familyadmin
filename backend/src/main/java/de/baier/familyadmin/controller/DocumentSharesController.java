package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.UserResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.model.UserDocumentShare;
import de.baier.familyadmin.repository.UserDocumentShareRepository;
import de.baier.familyadmin.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/document-shares")
@RequiredArgsConstructor
public class DocumentSharesController {

    private final UserDocumentShareRepository shareRepository;
    private final UserRepository userRepository;

    /** Users I'm currently sharing all my documents with */
    @GetMapping
    public List<UserResponse> getMyShares(@AuthenticationPrincipal User currentUser) {
        return shareRepository.findByOwner(currentUser).stream()
                .map(s -> UserResponse.from(s.getSharedWith()))
                .toList();
    }

    /** All other users (for the sharing picker) */
    @GetMapping("/users")
    public List<UserResponse> getOtherUsers(@AuthenticationPrincipal User currentUser) {
        return userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(currentUser.getId()))
                .map(UserResponse::from)
                .toList();
    }

    /** Share all my documents with userId */
    @PutMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void shareWith(@PathVariable UUID userId, @AuthenticationPrincipal User currentUser) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!shareRepository.existsByOwnerAndSharedWith(currentUser, target)) {
            shareRepository.save(UserDocumentShare.builder()
                    .owner(currentUser)
                    .sharedWith(target)
                    .build());
        }
    }

    /** Revoke sharing with userId */
    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void revokeShare(@PathVariable UUID userId, @AuthenticationPrincipal User currentUser) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        shareRepository.deleteByOwnerAndSharedWith(currentUser, target);
    }
}
