import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function debug() {
  console.log('🔍 Checking manager_notes table...')
  
  const { data, error } = await supabase
    .from('manager_notes')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Table error:', error.message)
    if (error.message.includes('does not exist')) {
      console.log('💡 Table manager_notes is MISSING.')
    }
  } else {
    console.log('✅ Table exists. Data:', data)
  }
}

debug()
