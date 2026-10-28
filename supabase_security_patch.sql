-- ==============================================================================
-- TAMSPEAK PRODUCTION DATABASE SECURITY PATCH (ROW LEVEL SECURITY & ANTI-IDOR)
-- Target: Google Cloud / Supabase PostgreSQL Database
-- Objective: Fix Critical Data Leakage & Enforce Strict Per-User Tenant Isolation
-- Standards: OWASP Top 10 (A01: Broken Access Control), CWE-284, CWE-639 (IDOR)
-- ==============================================================================

-- 1. Ensure custom enum types exist before modifying or referencing them
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skill_level') THEN
    CREATE TYPE skill_level AS ENUM ('a2', 'b1', 'b2', 'c1', 'c2', 'unrated');
  ELSE
    BEGIN
      ALTER TYPE skill_level ADD VALUE IF NOT EXISTS 'unrated';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

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
END $$;

DO $$
BEGIN
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
-- 2. ENABLE ROW LEVEL SECURITY (RLS) ACROSS ALL USER DATA TABLES
-- ==============================================================================
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custom_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vocabulary_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pronunciation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_encrypted_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS practice_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custom_topics FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vocabulary_bank FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pronunciation_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_encrypted_keys FORCE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. DROP ALL LEGACY / OVERLY PERMISSIVE POLICIES
-- ==============================================================================
-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

-- Practice Sessions
DROP POLICY IF EXISTS "Users can view their own practice sessions" ON practice_sessions;
DROP POLICY IF EXISTS "Users can insert their own practice sessions" ON practice_sessions;
DROP POLICY IF EXISTS "Users can update their own practice sessions" ON practice_sessions;
DROP POLICY IF EXISTS "Users can delete their own practice sessions" ON practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_select_own" ON practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_insert_own" ON practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_update_own" ON practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_delete_own" ON practice_sessions;

-- Custom Topics
DROP POLICY IF EXISTS "Users can view their own or public topics" ON custom_topics;
DROP POLICY IF EXISTS "Users can insert their own topics" ON custom_topics;
DROP POLICY IF EXISTS "Users can update their own topics" ON custom_topics;
DROP POLICY IF EXISTS "Users can delete their own topics" ON custom_topics;
DROP POLICY IF EXISTS "custom_topics_select_own_or_public" ON custom_topics;
DROP POLICY IF EXISTS "custom_topics_insert_own" ON custom_topics;
DROP POLICY IF EXISTS "custom_topics_update_own" ON custom_topics;
DROP POLICY IF EXISTS "custom_topics_delete_own" ON custom_topics;

-- Vocabulary Bank
DROP POLICY IF EXISTS "Users can view their own vocabulary" ON vocabulary_bank;
DROP POLICY IF EXISTS "Users can insert their own vocabulary" ON vocabulary_bank;
DROP POLICY IF EXISTS "Users can update their own vocabulary" ON vocabulary_bank;
DROP POLICY IF EXISTS "Users can delete their own vocabulary" ON vocabulary_bank;
DROP POLICY IF EXISTS "vocabulary_bank_select_own" ON vocabulary_bank;
DROP POLICY IF EXISTS "vocabulary_bank_insert_own" ON vocabulary_bank;
DROP POLICY IF EXISTS "vocabulary_bank_update_own" ON vocabulary_bank;
DROP POLICY IF EXISTS "vocabulary_bank_delete_own" ON vocabulary_bank;

-- Pronunciation Logs
DROP POLICY IF EXISTS "Users can view their own pronunciation logs" ON pronunciation_logs;
DROP POLICY IF EXISTS "Users can insert their own pronunciation logs" ON pronunciation_logs;
DROP POLICY IF EXISTS "Users can delete their own pronunciation logs" ON pronunciation_logs;
DROP POLICY IF EXISTS "pronunciation_logs_select_own" ON pronunciation_logs;
DROP POLICY IF EXISTS "pronunciation_logs_insert_own" ON pronunciation_logs;
DROP POLICY IF EXISTS "pronunciation_logs_update_own" ON pronunciation_logs;
DROP POLICY IF EXISTS "pronunciation_logs_delete_own" ON pronunciation_logs;

-- User Encrypted Keys
DROP POLICY IF EXISTS "Users can view their own encrypted keys" ON user_encrypted_keys;
DROP POLICY IF EXISTS "Users can insert their own encrypted keys" ON user_encrypted_keys;
DROP POLICY IF EXISTS "Users can update their own encrypted keys" ON user_encrypted_keys;
DROP POLICY IF EXISTS "Users can delete their own encrypted keys" ON user_encrypted_keys;
DROP POLICY IF EXISTS "user_encrypted_keys_select_own" ON user_encrypted_keys;
DROP POLICY IF EXISTS "user_encrypted_keys_insert_own" ON user_encrypted_keys;
DROP POLICY IF EXISTS "user_encrypted_keys_update_own" ON user_encrypted_keys;
DROP POLICY IF EXISTS "user_encrypted_keys_delete_own" ON user_encrypted_keys;

-- ==============================================================================
-- 4. CREATE HARDENED ANTI-IDOR POLICIES USING auth.uid()
-- ==============================================================================

-- 4.1 Table: profiles (Primary Key is id = auth.uid())
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
    CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
    CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
    CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);
  END IF;
END $$;

-- 4.2 Table: practice_sessions (Foreign Key is user_id = auth.uid())
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'practice_sessions') THEN
    CREATE POLICY "practice_sessions_select_own" ON practice_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "practice_sessions_insert_own" ON practice_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "practice_sessions_update_own" ON practice_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "practice_sessions_delete_own" ON practice_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4.3 Table: custom_topics (Read own or public, write own only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_topics') THEN
    CREATE POLICY "custom_topics_select_own_or_public" ON custom_topics FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_public = TRUE);
    CREATE POLICY "custom_topics_insert_own" ON custom_topics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "custom_topics_update_own" ON custom_topics FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "custom_topics_delete_own" ON custom_topics FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4.4 Table: vocabulary_bank (Foreign Key is user_id = auth.uid())
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vocabulary_bank') THEN
    CREATE POLICY "vocabulary_bank_select_own" ON vocabulary_bank FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "vocabulary_bank_insert_own" ON vocabulary_bank FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "vocabulary_bank_update_own" ON vocabulary_bank FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "vocabulary_bank_delete_own" ON vocabulary_bank FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4.5 Table: pronunciation_logs (Foreign Key is user_id = auth.uid())
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pronunciation_logs') THEN
    CREATE POLICY "pronunciation_logs_select_own" ON pronunciation_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "pronunciation_logs_insert_own" ON pronunciation_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "pronunciation_logs_update_own" ON pronunciation_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "pronunciation_logs_delete_own" ON pronunciation_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4.6 Table: user_encrypted_keys (Vault Storage, Foreign Key is user_id = auth.uid())
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_encrypted_keys') THEN
    CREATE POLICY "user_encrypted_keys_select_own" ON user_encrypted_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "user_encrypted_keys_insert_own" ON user_encrypted_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "user_encrypted_keys_update_own" ON user_encrypted_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "user_encrypted_keys_delete_own" ON user_encrypted_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- ==============================================================================
-- 5. AUTOMATED CLEAN INITIAL PROFILE TRIGGER (CLEAN SLATE INITIALIZATION)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  clean_name TEXT;
  target_level_val skill_level;
BEGIN
  clean_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'Learner'
  );

  BEGIN
    target_level_val := 'unrated'::skill_level;
  EXCEPTION
    WHEN OTHERS THEN
      target_level_val := 'b2'::skill_level;
  END;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
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
      target_level_val,
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'TamSpeak Supabase Security Patch applied successfully. 100% tables secured with anti-IDOR RLS.' AS status;
