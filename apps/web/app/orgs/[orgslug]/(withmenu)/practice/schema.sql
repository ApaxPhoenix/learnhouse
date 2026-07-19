CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_test_sessions (
                                                  test_session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    english_correct INTEGER NOT NULL DEFAULT 0,
    english_total INTEGER NOT NULL DEFAULT 0,
    math_correct INTEGER NOT NULL DEFAULT 0,
    math_total INTEGER NOT NULL DEFAULT 0,
    rw_score INTEGER NOT NULL DEFAULT 0,
    math_score INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
                             );

CREATE TABLE IF NOT EXISTS user_attempts (
                                             id BIGSERIAL PRIMARY KEY,
                                             user_id VARCHAR(255) NOT NULL,
    test_session_id UUID REFERENCES user_test_sessions(test_session_id) ON DELETE CASCADE,
    question_id VARCHAR(255) NOT NULL,
    section VARCHAR(10) NOT NULL,
    selected_option_key VARCHAR(10) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    time_spent_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (test_session_id, question_id)
    );

CREATE INDEX IF NOT EXISTS idx_user_test_sessions_user ON user_test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_attempts_session_section ON user_attempts(test_session_id, section);
CREATE INDEX IF NOT EXISTS idx_user_attempts_user ON user_attempts(user_id);