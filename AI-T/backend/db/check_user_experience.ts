import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config()

async function checkExperience() {
  const url = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(url, serviceKey)

  const { data: users } = await supabase.from('users').select('*')
  const { data: exps } = await supabase.from('user_experience').select('*')

  console.log('\n--- USERS & EXPERIENCE DATA IN DB ---')
  console.table(
    (users || []).map(u => {
      const expRow = (exps || []).find(e => e.user_id === u.id)
      const years = expRow ? expRow.experience_years : 'Not Set'
      let bracket = 'N/A'
      if (typeof years === 'number') {
        if (years < 1) bracket = '<1 Year (<1)'
        else if (years <= 2) bracket = '1-2 Years (1-2)'
        else bracket = '>2 Years (>2)'
      }
      return {
        'User Name': u.name,
        'Email': u.email,
        'Role': u.role,
        'Experience (Years)': years,
        'Bracket Filter': bracket,
        'User ID': u.id
      }
    })
  )
}

checkExperience().catch(console.error)
