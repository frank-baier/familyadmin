CREATE TYPE task_status AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

CREATE TABLE tasks (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    status       task_status  NOT NULL DEFAULT 'OPEN',
    assignee_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_by   UUID         NOT NULL REFERENCES users(id),
    due_date     DATE,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_items (
    id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id  UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    text     VARCHAR(500) NOT NULL,
    done     BOOLEAN      NOT NULL DEFAULT FALSE,
    position INT          NOT NULL DEFAULT 0
);

CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status   ON tasks(status);
CREATE INDEX idx_checklist_task ON checklist_items(task_id);
