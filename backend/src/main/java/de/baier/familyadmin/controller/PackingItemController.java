package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.PackingItemRequest;
import de.baier.familyadmin.dto.PackingItemResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.PackingItemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips/{tripId}/packing")
@RequiredArgsConstructor
public class PackingItemController {

    private final PackingItemService packingItemService;

    @GetMapping
    public ResponseEntity<List<PackingItemResponse>> getItems(
            @PathVariable UUID tripId,
            @RequestParam(name = "personal", defaultValue = "false") boolean personal,
            @AuthenticationPrincipal User currentUser) {
        List<PackingItemResponse> items;
        if (personal) {
            items = packingItemService.getPersonalItems(tripId, currentUser.getId())
                    .stream().map(PackingItemResponse::from).toList();
        } else {
            items = packingItemService.getSharedItems(tripId)
                    .stream().map(PackingItemResponse::from).toList();
        }
        return ResponseEntity.ok(items);
    }

    @PostMapping
    public ResponseEntity<PackingItemResponse> addItem(
            @PathVariable UUID tripId,
            @Valid @RequestBody PackingItemRequest request,
            @AuthenticationPrincipal User currentUser) {
        var item = packingItemService.addItem(tripId, request, currentUser);
        return ResponseEntity
                .created(URI.create("/api/trips/" + tripId + "/packing/" + item.getId()))
                .body(PackingItemResponse.from(item));
    }

    @PatchMapping("/{itemId}/toggle")
    public ResponseEntity<PackingItemResponse> toggle(@PathVariable UUID tripId,
                                                       @PathVariable UUID itemId) {
        return ResponseEntity.ok(PackingItemResponse.from(packingItemService.togglePacked(itemId)));
    }

    @DeleteMapping("/{itemId}")
    public ResponseEntity<Void> delete(@PathVariable UUID tripId,
                                       @PathVariable UUID itemId) {
        packingItemService.deleteItem(itemId);
        return ResponseEntity.noContent().build();
    }
}
