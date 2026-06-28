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
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(3);   // HikariCP max=5; keep 2 free for sync requests
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("FamilyAdmin-");
        executor.initialize();
        return executor;
    }
}
