const SUPABASE_URL = 'https://ffpkgcolcxckdurmgomi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmcGtnY29sY3hja2R1cm1nb21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNjk4MjksImV4cCI6MjA5NjY0NTgyOX0.bu-uShkgmVk9gH1mdn2_QuS1tfRqOBX-3FcPUkwSQWo';

// Initialize Supabase client
window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.isSupabaseConfigured = true;
