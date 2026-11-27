package de.baier.familyadmin.tasks;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID> {
    List<Task> findAllByOrderByDueDateAscCreatedAtDesc();
    List<Task> findByAssigneeIdOrderByDueDateAscCreatedAtDesc(UUID assigneeId);
    List<Task> findByStatusNotAndDueDateLessThanEqual(TaskStatus status, LocalDate date);
}
