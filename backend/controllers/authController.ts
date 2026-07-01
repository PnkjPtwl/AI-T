import { getSupabase, getSupabaseAuth } from '../db/supabase'

export const managerSignup = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase()
  const password = req.body.password?.trim()
  const { name, orgName } = req.body

  if (!name || !email || !password || !orgName) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  try {
    const supabase = await getSupabase()
    const normalizedName = orgName.trim()
    let { data: org, error: orgFetchError } = await supabase
      .from('organisations')
      .select('id')
      .ilike('name', normalizedName)
      .single()

    if (!org) {
      const { data: newOrg, error: createError } = await supabase
        .from('organisations')
        .insert({ name: normalizedName })
        .select()
        .single()
      
      if (createError) throw createError
      org = newOrg
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })
    if (authError) return res.status(400).json({ error: authError.message })
    if (!authData.user) return res.status(400).json({ error: 'User creation failed' })

    const { error: userError } = await supabase.from('users').insert({
      id:     authData.user.id,
      name,
      email,
      role:   'manager',
      org_id: org.id
    })

    if (userError) throw userError

    return res.json({
      message: 'Manager account created',
      orgId: org.id
    })
  } catch (err: any) {
    console.error('Signup error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export const repSignup = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase()
  const password = req.body.password?.trim()
  const { name, orgName } = req.body

  if (!name || !email || !password || !orgName) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  try {
    const supabase = await getSupabase()
    const normalizedName = orgName.trim()
    let { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id')
      .ilike('name', normalizedName)
      .single()

    if (!org) {
      const { data: newOrg, error: createError } = await supabase
        .from('organisations')
        .insert({ name: normalizedName })
        .select()
        .single()
      
      if (createError) throw createError
      org = newOrg
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })
    if (authError) return res.status(400).json({ error: authError.message })
    if (!authData.user) return res.status(400).json({ error: 'User creation failed' })

    const { error: userError } = await supabase.from('users').insert({
      id:     authData.user.id,
      name,
      email,
      role:   'rep',
      org_id: org.id
    })

    if (userError) throw userError

    return res.json({ message: 'Rep account created' })
  } catch (err: any) {
    console.error('Rep Signup error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export const login = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase()
  const password = req.body.password?.trim()

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  console.log(`--- LOGIN ATTEMPT: ${email} ---`);

  const supabase = await getSupabase()
  const supabaseAuth = await getSupabaseAuth()

  let { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password })

  if (error && (error.message === 'Email not confirmed' || error.message.includes('confirm'))) {
    console.log(`⚠️  Email not confirmed for ${email} — auto-confirming via admin API...`)
    try {
      const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
      if (!listErr) {
        const match = users.find((u: any) => u.email?.toLowerCase() === email)
        if (match) {
          await supabase.auth.admin.updateUserById(match.id, { email_confirm: true })
          console.log(`✅ Auto-confirmed email for ${email}. Retrying login...`)
          const retry = await supabaseAuth.auth.signInWithPassword({ email, password })
          data  = retry.data
          error = retry.error
        }
      }
    } catch (e) {
      console.error('Auto-confirm failed:', e)
    }
  }

  if (error) {
    console.error(`❌ Login error for ${email}:`, error.message)
    return res.status(400).json({ error: error.message })
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role, org_id, name')
    .eq('id', data.user.id)
    .single()

  if (userError || !userData) {
    console.error('Profile fetch error:', userError)
    return res.status(500).json({ error: 'Could not fetch user profile' })
  }

  return res.json({
    token: data.session.access_token,
    role:  userData.role,
    orgId: userData.org_id,
    name:  userData.name
  })
}