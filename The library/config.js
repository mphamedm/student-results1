const SUPABASE_URL = 'https://cbaaadyzkpmdyfobjeoh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uXAG-ey5vLERuTbEwq3mCQ_gBIULkDN';
const BUCKET_NAME = 'pdf_files';

const sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
);

