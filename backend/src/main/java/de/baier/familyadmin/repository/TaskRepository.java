package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.Task;
import de.baier.familyadmin.model.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID> {
    List<Task> findAllByOrderByDueDateAscCreatedAtDesc();
    List<Task> findByAssigneeIdOrderByDueDateAscCreatedAtDesc(UUID assigneeId);
    List<Task> findByStatusNotAndDueDateLessThanEqual(TaskStatus status, LocalDate date);
}
