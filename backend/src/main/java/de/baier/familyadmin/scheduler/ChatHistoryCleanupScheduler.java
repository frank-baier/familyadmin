package de.baier.familyadmin.scheduler;

import de.baier.familyadmin.service.ChatSessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Daily removal of document-chat questions older than three months. */
@Component
@RequiredArgsConstructor
public class ChatHistoryCleanupScheduler {

    private final ChatSessionService chatSessionService;

    @Scheduled(cron = "0 30 2 * * *", zone = "UTC")
    public void cleanup() {
        chatSessionService.deleteExpired();
    }
}
