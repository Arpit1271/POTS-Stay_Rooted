-- ============================================
-- POTS — Production Security Migration
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================

-- 1. Create private schema for trigger functions
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Fix notifications INSERT policy (deprecated auth.role())
DROP POLICY IF EXISTS "Authenticated can create notifications" ON public.notifications;
CREATE POLICY "Authenticated can create notifications"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 3. Fix pots_with_details view (add security_invoker)
CREATE OR REPLACE VIEW public.pots_with_details
WITH (security_invoker = true) AS
SELECT
    p.*,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    pr.is_verified,
    (SELECT COUNT(*) FROM public.likes l WHERE l.pot_id = p.id) AS likes_count,
    (SELECT COUNT(*) FROM public.comments c WHERE c.pot_id = p.id) AS comments_count,
    (SELECT COUNT(*) FROM public.reposts r WHERE r.pot_id = p.id) AS reposts_count
FROM public.pots p
JOIN public.profiles pr ON p.user_id = pr.id;

-- 4. Move trigger functions to private schema

-- 4a. handle_new_user
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        'https://api.dicebear.com/7.x/initials/svg?seed=' || COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- 4b. handle_new_like
CREATE OR REPLACE FUNCTION private.handle_new_like()
RETURNS TRIGGER AS $$
DECLARE
    pot_owner UUID;
BEGIN
    SELECT user_id INTO pot_owner FROM public.pots WHERE id = NEW.pot_id;
    IF pot_owner IS NOT NULL AND pot_owner != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, pot_id)
        VALUES (pot_owner, NEW.user_id, 'like', NEW.pot_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION private.handle_new_like() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_like_created ON public.likes;
CREATE TRIGGER on_like_created
    AFTER INSERT ON public.likes
    FOR EACH ROW EXECUTE FUNCTION private.handle_new_like();

-- 4c. handle_new_follow
CREATE OR REPLACE FUNCTION private.handle_new_follow()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.following_id != NEW.follower_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type)
        VALUES (NEW.following_id, NEW.follower_id, 'follow');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION private.handle_new_follow() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_follow_created ON public.follows;
CREATE TRIGGER on_follow_created
    AFTER INSERT ON public.follows
    FOR EACH ROW EXECUTE FUNCTION private.handle_new_follow();

-- 4d. handle_new_comment
CREATE OR REPLACE FUNCTION private.handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    pot_owner UUID;
BEGIN
    SELECT user_id INTO pot_owner FROM public.pots WHERE id = NEW.pot_id;
    IF pot_owner IS NOT NULL AND pot_owner != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, pot_id)
        VALUES (pot_owner, NEW.user_id, 'reply', NEW.pot_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION private.handle_new_comment() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
CREATE TRIGGER on_comment_created
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION private.handle_new_comment();

-- 4e. handle_new_repost
CREATE OR REPLACE FUNCTION private.handle_new_repost()
RETURNS TRIGGER AS $$
DECLARE
    pot_owner UUID;
BEGIN
    SELECT user_id INTO pot_owner FROM public.pots WHERE id = NEW.pot_id;
    IF pot_owner IS NOT NULL AND pot_owner != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, pot_id)
        VALUES (pot_owner, NEW.user_id, 'repost', NEW.pot_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION private.handle_new_repost() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_repost_created ON public.reposts;
CREATE TRIGGER on_repost_created
    AFTER INSERT ON public.reposts
    FOR EACH ROW EXECUTE FUNCTION private.handle_new_repost();

-- 5. Drop old public trigger functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_like() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_follow() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_comment() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_repost() CASCADE;

-- 6. Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION private.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION private.handle_updated_at();

-- 7. Harden storage policies

-- 7a. pot-images: drop old, create restricted
DROP POLICY IF EXISTS "Public read pot images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload pot images" ON storage.objects;

CREATE POLICY "Public read pot images" ON storage.objects
    FOR SELECT USING (bucket_id = 'pot-images');

CREATE POLICY "Users upload own pot images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'pot-images'
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

CREATE POLICY "Users update own pot images" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'pot-images'
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

CREATE POLICY "Users delete own pot images" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'pot-images'
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

-- 7b. avatars: drop old, create restricted
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth users update avatars" ON storage.objects;

CREATE POLICY "Public read avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

CREATE POLICY "Users update own avatar" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

CREATE POLICY "Users delete own avatar" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

-- 7c. covers: drop old, create restricted
DROP POLICY IF EXISTS "Public read covers" ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Auth users update covers" ON storage.objects;

CREATE POLICY "Public read covers" ON storage.objects
    FOR SELECT USING (bucket_id = 'covers');

CREATE POLICY "Users upload own cover" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'covers'
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

CREATE POLICY "Users update own cover" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'covers'
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

CREATE POLICY "Users delete own cover" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'covers'
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

-- 8. Fix remaining storage policies using deprecated auth.role()
-- (Already handled above by using TO authenticated instead)

-- Done! All security hardening applied.
