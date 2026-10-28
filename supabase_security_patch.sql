-- ==============================================================================
-- TAMSPEAK PRODUCTION DATABASE SECURITY PATCH (ROW LEVEL SECURITY & ANTI-IDOR)
-- Target: Google Cloud / Supabase PostgreSQL Database
-- Objective: Fix Critical Data Leakage & Enforce Strict Per-User Tenant Isolation
-- Standards: OWASP Top 10 (A01: Broken Access Control), CWE-284, CWE-639 (IDOR)
-- ==============================================================================

-- 1. Ensure 'unrated' skill level is available for clean new user initialization
ALTER TYPE skill_level ADD VALUE IF NOT EXISTS 'unrated';

-- ==============================================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS) ACROSS ALL USER DATA TABLES
-- ==============================================================================
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custom_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vocabulary_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pronunciation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_encrypted_keys ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (prevents accidental bypass during service connections)
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

-- Practice Sessions
DROP POLICY IF EXISTS "Users can view their own practice sessions" ON practice_sessions;
DROP POLICY IF EXISTS "Users can insert their own practice sessions" ON practice_sessions;
DROP POLICY IF EXISTS "Users can update their own practice sessions" ON practice_sessions;
DROP POLICY IF EXISTS "Users can delete their own practice sessions" ON practice_sessions;

-- Custom Topics
DROP POLICY IF EXISTS "Users can view their own or public topics" ON custom_topics;
DROP POLICY IF EXISTS "Users can insert their own topics" ON custom_topics;
DROP POLICY IF EXISTS "Users can update their own topics" ON custom_topics;
DROP POLICY IF EXISTS "Users can delete their own topics" ON custom_topics;

-- Vocabulary Bank
DROP POLICY IF EXISTS "Users can view their own vocabulary" ON vocabulary_bank;
DROP POLICY IF EXISTS "Users can insert their own vocabulary" ON vocabulary_bank;
DROP POLICY IF EXISTS "Users can update their own vocabulary" ON vocabulary_bank;
DROP POLICY IF EXISTS "Users can delete their own vocabulary" ON vocabulary_bank;

-- Pronunciation Logs
DROP POLICY IF EXISTS "Users can view their own pronunciation logs" ON pronunciation_logs;
DROP POLICY IF EXISTS "Users can insert their own pronunciation logs" ON pronunciation_logs;
DROP POLICY IF EXISTS "Users can delete their own pronunciation logs" ON pronunciation_logs;

-- User Encrypted Keys
DROP POLICY IF EXISTS "Users can view their own encrypted keys" ON user_encrypted_keys;
DROP POLICY IF EXISTS "Users can insert their own encrypted keys" ON user_encrypted_keys;
DROP POLICY IF EXISTS "Users can update their own encrypted keys" ON user_encrypted_keys;
DROP POLICY IF EXISTS "Users can delete their own encrypted keys" ON user_encrypted_keys;

-- ==============================================================================
-- 4. CREATE HARDENED ANTI-IDOR POLICIES USING auth.uid()
-- ==============================================================================

-- 4.1 Table: profiles (Primary Key is id = auth.uid())
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- 4.2 Table: practice_sessions (Foreign Key is user_id = auth.uid())
CREATE POLICY "practice_sessions_select_own"
  ON practice_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "practice_sessions_insert_own"
  ON practice_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "practice_sessions_update_own"
  ON practice_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "practice_sessions_delete_own"
  ON practice_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4.3 Table: custom_topics (Read own or public, write own only)
CREATE POLICY "custom_topics_select_own_or_public"
  ON custom_topics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "custom_topics_insert_own"
  ON custom_topics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "custom_topics_update_own"
  ON custom_topics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "custom_topics_delete_own"
  ON custom_topics FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4.4 Table: vocabulary_bank (Foreign Key is user_id = auth.uid())
CREATE POLICY "vocabulary_bank_select_own"
  ON vocabulary_bank FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "vocabulary_bank_insert_own"
  ON vocabulary_bank FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vocabulary_bank_update_own"
  ON vocabulary_bank FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vocabulary_bank_delete_own"
  ON vocabulary_bank FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4.5 Table: pronunciation_logs (Foreign Key is user_id = auth.uid())
CREATE POLICY "pronunciation_logs_select_own"
  ON pronunciation_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "pronunciation_logs_insert_own"
  ON pronunciation_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pronunciation_logs_delete_own"
  ON pronunciation_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4.6 Table: user_encrypted_keys (Vault Storage, Foreign Key is user_id = auth.uid())
CREATE POLICY "user_encrypted_keys_select_own"
  ON user_encrypted_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_encrypted_keys_insert_own"
  ON user_encrypted_keys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_encrypted_keys_update_own"
  ON user_encrypted_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_encrypted_keys_delete_own"
  ON user_encrypted_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 5. AUTOMATED CLEAN INITIAL PROFILE TRIGGER (CLEAN SLATE INITIALIZATION)
-- Ensures new signups start at 100% clean state:
-- - current_level: 'unrated'
-- - streak_days: 0
-- - total_practice_minutes: 0
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

-- Patch complete notification
SELECT 'TamSpeak Supabase Security Patch applied successfully. 100% tables secured with anti-IDOR RLS.' AS status;
