import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function getUsers() {
  const { data, error } = await supabase.from('users').select('*')
  if (error) console.error(error)
  else {
    const managers = data.filter(u => u.role === 'manager')
    const reps = data.filter(u => u.role === 'rep')
    console.log(`Managers (${managers.length}):`, managers.map(m => m.name || m.email))
    console.log(`Reps (${reps.length}):`, reps.map(r => r.name || r.email))
  }
}

getUsers()
