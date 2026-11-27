package de.baier.familyadmin.notification;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ModuleLinksTest {

    @Test
    void pointsToModuleSubdomain() {
        assertThat(ModuleLinks.of("https://admin.baier-family.de", "tasks", "/tasks/42"))
                .isEqualTo("https://tasks.admin.baier-family.de/tasks/42");
        assertThat(ModuleLinks.of("https://admin.baier-family.de/", "finance", "/finance/7"))
                .isEqualTo("https://finance.admin.baier-family.de/finance/7");
    }

    @Test
    void keepsHostWithoutSubdomains() {
        assertThat(ModuleLinks.of("http://localhost:3000", "tasks", "/tasks/1"))
                .isEqualTo("http://localhost:3000/tasks/1");
    }
}
