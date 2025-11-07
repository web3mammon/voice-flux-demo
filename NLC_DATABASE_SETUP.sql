-- ============================================================================
-- NLC VOICE AI - COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor for project: xkezkkfafxqmmxpdvtrp
-- ============================================================================

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'team_member');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create calls table for call history
CREATE TABLE public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    phone_number TEXT,
    duration INTEGER, -- in seconds
    transcript TEXT,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    topics TEXT[], -- array of topics
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view calls"
ON public.calls
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'));

CREATE POLICY "Admins can insert calls"
ON public.calls
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update calls"
ON public.calls
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete calls"
ON public.calls
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create ai_config table for GPT prompts
CREATE TABLE public.ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_version TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    voice_id TEXT DEFAULT 'Aria',
    voice_speed DECIMAL DEFAULT 1.0,
    voice_stability DECIMAL DEFAULT 0.5,
    voice_clarity DECIMAL DEFAULT 0.75,
    auto_escalate_enabled BOOLEAN DEFAULT false,
    auto_escalate_threshold INTEGER DEFAULT 3,
    collect_email_enabled BOOLEAN DEFAULT true,
    send_summary_enabled BOOLEAN DEFAULT true,
    troll_detection_enabled BOOLEAN DEFAULT true,
    profanity_filter TEXT DEFAULT 'medium' CHECK (profanity_filter IN ('low', 'medium', 'high')),
    max_call_duration INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view active config"
ON public.ai_config
FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage config"
ON public.ai_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create phone_numbers table
CREATE TABLE public.phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number TEXT NOT NULL UNIQUE,
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view phone numbers"
ON public.phone_numbers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'));

CREATE POLICY "Admins can manage phone numbers"
ON public.phone_numbers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create response templates table
CREATE TABLE public.response_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES public.ai_config(id) ON DELETE CASCADE,
    template_type TEXT NOT NULL CHECK (template_type IN ('greeting', 'pricing', 'after_hours', 'escalation', 'goodbye')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.response_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view templates"
ON public.response_templates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'));

CREATE POLICY "Admins can manage templates"
ON public.response_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create prompt version history table
CREATE TABLE public.prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES public.ai_config(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    system_prompt TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view prompt versions"
ON public.prompt_versions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'));

CREATE POLICY "Admins can create prompt versions"
ON public.prompt_versions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to auto-increment version number
CREATE OR REPLACE FUNCTION public.get_next_version_number(p_config_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM public.prompt_versions
  WHERE config_id = p_config_id;

  RETURN next_version;
END;
$$;

-- Create widget_config table
CREATE TABLE public.widget_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    position TEXT DEFAULT 'bottom-right' CHECK (position IN ('bottom-right', 'bottom-left', 'custom')),
    custom_position JSONB,
    primary_color TEXT DEFAULT '#6366f1',
    button_icon_url TEXT,
    button_text TEXT DEFAULT 'Talk to Sales',
    trigger_type TEXT DEFAULT 'immediately' CHECK (trigger_type IN ('immediately', 'after_delay', 'on_scroll')),
    trigger_delay INTEGER DEFAULT 0,
    display_mode TEXT DEFAULT 'all_pages' CHECK (display_mode IN ('all_pages', 'specific_urls')),
    allowed_urls TEXT[],
    hide_on_mobile BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.widget_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage widget config"
ON public.widget_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members can view widget config"
ON public.widget_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'));

-- Create storage bucket for widget icons
INSERT INTO storage.buckets (id, name, public)
VALUES ('widget-icons', 'widget-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for widget icons
CREATE POLICY "Public can view widget icons"
ON storage.objects
FOR SELECT
USING (bucket_id = 'widget-icons');

CREATE POLICY "Admins can upload widget icons"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'widget-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update widget icons"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'widget-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete widget icons"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'widget-icons' AND public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- SETUP COMPLETE!
-- Next steps:
-- 1. Set Supabase secrets for edge functions (GROQ_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY)
-- 2. Deploy voice-websocket edge function
-- 3. Test the setup
-- ============================================================================
