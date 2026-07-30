import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function cleanupSessions() {
  console.log('Starting session cleanup...')
  
  // Delete sessions with epoch date (1970) or null feedback
  const { data, error } = await supabase
    .from('training_sessions')
    .delete()
    .or('completed_at.lt.2000-01-01,feedback_json.is.null')

  if (error) {
    console.error('Error deleting sessions:', error)
  } else {
    console.log('Cleanup successful. Records removed.')
  }
}

cleanupSessions()
