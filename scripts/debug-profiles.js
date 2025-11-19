import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    // 1. Login as a test user (or just use anon if policies allow, but we want to test auth user)
    // We'll just check public access first since the policy is "viewable by everyone"

    console.log("Fetching profiles...");
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${data.length} profiles:`);
        data.forEach(p => console.log(`- ${p.username} (${p.id})`));
    }
}

checkProfiles();
