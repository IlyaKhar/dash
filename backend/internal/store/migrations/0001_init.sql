CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL UNIQUE,
    name          text NOT NULL DEFAULT '',
    password_hash text NOT NULL,
    role          text NOT NULL DEFAULT 'lab' CHECK (role IN ('lab', 'admin')),
    is_active     boolean NOT NULL DEFAULT true,
    last_login_at timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS folders (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       text NOT NULL,
    position   integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS folders_user_name_uniq ON folders (user_id, lower(name));

CREATE TABLE IF NOT EXISTS tasks (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    folder_id  uuid REFERENCES folders (id) ON DELETE SET NULL,
    title      text NOT NULL DEFAULT '',
    body       text NOT NULL DEFAULT '',
    done       boolean NOT NULL DEFAULT false,
    pinned     boolean NOT NULL DEFAULT false,
    due_at     timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_user_updated_idx ON tasks (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS tasks_folder_idx ON tasks (folder_id);

CREATE TABLE IF NOT EXISTS audit_log (
    id           bigserial PRIMARY KEY,
    actor_id     uuid REFERENCES users (id) ON DELETE SET NULL,
    actor_email  text NOT NULL DEFAULT '',
    action       text NOT NULL,
    target_id    uuid,
    target_email text NOT NULL DEFAULT '',
    details      text NOT NULL DEFAULT '',
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
