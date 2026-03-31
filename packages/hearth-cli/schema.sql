-- Hearth database schema
-- Run against a fresh PostgreSQL database to initialize all tables.

CREATE TABLE IF NOT EXISTS users (
    id bigserial PRIMARY KEY,
    name varchar(255) NOT NULL,
    slug varchar(255) NOT NULL UNIQUE,
    avatar varchar(255),
    memory_namespace varchar(255) NOT NULL,
    default_agent_id varchar(255),
    is_active boolean NOT NULL DEFAULT true,
    role varchar(50) NOT NULL DEFAULT 'member',
    pin_hash varchar(255),
    pin_set_at timestamp(0),
    last_login_at timestamp(0),
    requires_pin boolean NOT NULL DEFAULT true,
    remember_token varchar(255),
    created_at timestamp(0),
    updated_at timestamp(0)
);

CREATE TABLE IF NOT EXISTS conversations (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL,
    agent_id varchar(255) NOT NULL DEFAULT 'aeris',
    openclaw_session_key varchar(255) NOT NULL,
    status varchar(255) NOT NULL DEFAULT 'active',
    mode varchar(255) NOT NULL DEFAULT 'household',
    model_preset varchar(20) NOT NULL DEFAULT 'fast',
    archived_at timestamp(0),
    last_message_at timestamp(0),
    created_at timestamp(0),
    updated_at timestamp(0)
);

CREATE TABLE IF NOT EXISTS messages (
    id bigserial PRIMARY KEY,
    conversation_id bigint NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role varchar(255) NOT NULL,
    content text NOT NULL,
    model varchar(255),
    metadata_json json,
    source varchar(255),
    channel varchar(40),
    contract_event varchar(80),
    channel_message_id varchar(255),
    person_identity varchar(255),
    agent_id varchar(255),
    reply_to_message_id varchar(255),
    sent_at timestamp(0),
    contract_json json,
    created_at timestamp(0),
    updated_at timestamp(0)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    public_key varchar(255) NOT NULL,
    auth_token varchar(255) NOT NULL,
    content_encoding varchar(255),
    user_agent varchar(255),
    last_used_at timestamp(0),
    current_conversation_id bigint,
    is_visible boolean NOT NULL DEFAULT false,
    presence_seen_at timestamp(0),
    created_at timestamp(0),
    updated_at timestamp(0)
);

CREATE TABLE IF NOT EXISTS reminders (
    id bigserial PRIMARY KEY,
    conversation_id bigint NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text text NOT NULL,
    fire_at timestamptz NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending',
    critical boolean NOT NULL DEFAULT false,
    repeat_count integer NOT NULL DEFAULT 0,
    fired_at timestamptz,
    acknowledged_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id varchar(512) PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key text NOT NULL,
    counter bigint NOT NULL DEFAULT 0,
    device_type varchar(32),
    backed_up boolean DEFAULT false,
    transports text,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_fire_at ON reminders(fire_at);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON webauthn_credentials(user_id);
