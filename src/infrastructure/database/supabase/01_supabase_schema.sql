-- ==============================================================================
-- TAMSPEAK PRODUCTION DATABASE SCHEMA (POSTGRESQL 3NF + ROW LEVEL SECURITY)
-- Application: TamSpeak ("Speak Like a Native")
-- Architecture: Zero-Trust Multi-Tenant Isolation (Anti-IDOR via auth.uid())
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. ENUM TYPES
-- ==============================================================================
CREATE TYPE practice_mode AS ENUM (
  'ielts_part1',
  'ielts_part2',
  'ielts_part3',
  'ielts_full_mock',
  'daily_conversation',
  'custom_roleplay',
  'pronunciation_lab',
  'placement_test'
);

CREATE TYPE skill_level AS ENUM (
  'a2',
  'b1',
  'b2',
  'c1',
  'c2'
);

CREATE TYPE ai_provider AS ENUM (
  'gemini_pro',
  'gemini_flash',
  'gemini_flash_lite',
  'groq',
  'openrouter'
);

-- ==============================================================================
-- 2. TRIGGER FUNCTION: update_updated_at_column
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. TABLES (3NF NORMALIZATION)
-- ==============================================================================

-- 3.1 User Profiles (Mirrors auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  target_band NUMERIC(2,1) DEFAULT 7.5 CHECK (target_band >= 0.0 AND target_band <= 9.0),
  current_level skill_level DEFAULT 'b2',
  streak_days INTEGER DEFAULT 0 CHECK (streak_days >= 0),
  last_practice_date DATE,
  total_practice_minutes INTEGER DEFAULT 0 CHECK (total_practice_minutes >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.2 User Encrypted API Keys (Zero-Trust Cryptographic Vault Storage)
-- Plaintext is NEVER stored. Data contains AES-GCM 256-bit ciphertext, IV, and PBKDF2 salt.
CREATE TABLE IF NOT EXISTS user_encrypted_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider ai_provider NOT NULL,
  key_alias TEXT NOT NULL,
  encrypted_ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_user_provider_alias UNIQUE (user_id, provider, key_alias)
);

-- 3.3 Custom & Curated Speaking Topics
CREATE TABLE IF NOT EXISTS custom_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  context_prompt TEXT NOT NULL,
  ai_role TEXT NOT NULL,
  user_role TEXT NOT NULL,
  target_keywords TEXT[] DEFAULT '{}' NOT NULL,
  target_level skill_level DEFAULT 'b2' NOT NULL,
  is_public BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.4 Practice Sessions
CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES custom_topics(id) ON DELETE SET NULL,
  mode practice_mode NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  overall_score NUMERIC(3,1) CHECK (overall_score >= 0.0 AND overall_score <= 9.0),
  pronunciation_score NUMERIC(3,1) CHECK (pronunciation_score >= 0.0 AND pronunciation_score <= 9.0),
  fluency_score NUMERIC(3,1) CHECK (fluency_score >= 0.0 AND fluency_score <= 9.0),
  lexical_score NUMERIC(3,1) CHECK (lexical_score >= 0.0 AND lexical_score <= 9.0),
  grammar_score NUMERIC(3,1) CHECK (grammar_score >= 0.0 AND grammar_score <= 9.0),
  words_per_minute NUMERIC(5,1) DEFAULT 0.0 CHECK (words_per_minute >= 0.0),
  hesitation_count INTEGER DEFAULT 0 CHECK (hesitation_count >= 0),
  transcript_dialogue JSONB DEFAULT '[]'::jsonb NOT NULL,
  detailed_feedback JSONB DEFAULT '{}'::jsonb NOT NULL,
  ai_provider_used ai_provider,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.5 Phoneme & Word Pronunciation Error Logs
CREATE TABLE IF NOT EXISTS pronunciation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  expected_ipa TEXT NOT NULL,
  spoken_ipa TEXT NOT NULL,
  accuracy_score NUMERIC(4,2) NOT NULL CHECK (accuracy_score >= 0.0 AND accuracy_score <= 1.0),
  error_type TEXT NOT NULL, -- 'missing_ending_sound', 'wrong_vowel', 'incorrect_stress', 'omission', 'substitution'
  audio_timestamp_start NUMERIC(6,2),
  audio_timestamp_end NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.6 Vocabulary Bank & Spaced Repetition (SM-2 / Leitner)
CREATE TABLE IF NOT EXISTS vocabulary_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  ipa TEXT,
  definition_en TEXT NOT NULL,
  definition_vi TEXT,
  example_sentence TEXT,
  collocations TEXT[] DEFAULT '{}' NOT NULL,
  synonyms TEXT[] DEFAULT '{}' NOT NULL,
  mastery_level INTEGER DEFAULT 1 NOT NULL CHECK (mastery_level BETWEEN 1 AND 5),
  next_review_date DATE DEFAULT CURRENT_DATE NOT NULL,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_user_vocab_word UNIQUE (user_id, word)
);

-- ==============================================================================
-- 4. INDEXES (OPTIMIZED FOR QUERY LATENCY)
-- ==============================================================================

-- Composite Index for user practice sessions chronologically
CREATE INDEX IF NOT EXISTS idx_sessions_user_created 
  ON practice_sessions(user_id, created_at DESC);

-- GIN Index for searching dialogue JSON transcripts
CREATE INDEX IF NOT EXISTS idx_sessions_dialogue_gin 
  ON practice_sessions USING gin(transcript_dialogue);

-- GIN Index for querying detailed feedback JSON structure
CREATE INDEX IF NOT EXISTS idx_sessions_feedback_gin 
  ON practice_sessions USING gin(detailed_feedback);

-- Index for session pronunciation lookups
CREATE INDEX IF NOT EXISTS idx_pronunciation_session 
  ON pronunciation_logs(session_id, created_at ASC);

-- Index for user pronunciation lookups by word
CREATE INDEX IF NOT EXISTS idx_pronunciation_user_word 
  ON pronunciation_logs(user_id, word);

-- Composite Index for user vocabulary spaced repetition review
CREATE INDEX IF NOT EXISTS idx_vocab_user_review 
  ON vocabulary_bank(user_id, next_review_date ASC);

-- Index for custom topics by user
CREATE INDEX IF NOT EXISTS idx_custom_topics_user 
  ON custom_topics(user_id, created_at DESC);

-- ==============================================================================
-- 5. TRIGGERS FOR UPDATED_AT
-- ==============================================================================
CREATE TRIGGER trigger_update_profiles_timestamp
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_encrypted_keys_timestamp
  BEFORE UPDATE ON user_encrypted_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_custom_topics_timestamp
  BEFORE UPDATE ON custom_topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_vocabulary_bank_timestamp
  BEFORE UPDATE ON vocabulary_bank
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES - 100% TABLES ENABLED (ANTI-IDOR)
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_encrypted_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pronunciation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_bank ENABLE ROW LEVEL SECURITY;

-- 6.1 Policies for `profiles`
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 6.2 Policies for `user_encrypted_keys`
CREATE POLICY "Users can view their own encrypted keys"
  ON user_encrypted_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own encrypted keys"
  ON user_encrypted_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own encrypted keys"
  ON user_encrypted_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own encrypted keys"
  ON user_encrypted_keys FOR DELETE
  USING (auth.uid() = user_id);

-- 6.3 Policies for `custom_topics`
CREATE POLICY "Users can view their own or public topics"
  ON custom_topics FOR SELECT
  USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can insert their own topics"
  ON custom_topics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own topics"
  ON custom_topics FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own topics"
  ON custom_topics FOR DELETE
  USING (auth.uid() = user_id);

-- 6.4 Policies for `practice_sessions`
CREATE POLICY "Users can view their own practice sessions"
  ON practice_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own practice sessions"
  ON practice_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own practice sessions"
  ON practice_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own practice sessions"
  ON practice_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- 6.5 Policies for `pronunciation_logs`
CREATE POLICY "Users can view their own pronunciation logs"
  ON pronunciation_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pronunciation logs"
  ON pronunciation_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pronunciation logs"
  ON pronunciation_logs FOR DELETE
  USING (auth.uid() = user_id);

-- 6.6 Policies for `vocabulary_bank`
CREATE POLICY "Users can view their own vocabulary"
  ON vocabulary_bank FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vocabulary"
  ON vocabulary_bank FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocabulary"
  ON vocabulary_bank FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vocabulary"
  ON vocabulary_bank FOR DELETE
  USING (auth.uid() = user_id);
