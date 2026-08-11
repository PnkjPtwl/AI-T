import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config()

async function testFilterLogic() {
  const url = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(url, serviceKey)

  const { data: reps } = await supabase.from('users').select('id, name, role, org_id')
  const { data: userExpList } = await supabase.from('user_experience').select('user_id, experience_years')

  const expMap: Record<string, number> = {}
  if (userExpList) {
    userExpList.forEach((e: any) => {
      expMap[e.user_id] = e.experience_years
    })
  }

  const testFilters = ['all', '<1', '1-2', '>2']

  for (const experienceParam of testFilters) {
    const filteredReps = (reps || []).filter(r => {
      if (r.role === 'manager' || r.name?.toLowerCase().includes('lokesh')) return false
      if (!experienceParam || experienceParam === 'all') return true

      const years = expMap[r.id] !== undefined ? expMap[r.id] : 1

      if (experienceParam === '<1' || experienceParam === '0-1') {
        return years < 1
      } else if (experienceParam === '1-2') {
        return years >= 1 && years <= 2
      } else if (experienceParam === '>2' || experienceParam === '2+') {
        return years > 2
      }
      return true
    })

    console.log(`\n=== FILTER: "${experienceParam}" ===`)
    console.log(`Matching Reps Count: ${filteredReps.length}`)
    console.log(`Reps Included: ${filteredReps.map(r => `${r.name} (${expMap[r.id]} yrs)`).join(', ')}`)
  }
}

testFilterLogic().catch(console.error)
