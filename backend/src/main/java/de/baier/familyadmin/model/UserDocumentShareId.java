package de.baier.familyadmin.model;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class UserDocumentShareId implements Serializable {
    private UUID owner;
    private UUID sharedWith;

    public UserDocumentShareId() {}

    public UserDocumentShareId(UUID owner, UUID sharedWith) {
        this.owner = owner;
        this.sharedWith = sharedWith;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UserDocumentShareId that)) return false;
        return Objects.equals(owner, that.owner) && Objects.equals(sharedWith, that.sharedWith);
    }

    @Override
    public int hashCode() {
        return Objects.hash(owner, sharedWith);
    }
}
