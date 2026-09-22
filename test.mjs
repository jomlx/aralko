
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data } = await supabase.from('sessions').select('*').limit(1);
console.log('Sessions global read:', data);
const { data: us } = await supabase.from('user_settings').select('*').limit(1);
console.log('UserSettings:', us);

