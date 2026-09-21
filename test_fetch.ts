import { supabase } from './src/lib/supabase.ts';

async function testFetch() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  console.log("User:", user?.id);
  
  const { data, error } = await supabase
    .from('study_group_members')
    .select(`
      group_id,
      study_groups (
        id, name, invite_code, created_by, created_at
      )
    `)
    .eq('user_id', user?.id);
    
  console.log("Data:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}

testFetch();

