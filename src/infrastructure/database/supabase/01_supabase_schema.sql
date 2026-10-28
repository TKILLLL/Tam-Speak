-- ==============================================================================
-- TAMSPEAK COMPLETE ALL-IN-ONE DATABASE SCHEMA & ZERO-TRUST RLS SETUP
-- Target: Google Cloud / Supabase PostgreSQL Database
-- Purpose: Creates all tables, types, triggers, and Row Level Security (RLS) policies
-- Safe & Idempotent: Can be run on fresh databases or existing installations.
-- ==============================================================================

-- 0. Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. ENUM TYPES (Idempotent creation)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'practice_mode') THEN
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
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skill_level') THEN
    CREATE TYPE skill_level AS ENUM ('a2', 'b1', 'b2', 'c1', 'c2', 'unrated');
  ELSE
    BEGIN
      ALTER TYPE skill_level ADD VALUE IF NOT EXISTS 'unrated';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_provider') THEN
    CREATE TYPE ai_provider AS ENUM (
      'gemini_pro',
      'gemini_flash',
      'gemini_flash_lite',
      'groq',
      'openrouter'
    );
  END IF;
END $$;

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
-- 3. CREATE TABLES IF NOT EXIST
-- ==============================================================================

-- 3.1 Profiles Table (Mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  target_band NUMERIC(2,1) DEFAULT 7.5 CHECK (target_band >= 0.0 AND target_band <= 9.0),
  current_level skill_level DEFAULT 'unrated',
  streak_days INTEGER DEFAULT 0 CHECK (streak_days >= 0),
  last_practice_date DATE,
  total_practice_minutes INTEGER DEFAULT 0 CHECK (total_practice_minutes >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.2 User Encrypted API Keys (Zero-Trust Cryptographic Vault Storage)
CREATE TABLE IF NOT EXISTS public.user_encrypted_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS public.custom_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.custom_topics(id) ON DELETE SET NULL,
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
CREATE TABLE IF NOT EXISTS public.pronunciation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  expected_ipa TEXT NOT NULL,
  actual_ipa TEXT NOT NULL,
  error_type TEXT NOT NULL,
  accuracy_score NUMERIC(4,3) CHECK (accuracy_score >= 0.0 AND accuracy_score <= 1.0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3.6 Vocabulary Bank & Spaced Repetition (SM-2)
CREATE TABLE IF NOT EXISTS public.vocabulary_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  ipa TEXT,
  definition_en TEXT NOT NULL,
  definition_vi TEXT,
  example_sentence TEXT,
  collocations TEXT[] DEFAULT '{}' NOT NULL,
  synonyms TEXT[] DEFAULT '{}' NOT NULL,
  mastery_level INTEGER DEFAULT 1 CHECK (mastery_level >= 1 AND mastery_level <= 5),
  next_review_date DATE DEFAULT CURRENT_DATE NOT NULL,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_user_word UNIQUE (user_id, word)
);

-- ==============================================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_encrypted_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pronunciation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_bank ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_encrypted_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE public.custom_topics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pronunciation_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_bank FORCE ROW LEVEL SECURITY;

-- ==============================================================================
-- 5. DROP OLD POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

DROP POLICY IF EXISTS "practice_sessions_select_own" ON public.practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_insert_own" ON public.practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_update_own" ON public.practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_delete_own" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can view their own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can insert their own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can update their own practice sessions" ON public.practice_sessions;

DROP POLICY IF EXISTS "custom_topics_select_own_or_public" ON public.custom_topics;
DROP POLICY IF EXISTS "custom_topics_insert_own" ON public.custom_topics;
DROP POLICY IF EXISTS "custom_topics_update_own" ON public.custom_topics;
DROP POLICY IF EXISTS "custom_topics_delete_own" ON public.custom_topics;
DROP POLICY IF EXISTS "Users can view their own or public topics" ON public.custom_topics;
DROP POLICY IF EXISTS "Users can insert their own topics" ON public.custom_topics;
DROP POLICY IF EXISTS "Users can update their own topics" ON public.custom_topics;

DROP POLICY IF EXISTS "vocabulary_bank_select_own" ON public.vocabulary_bank;
DROP POLICY IF EXISTS "vocabulary_bank_insert_own" ON public.vocabulary_bank;
DROP POLICY IF EXISTS "vocabulary_bank_update_own" ON public.vocabulary_bank;
DROP POLICY IF EXISTS "vocabulary_bank_delete_own" ON public.vocabulary_bank;
DROP POLICY IF EXISTS "Users can view their own vocabulary" ON public.vocabulary_bank;
DROP POLICY IF EXISTS "Users can insert their own vocabulary" ON public.vocabulary_bank;
DROP POLICY IF EXISTS "Users can update their own vocabulary" ON public.vocabulary_bank;

DROP POLICY IF EXISTS "pronunciation_logs_select_own" ON public.pronunciation_logs;
DROP POLICY IF EXISTS "pronunciation_logs_insert_own" ON public.pronunciation_logs;
DROP POLICY IF EXISTS "pronunciation_logs_update_own" ON public.pronunciation_logs;
DROP POLICY IF EXISTS "pronunciation_logs_delete_own" ON public.pronunciation_logs;
DROP POLICY IF EXISTS "Users can view their own pronunciation logs" ON public.pronunciation_logs;
DROP POLICY IF EXISTS "Users can insert their own pronunciation logs" ON public.pronunciation_logs;

DROP POLICY IF EXISTS "user_encrypted_keys_select_own" ON public.user_encrypted_keys;
DROP POLICY IF EXISTS "user_encrypted_keys_insert_own" ON public.user_encrypted_keys;
DROP POLICY IF EXISTS "user_encrypted_keys_update_own" ON public.user_encrypted_keys;
DROP POLICY IF EXISTS "user_encrypted_keys_delete_own" ON public.user_encrypted_keys;
DROP POLICY IF EXISTS "Users can view their own encrypted keys" ON public.user_encrypted_keys;
DROP POLICY IF EXISTS "Users can insert their own encrypted keys" ON public.user_encrypted_keys;

-- ==============================================================================
-- 6. CREATE STRICT ANTI-IDOR ROW LEVEL SECURITY POLICIES
-- ==============================================================================

-- 6.1 Table: profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- 6.2 Table: practice_sessions
CREATE POLICY "practice_sessions_select_own" ON public.practice_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "practice_sessions_insert_own" ON public.practice_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "practice_sessions_update_own" ON public.practice_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "practice_sessions_delete_own" ON public.practice_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6.3 Table: custom_topics
CREATE POLICY "custom_topics_select_own_or_public" ON public.custom_topics FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_public = TRUE);
CREATE POLICY "custom_topics_insert_own" ON public.custom_topics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "custom_topics_update_own" ON public.custom_topics FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "custom_topics_delete_own" ON public.custom_topics FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6.4 Table: vocabulary_bank
CREATE POLICY "vocabulary_bank_select_own" ON public.vocabulary_bank FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "vocabulary_bank_insert_own" ON public.vocabulary_bank FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vocabulary_bank_update_own" ON public.vocabulary_bank FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vocabulary_bank_delete_own" ON public.vocabulary_bank FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6.5 Table: pronunciation_logs
CREATE POLICY "pronunciation_logs_select_own" ON public.pronunciation_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pronunciation_logs_insert_own" ON public.pronunciation_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pronunciation_logs_update_own" ON public.pronunciation_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pronunciation_logs_delete_own" ON public.pronunciation_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6.6 Table: user_encrypted_keys
CREATE POLICY "user_encrypted_keys_select_own" ON public.user_encrypted_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_encrypted_keys_insert_own" ON public.user_encrypted_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_encrypted_keys_update_own" ON public.user_encrypted_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_encrypted_keys_delete_own" ON public.user_encrypted_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. CLEAN NEW USER INITIALIZATION TRIGGER (AUTH.USERS -> PUBLIC.PROFILES)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  clean_name TEXT;
BEGIN
  clean_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'Learner'
  );

  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    target_band,
    current_level,
    streak_days,
    total_practice_minutes,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    clean_name,
    NEW.raw_user_meta_data->>'avatar_url',
    7.5,
    'unrated'::skill_level,
    0,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'TamSpeak All-in-One Database Schema & Anti-IDOR RLS initialized successfully.' AS status;
