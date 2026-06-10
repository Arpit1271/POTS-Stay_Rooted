-- ============================================
-- POTS MVP — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    location TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. POTS (posts)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 500),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pots_user_id ON public.pots(user_id);
CREATE INDEX idx_pots_created_at ON public.pots(created_at DESC);

ALTER TABLE public.pots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pots are publicly readable"
    ON public.pots FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create pots"
    ON public.pots FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pots"
    ON public.pots FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 3. LIKES
-- ============================================
CREATE TABLE IF NOT EXISTS public.likes (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pot_id UUID NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, pot_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes are publicly readable"
    ON public.likes FOR SELECT
    USING (true);

CREATE POLICY "Users can like"
    ON public.likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
    ON public.likes FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 4. FOLLOWS
-- ============================================
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are publicly readable"
    ON public.follows FOR SELECT
    USING (true);

CREATE POLICY "Users can follow"
    ON public.follows FOR INSERT
    WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
    ON public.follows FOR DELETE
    USING (auth.uid() = follower_id);

-- ============================================
-- 5. COMMENTS (replies)
-- ============================================
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pot_id UUID NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 500),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_pot_id ON public.comments(pot_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are publicly readable"
    ON public.comments FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can comment"
    ON public.comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
    ON public.comments FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 6. REPOSTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.reposts (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pot_id UUID NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, pot_id)
);

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reposts are publicly readable"
    ON public.reposts FOR SELECT
    USING (true);

CREATE POLICY "Users can repost"
    ON public.reposts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can un-repost"
    ON public.reposts FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 7. BOOKMARKS
-- ============================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pot_id UUID NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, pot_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bookmarks"
    ON public.bookmarks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can bookmark"
    ON public.bookmarks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can un-bookmark"
    ON public.bookmarks FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 8. NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('like', 'follow', 'reply', 'repost')),
    pot_id UUID REFERENCES public.pots(id) ON DELETE CASCADE,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can create notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 9. AUTO-CREATE PROFILE ON SIGNUP (Trigger)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 10. NOTIFICATION TRIGGERS
-- ============================================

-- Notify on like
CREATE OR REPLACE FUNCTION public.handle_new_like()
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_created ON public.likes;
CREATE TRIGGER on_like_created
    AFTER INSERT ON public.likes
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_like();

-- Notify on follow
CREATE OR REPLACE FUNCTION public.handle_new_follow()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.following_id != NEW.follower_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type)
        VALUES (NEW.following_id, NEW.follower_id, 'follow');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_created ON public.follows;
CREATE TRIGGER on_follow_created
    AFTER INSERT ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_follow();

-- Notify on comment
CREATE OR REPLACE FUNCTION public.handle_new_comment()
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
CREATE TRIGGER on_comment_created
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_comment();

-- Notify on repost
CREATE OR REPLACE FUNCTION public.handle_new_repost()
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_repost_created ON public.reposts;
CREATE TRIGGER on_repost_created
    AFTER INSERT ON public.reposts
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_repost();

-- ============================================
-- 11. HELPER VIEWS
-- ============================================

-- View for pots with counts + author info
CREATE OR REPLACE VIEW public.pots_with_details AS
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

-- ============================================
-- 12. STORAGE BUCKET
-- ============================================
-- Run these in Supabase Dashboard > Storage, or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('pot-images', 'pot-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read pot images" ON storage.objects
    FOR SELECT USING (bucket_id = 'pot-images');

CREATE POLICY "Auth users upload pot images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'pot-images' AND auth.role() = 'authenticated');

CREATE POLICY "Public read avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Auth users upload avatars" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users update avatars" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Public read covers" ON storage.objects
    FOR SELECT USING (bucket_id = 'covers');

CREATE POLICY "Auth users upload covers" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users update covers" ON storage.objects
    FOR UPDATE USING (bucket_id = 'covers' AND auth.role() = 'authenticated');
