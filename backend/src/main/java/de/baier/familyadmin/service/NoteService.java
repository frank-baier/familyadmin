package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.NoteNodeRequest;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.NoteCategory;
import de.baier.familyadmin.model.NoteNode;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.NoteCategoryRepository;
import de.baier.familyadmin.repository.NoteNodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class NoteService {

    private final NoteCategoryRepository noteCategoryRepository;
    private final NoteNodeRepository noteNodeRepository;

    @Transactional(readOnly = true)
    public List<NoteCategory> getCategories(User owner) {
        return noteCategoryRepository.findByOwnerIdOrderByPositionAscCreatedAtAsc(owner.getId());
    }

    public NoteCategory createCategory(User owner, String name) {
        if (noteCategoryRepository.existsByOwnerIdAndNameIgnoreCase(owner.getId(), name)) {
            throw new IllegalArgumentException("A category with this name already exists");
        }
        NoteCategory category = NoteCategory.builder()
                .owner(owner)
                .name(name)
                .build();
        return noteCategoryRepository.save(category);
    }

    public NoteCategory renameCategory(UUID categoryId, User owner, String name) {
        NoteCategory category = getOwnedCategory(categoryId, owner);
        if (!category.getName().equalsIgnoreCase(name)
                && noteCategoryRepository.existsByOwnerIdAndNameIgnoreCase(owner.getId(), name)) {
            throw new IllegalArgumentException("A category with this name already exists");
        }
        category.setName(name);
        return noteCategoryRepository.save(category);
    }

    public void deleteCategory(UUID categoryId, User owner) {
        NoteCategory category = getOwnedCategory(categoryId, owner);
        noteCategoryRepository.delete(category);
    }

    @Transactional(readOnly = true)
    public List<NoteNode> getNodes(UUID categoryId, User owner) {
        getOwnedCategory(categoryId, owner);
        return noteNodeRepository.findByCategoryIdAndOwnerId(categoryId, owner.getId());
    }

    @Transactional(readOnly = true)
    public List<NoteNode> search(User owner, String query) {
        String trimmed = query == null ? "" : query.trim();
        if (trimmed.isEmpty()) {
            return List.of();
        }
        return noteNodeRepository.search(owner.getId(), trimmed, PageRequest.of(0, 50));
    }

    public NoteNode createNode(UUID categoryId, User owner, NoteNodeRequest req) {
        NoteCategory category = getOwnedCategory(categoryId, owner);

        NoteNode parent = null;
        if (req.parentId() != null) {
            parent = getOwnedNode(req.parentId(), owner);
            if (!parent.getCategory().getId().equals(categoryId)) {
                throw new IllegalArgumentException("Parent node belongs to a different category");
            }
        }

        int nextPosition = siblingPosition(categoryId, owner, req.parentId());

        NoteNode node = NoteNode.builder()
                .category(category)
                .parent(parent)
                .owner(owner)
                .name(req.name())
                .content(req.content())
                .position(nextPosition)
                .build();
        return noteNodeRepository.save(node);
    }

    public NoteNode updateNode(UUID nodeId, User owner, NoteNodeRequest req) {
        NoteNode node = getOwnedNode(nodeId, owner);

        NoteCategory targetCategory = node.getCategory();
        if (req.categoryId() != null && !req.categoryId().equals(node.getCategory().getId())) {
            targetCategory = getOwnedCategory(req.categoryId(), owner);
        }
        boolean categoryChanged = !targetCategory.getId().equals(node.getCategory().getId());

        UUID currentParentId = node.getParent() != null ? node.getParent().getId() : null;
        boolean parentChanged = categoryChanged || !Objects.equals(currentParentId, req.parentId());

        if (parentChanged) {
            NoteNode newParent = null;
            if (req.parentId() != null) {
                if (req.parentId().equals(nodeId)) {
                    throw new IllegalArgumentException("A node cannot be its own parent");
                }
                newParent = getOwnedNode(req.parentId(), owner);
                if (!newParent.getCategory().getId().equals(targetCategory.getId())) {
                    throw new IllegalArgumentException("Parent must belong to the target category");
                }
                if (!categoryChanged) {
                    // A cross-category move can never create a cycle: node's whole subtree is
                    // still entirely in the old category at this point, and newParent already
                    // belongs to a different (target) category, so it can't be a descendant.
                    assertNotDescendant(node, newParent, owner);
                }
            }
            node.setParent(newParent);
            node.setPosition(siblingPosition(targetCategory.getId(), owner, req.parentId()));
        }

        if (categoryChanged) {
            reassignCategoryRecursively(node, targetCategory, owner);
        }

        node.setName(req.name());
        node.setContent(req.content());
        return noteNodeRepository.save(node);
    }

    private void reassignCategoryRecursively(NoteNode node, NoteCategory targetCategory, User owner) {
        UUID oldCategoryId = node.getCategory().getId();
        List<NoteNode> siblingsInOldCategory = noteNodeRepository.findByCategoryIdAndOwnerId(oldCategoryId, owner.getId());

        Map<UUID, List<NoteNode>> childrenByParentId = new HashMap<>();
        for (NoteNode n : siblingsInOldCategory) {
            if (n.getParent() != null) {
                childrenByParentId.computeIfAbsent(n.getParent().getId(), k -> new ArrayList<>()).add(n);
            }
        }

        Deque<NoteNode> toReassign = new ArrayDeque<>();
        toReassign.push(node);
        while (!toReassign.isEmpty()) {
            NoteNode current = toReassign.pop();
            current.setCategory(targetCategory);
            noteNodeRepository.save(current);
            toReassign.addAll(childrenByParentId.getOrDefault(current.getId(), List.of()));
        }
    }

    public void deleteNode(UUID nodeId, User owner) {
        NoteNode node = getOwnedNode(nodeId, owner);
        noteNodeRepository.delete(node);
    }

    private int siblingPosition(UUID categoryId, User owner, UUID parentId) {
        return noteNodeRepository.findByCategoryIdAndOwnerId(categoryId, owner.getId()).stream()
                .filter(n -> Objects.equals(n.getParent() != null ? n.getParent().getId() : null, parentId))
                .mapToInt(NoteNode::getPosition)
                .max()
                .orElse(-1) + 1;
    }

    private void assertNotDescendant(NoteNode node, NoteNode candidateParent, User owner) {
        NoteNode current = candidateParent;
        while (current != null) {
            if (current.getId().equals(node.getId())) {
                throw new IllegalArgumentException("Cannot move a node into its own descendant");
            }
            current = current.getParent() != null ? getOwnedNode(current.getParent().getId(), owner) : null;
        }
    }

    private NoteCategory getOwnedCategory(UUID categoryId, User owner) {
        NoteCategory category = noteCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + categoryId));
        if (!category.getOwner().getId().equals(owner.getId())) {
            throw new AccessDeniedException("You don't have permission to access this category");
        }
        return category;
    }

    private NoteNode getOwnedNode(UUID nodeId, User owner) {
        NoteNode node = noteNodeRepository.findById(nodeId)
                .orElseThrow(() -> new ResourceNotFoundException("Note not found: " + nodeId));
        if (!node.getOwner().getId().equals(owner.getId())) {
            throw new AccessDeniedException("You don't have permission to access this note");
        }
        return node;
    }
}
