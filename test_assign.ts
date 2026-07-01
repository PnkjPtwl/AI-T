import { supabase } from './backend/db/supabase';

async function testInsert() {
  const { data, error } = await supabase
    .from('training_assignments')
    .insert([{
      rep_id: '123e4567-e89b-12d3-a456-426614174000',
      scenario_id: '123e4567-e89b-12d3-a456-426614174000',
      manager_id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'Pending',
      priority: 'Medium',
      deadline: '2026-07-07'
    }]);
  console.log("Error:", error);
}

testInsert();
