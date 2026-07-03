import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function deleteActiveTrainings() {
  console.log('Deleting trainings (excluding personas)...')

  // First let's check what's there
  const { data: aData, error: aErr } = await supabase.from('training_assignments').select('*')
  const { data: sData, error: sErr } = await supabase.from('training_sessions').select('*')

  console.log(`Found ${aData?.length || 0} assignments and ${sData?.length || 0} sessions.`)

  // Deleting assignments (both active and completed just in case, but let's delete all)
  const { error: err1 } = await supabase
    .from('training_assignments')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // hack to delete all since supabase requires a filter for delete

  if (err1) {
    console.error('Error deleting assignments:', err1)
  } else {
    console.log('Deleted training assignments.')
  }

  // Deleting sessions
  const { error: err2 } = await supabase
    .from('training_sessions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (err2) {
    console.error('Error deleting sessions:', err2)
  } else {
    console.log('Deleted training sessions.')
  }
}

deleteActiveTrainings()
