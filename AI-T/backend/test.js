require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('training_assignments')
    .insert([{
      rep_id: 'b50b3837-22d0-443f-a537-24c5c7f2d7bd', // user id from logs
      scenario_id: 'some-fake-uuid-0000-000000000000',
      manager_id: 'b50b3837-22d0-443f-a537-24c5c7f2d7bd',
      status: 'Pending',
      priority: 'Medium',
      deadline: '2026-07-07'
    }])
    .select();
  console.log("Error:", error?.message);
}
test();
