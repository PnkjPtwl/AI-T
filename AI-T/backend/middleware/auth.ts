import { supabase } from '../db/supabase'

// Attaches req.user = { id, role, org_id, name } from the JWT token
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.split(' ')[1]

  // Verify the JWT via Supabase (service-role client can validate any token)
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  // Fetch role + org_id from our users table
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, role, org_id, name, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return res.status(401).json({ error: 'User profile not found' })
  }

  req.user = profile  // { id, role, org_id, name }
  next()
}
