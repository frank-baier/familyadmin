package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.User;
import de.baier.familyadmin.model.UserDocumentShare;
import de.baier.familyadmin.model.UserDocumentShareId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserDocumentShareRepository extends JpaRepository<UserDocumentShare, UserDocumentShareId> {
    List<UserDocumentShare> findByOwner(User owner);
    void deleteByOwnerAndSharedWith(User owner, User sharedWith);
    boolean existsByOwnerAndSharedWith(User owner, User sharedWith);
}
