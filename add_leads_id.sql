ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE public.leads SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.leads ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_pkey;
ALTER TABLE public.leads ADD PRIMARY KEY (id);
