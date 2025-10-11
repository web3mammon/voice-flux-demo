-- Extend ai_config table with all required fields
ALTER TABLE public.ai_config 
ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT 'Aria',
ADD COLUMN IF NOT EXISTS voice_speed DECIMAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS voice_stability DECIMAL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS voice_clarity DECIMAL DEFAULT 0.75,
ADD COLUMN IF NOT EXISTS auto_escalate_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_escalate_threshold INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS collect_email_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS send_summary_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS troll_detection_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS profanity_filter TEXT DEFAULT 'medium' CHECK (profanity_filter IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS max_call_duration INTEGER DEFAULT 10;

-- Create response templates table
CREATE TABLE IF NOT EXISTS public.response_templates (
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
CREATE TABLE IF NOT EXISTS public.prompt_versions (
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