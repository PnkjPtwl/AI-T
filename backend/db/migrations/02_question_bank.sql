CREATE TABLE public.question_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
    scenario_id UUID REFERENCES public.training_scenarios(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    question_text TEXT NOT NULL,
    total_ratings INTEGER DEFAULT 0,
    average_rating NUMERIC(3,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

-- Add Policies
CREATE POLICY "Enable read access for organization users"
    ON public.question_bank FOR SELECT
    USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Enable write access for organization managers"
    ON public.question_bank FOR ALL
    USING (
        org_id IN (
            SELECT org_id FROM public.users 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );
