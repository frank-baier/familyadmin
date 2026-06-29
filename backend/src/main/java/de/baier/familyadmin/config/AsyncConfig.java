package de.baier.familyadmin.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        // Large pool so threads blocked on the Ollama semaphore don't starve the queue.
        // Only 1 thread calls phi3.5 at a time (semaphore in OllamaService.generate()),
        // so concurrent DB pressure stays low despite the high thread count.
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("FamilyAdmin-");
        executor.initialize();
        return executor;
    }
}
