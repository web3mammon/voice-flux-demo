-- Create widget_config table
CREATE TABLE IF NOT EXISTS public.widget_config (
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