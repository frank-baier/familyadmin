package de.baier.familyadmin.documents;

import de.baier.familyadmin.user.User;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserDocumentShareRepository extends JpaRepository<UserDocumentShare, UserDocumentShareId> {
    List<UserDocumentShare> findByOwner(User owner);
    void deleteByOwnerAndSharedWith(User owner, User sharedWith);
    boolean existsByOwnerAndSharedWith(User owner, User sharedWith);
}
