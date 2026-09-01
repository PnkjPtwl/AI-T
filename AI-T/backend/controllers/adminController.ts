import { supabase } from '../db/supabase'
import { getSupabase } from '../db/supabase'
import { MANAGED_KEYS, invalidateApiKeyCache } from '../lib/apiKeys'

/**
 * GET /api/admin/stats
 * Overview counts for the admin dashboard
 */
export const getAdminStats = async (req: any, res: any) => {
  try {
    const { count: totalManagers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'manager')

    const { count: totalReps } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'rep')

    // Assigned reps = reps that appear in manager_rep_assignments
    const { data: assignedRepRows } = await supabase
      .from('manager_rep_assignments')
      .select('rep_id')

    const assignedRepIds = new Set((assignedRepRows || []).map((r: any) => r.rep_id))
    const unassignedReps = (totalReps || 0) - assignedRepIds.size

    // Managers with at least one rep
    const { data: managerRows } = await supabase
      .from('manager_rep_assignments')
      .select('manager_id')

    const managersWithReps = new Set((managerRows || []).map((r: any) => r.manager_id))
    const unassignedManagers = (totalManagers || 0) - managersWithReps.size

    // Count orgs
    const { count: totalOrgs } = await supabase
      .from('organisations')
      .select('id', { count: 'exact', head: true })

    res.json({
      totalManagers: totalManagers || 0,
      totalReps: totalReps || 0,
      assignedReps: assignedRepIds.size,
      unassignedReps: Math.max(0, unassignedReps),
      unassignedManagers: Math.max(0, unassignedManagers),
      totalOrgs: totalOrgs || 0
    })
  } catch (err: any) {
    console.error('[admin/stats] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * GET /api/admin/managers
 * List all managers with their assigned rep count
 */
export const getManagers = async (req: any, res: any) => {
  try {
    const { data: managers, error } = await supabase
      .from('users')
      .select('id, name, email, org_id, created_at')
      .eq('role', 'manager')
      .order('name', { ascending: true })

    if (error) throw error

    // Get all assignments to count reps per manager
    const { data: assignments } = await supabase
      .from('manager_rep_assignments')
      .select('manager_id, rep_id')

    const repCountMap: Record<string, number> = {}
    ;(assignments || []).forEach((a: any) => {
      repCountMap[a.manager_id] = (repCountMap[a.manager_id] || 0) + 1
    })

    // Get org names
    const orgIds = [...new Set((managers || []).map(m => m.org_id))].filter(Boolean)
    const { data: orgs } = await supabase
      .from('organisations')
      .select('id, name')
      .in('id', orgIds.length > 0 ? orgIds : ['00000000-0000-0000-0000-000000000000'])

    const orgMap: Record<string, string> = {}
    ;(orgs || []).forEach((o: any) => { orgMap[o.id] = o.name })

    const result = (managers || []).map(m => ({
      ...m,
      org_name: orgMap[m.org_id] || 'Unknown',
      rep_count: repCountMap[m.id] || 0
    }))

    res.json(result)
  } catch (err: any) {
    console.error('[admin/managers] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * GET /api/admin/reps
 * List all reps with their assigned manager info
 */
export const getReps = async (req: any, res: any) => {
  try {
    const { data: reps, error } = await supabase
      .from('users')
      .select('id, name, email, org_id, created_at')
      .eq('role', 'rep')
      .order('name', { ascending: true })

    if (error) throw error

    // Get all assignments
    const { data: assignments } = await supabase
      .from('manager_rep_assignments')
      .select('rep_id, manager_id')

    const repManagerMap: Record<string, string> = {}
    ;(assignments || []).forEach((a: any) => {
      repManagerMap[a.rep_id] = a.manager_id
    })

    // Get manager names
    const managerIds = [...new Set(Object.values(repManagerMap))].filter(Boolean)
    let managerNameMap: Record<string, string> = {}
    if (managerIds.length > 0) {
      const { data: managers } = await supabase
        .from('users')
        .select('id, name')
        .in('id', managerIds)
      ;(managers || []).forEach((m: any) => { managerNameMap[m.id] = m.name })
    }

    // Get org names
    const orgIds = [...new Set((reps || []).map(r => r.org_id))].filter(Boolean)
    const { data: orgs } = await supabase
      .from('organisations')
      .select('id, name')
      .in('id', orgIds.length > 0 ? orgIds : ['00000000-0000-0000-0000-000000000000'])

    const orgMap: Record<string, string> = {}
    ;(orgs || []).forEach((o: any) => { orgMap[o.id] = o.name })

    const result = (reps || []).map(r => ({
      ...r,
      org_name: orgMap[r.org_id] || 'Unknown',
      manager_id: repManagerMap[r.id] || null,
      manager_name: repManagerMap[r.id] ? (managerNameMap[repManagerMap[r.id]] || 'Unknown') : null,
      is_assigned: !!repManagerMap[r.id]
    }))

    res.json(result)
  } catch (err: any) {
    console.error('[admin/reps] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * GET /api/admin/unassigned-reps
 */
export const getUnassignedReps = async (req: any, res: any) => {
  try {
    const { data: assignedRows } = await supabase
      .from('manager_rep_assignments')
      .select('rep_id')

    const assignedIds = (assignedRows || []).map((r: any) => r.rep_id)

    let query = supabase
      .from('users')
      .select('id, name, email, org_id, created_at')
      .eq('role', 'rep')
      .order('created_at', { ascending: false })

    if (assignedIds.length > 0) {
      // Filter out assigned reps — use NOT IN workaround
      const { data: allReps } = await query
      const result = (allReps || []).filter(r => !assignedIds.includes(r.id))
      return res.json(result)
    }

    const { data, error } = await query
    if (error) throw error
    res.json(data || [])
  } catch (err: any) {
    console.error('[admin/unassigned-reps] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * GET /api/admin/unassigned-managers
 */
export const getUnassignedManagers = async (req: any, res: any) => {
  try {
    const { data: assignedRows } = await supabase
      .from('manager_rep_assignments')
      .select('manager_id')

    const managersWithReps = new Set((assignedRows || []).map((r: any) => r.manager_id))

    const { data: allManagers, error } = await supabase
      .from('users')
      .select('id, name, email, org_id, created_at')
      .eq('role', 'manager')
      .order('created_at', { ascending: false })

    if (error) throw error

    const result = (allManagers || []).filter(m => !managersWithReps.has(m.id))
    res.json(result)
  } catch (err: any) {
    console.error('[admin/unassigned-managers] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * POST /api/admin/assign-rep
 * Body: { repId, managerId }
 */
export const assignRep = async (req: any, res: any) => {
  const { repId, managerId } = req.body
  const adminId = req.user.id

  if (!repId || !managerId) {
    return res.status(400).json({ error: 'repId and managerId are required' })
  }

  try {
    // Verify rep exists and is a rep
    const { data: rep } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', repId)
      .single()

    if (!rep || rep.role !== 'rep') {
      return res.status(404).json({ error: 'Rep not found' })
    }

    // Verify manager exists and is a manager
    const { data: manager } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', managerId)
      .single()

    if (!manager || manager.role !== 'manager') {
      return res.status(404).json({ error: 'Manager not found' })
    }

    // Upsert (handles re-assignment from one manager to another)
    const { error } = await supabase
      .from('manager_rep_assignments')
      .upsert({
        manager_id: managerId,
        rep_id: repId,
        assigned_by: adminId
      }, { onConflict: 'rep_id' })

    if (error) throw error

    res.json({
      success: true,
      message: `${rep.name} assigned to ${manager.name}`
    })
  } catch (err: any) {
    console.error('[admin/assign-rep] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * POST /api/admin/unassign-rep
 * Body: { repId }
 */
export const unassignRep = async (req: any, res: any) => {
  const { repId } = req.body

  if (!repId) {
    return res.status(400).json({ error: 'repId is required' })
  }

  try {
    const { error } = await supabase
      .from('manager_rep_assignments')
      .delete()
      .eq('rep_id', repId)

    if (error) throw error

    res.json({ success: true, message: 'Rep unassigned successfully' })
  } catch (err: any) {
    console.error('[admin/unassign-rep] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * POST /api/admin/bulk-assign
 * Body: { repIds: string[], managerId: string }
 */
export const bulkAssign = async (req: any, res: any) => {
  const { repIds, managerId } = req.body
  const adminId = req.user.id

  if (!repIds || !Array.isArray(repIds) || repIds.length === 0 || !managerId) {
    return res.status(400).json({ error: 'repIds array and managerId are required' })
  }

  try {
    // Verify manager
    const { data: manager } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', managerId)
      .single()

    if (!manager || manager.role !== 'manager') {
      return res.status(404).json({ error: 'Manager not found' })
    }

    const rows = repIds.map((repId: string) => ({
      manager_id: managerId,
      rep_id: repId,
      assigned_by: adminId
    }))

    // Upsert all — handles re-assignment
    const { error } = await supabase
      .from('manager_rep_assignments')
      .upsert(rows, { onConflict: 'rep_id' })

    if (error) throw error

    res.json({
      success: true,
      message: `${repIds.length} rep(s) assigned to ${manager.name}`,
      count: repIds.length
    })
  } catch (err: any) {
    console.error('[admin/bulk-assign] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * GET /api/admin/manager/:managerId/reps
 * List reps assigned to a specific manager
 */
export const getManagerReps = async (req: any, res: any) => {
  const { managerId } = req.params

  try {
    const { data: assignments } = await supabase
      .from('manager_rep_assignments')
      .select('rep_id')
      .eq('manager_id', managerId)

    const repIds = (assignments || []).map((a: any) => a.rep_id)

    if (repIds.length === 0) return res.json([])

    const { data: reps, error } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .in('id', repIds)
      .order('name', { ascending: true })

    if (error) throw error
    res.json(reps || [])
  } catch (err: any) {
    console.error('[admin/manager-reps] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// =============================================================================
// API Key Management
// =============================================================================

/** Mask a key value — show only last 4 chars */
function maskKey(value: string): string {
  if (!value || value.length <= 8) return '••••••••'
  return '••••••••' + value.slice(-4)
}

/**
 * GET /api/admin/api-keys
 * Returns managed key names, masked values, source, and updated_at
 */
export const getApiKeys = async (req: any, res: any) => {
  try {
    const sb = await getSupabase()
    const { data: rows } = await sb
      .from('api_keys')
      .select('key_name, key_value, updated_at')

    const dbMap: Record<string, { masked: string; updated_at: string }> = {}
    ;(rows || []).forEach((r: any) => {
      dbMap[r.key_name] = {
        masked: maskKey(r.key_value),
        updated_at: r.updated_at,
      }
    })

    const result = MANAGED_KEYS.map(keyName => {
      const inDb = !!dbMap[keyName]
      const inEnv = !!process.env[keyName]
      return {
        key_name: keyName,
        source: inDb ? 'supabase' : inEnv ? 'env' : 'none',
        masked_value: inDb
          ? dbMap[keyName].masked
          : inEnv
          ? maskKey(process.env[keyName]!)
          : null,
        updated_at: inDb ? dbMap[keyName].updated_at : null,
      }
    })

    res.json(result)
  } catch (err: any) {
    console.error('[admin/api-keys] GET Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * POST /api/admin/api-keys
 * Body: { key_name: string, key_value: string }
 * Upserts the key into Supabase and immediately invalidates the cache.
 */
export const setApiKey = async (req: any, res: any) => {
  const { key_name, key_value } = req.body
  const adminId = req.user.id

  if (!key_name || !key_value) {
    return res.status(400).json({ error: 'key_name and key_value are required' })
  }
  if (!(MANAGED_KEYS as readonly string[]).includes(key_name)) {
    return res.status(400).json({ error: `key_name must be one of: ${MANAGED_KEYS.join(', ')}` })
  }
  if (key_value.trim().length < 10) {
    return res.status(400).json({ error: 'key_value is too short to be a valid API key' })
  }

  try {
    const sb = await getSupabase()
    const { error } = await sb
      .from('api_keys')
      .upsert({
        key_name,
        key_value: key_value.trim(),
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      }, { onConflict: 'key_name' })

    if (error) throw error

    // Immediately invalidate in-memory cache so new key is used right away
    invalidateApiKeyCache(key_name)

    console.log(`[admin/api-keys] ✅ ${key_name} updated by admin ${adminId}`)
    res.json({ success: true, message: `${key_name} updated successfully` })
  } catch (err: any) {
    console.error('[admin/api-keys] SET Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * DELETE /api/admin/api-keys/:keyName
 * Removes the key from Supabase — backend will fall back to .env
 */
export const deleteApiKey = async (req: any, res: any) => {
  const { keyName } = req.params

  if (!(MANAGED_KEYS as readonly string[]).includes(keyName)) {
    return res.status(400).json({ error: `keyName must be one of: ${MANAGED_KEYS.join(', ')}` })
  }

  try {
    const sb = await getSupabase()
    const { error } = await sb
      .from('api_keys')
      .delete()
      .eq('key_name', keyName)

    if (error) throw error

    // Invalidate cache so it falls back to .env immediately
    invalidateApiKeyCache(keyName)

    console.log(`[admin/api-keys] 🗑️  ${keyName} deleted — falling back to .env`)
    res.json({ success: true, message: `${keyName} removed. Falling back to .env value.` })
  } catch (err: any) {
    console.error('[admin/api-keys] DELETE Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// =============================================================================
// Cerebras API Analytics & Costs
// =============================================================================

/**
 * GET /api/admin/llm-config
 * Get current balance and cost configuration for Cerebras
 */
export const getLlmConfig = async (req: any, res: any) => {
  try {
    const sb = await getSupabase()
    
    // 1. Try api_costs table
    try {
      const { data, error } = await sb
        .from('api_costs')
        .select('*')
        .eq('provider', 'cerebras')
        .single()

      if (!error && data) {
        const bal = Number(data.balance ?? 4.43)
        return res.json({
          provider: 'cerebras',
          balance: bal,
          globalBalance: bal,
          input_token_cost: Number(data.input_token_cost ?? 0.0000006),
          output_token_cost: Number(data.output_token_cost ?? 0.0000006),
          updated_at: data.updated_at
        })
      }
    } catch (e) {}

    // 2. Fallback to api_keys table
    const { data: keyData } = await sb
      .from('api_keys')
      .select('key_value, updated_at')
      .eq('key_name', 'CEREBRAS_USAGE_DATA')
      .single()

    let bal = 4.43
    if (keyData?.key_value) {
      try {
        const parsed = JSON.parse(keyData.key_value)
        if (parsed.balance !== undefined) bal = Number(parsed.balance)
      } catch (e) {}
    }

    res.json({
      provider: 'cerebras',
      balance: bal,
      globalBalance: bal,
      input_token_cost: 0.0000006,
      output_token_cost: 0.0000006,
      updated_at: keyData?.updated_at || new Date().toISOString()
    })
  } catch (err: any) {
    console.error('[admin/llm-config] GET Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * POST /api/admin/llm-config
 * Body: { balance: number, globalBalance?: number, inputTokenCost?: number, outputTokenCost?: number }
 */
export const setLlmConfig = async (req: any, res: any) => {
  const balanceVal = req.body.globalBalance !== undefined ? req.body.globalBalance : req.body.balance
  const inputCost = req.body.inputTokenCost !== undefined ? Number(req.body.inputTokenCost) : 0.0000006
  const outputCost = req.body.outputTokenCost !== undefined ? Number(req.body.outputTokenCost) : 0.0000006

  if (balanceVal === undefined || isNaN(Number(balanceVal))) {
    return res.status(400).json({ error: 'Valid balance is required' })
  }

  const numBal = Number(balanceVal)

  try {
    const sb = await getSupabase()

    // 1. Try updating api_costs
    try {
      await sb
        .from('api_costs')
        .upsert({
          provider: 'cerebras',
          balance: numBal,
          input_token_cost: inputCost,
          output_token_cost: outputCost,
          updated_at: new Date().toISOString()
        }, { onConflict: 'provider' })
    } catch (e) {}

    // 2. Also update api_keys backup store
    const { data: existing } = await sb
      .from('api_keys')
      .select('key_value')
      .eq('key_name', 'CEREBRAS_USAGE_DATA')
      .single()

    let usageData: any = { balance: numBal, logs: [] }
    if (existing?.key_value) {
      try {
        usageData = JSON.parse(existing.key_value)
      } catch (e) {}
    }
    usageData.balance = numBal

    await sb.from('api_keys').upsert({
      key_name: 'CEREBRAS_USAGE_DATA',
      key_value: JSON.stringify(usageData),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key_name' })

    res.json({
      success: true,
      balance: numBal,
      globalBalance: numBal,
      message: 'Cerebras balance updated successfully'
    })
  } catch (err: any) {
    console.error('[admin/llm-config] POST Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

/**
 * GET /api/admin/llm-usage
 * Get aggregated LLM usage stats & logs
 */
export const getLlmUsage = async (req: any, res: any) => {
  try {
    const sb = await getSupabase()
    
    // 1. Try fetching from api_usage_logs table
    try {
      const { data: logs, error } = await sb
        .from('api_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error && logs && logs.length > 0) {
        let totalInput = 0
        let totalOutput = 0
        let totalCost = 0
        const sessionCostMap: Record<string, number> = {}

        const formattedLogs = logs.map((log: any) => {
          const inTok = log.input_tokens || 0
          const outTok = log.output_tokens || 0
          const cost = Number(log.total_cost || 0)

          totalInput += inTok
          totalOutput += outTok
          totalCost += cost

          if (log.session_id) {
            sessionCostMap[log.session_id] = (sessionCostMap[log.session_id] || 0) + cost
          }

          return {
            id: log.id,
            created_at: log.created_at,
            endpoint_name: log.call_type || log.endpoint_name || 'Inference',
            model_name: log.model || log.model_name || 'Cerebras LLM',
            prompt_tokens: inTok,
            completion_tokens: outTok,
            cost: cost,
            session_id: log.session_id,
            user_id: log.user_id
          }
        })

        const numCalls = formattedLogs.length
        const numSessions = Object.keys(sessionCostMap).length

        const metrics = {
          totalCalls: numCalls,
          totalTokens: totalInput + totalOutput,
          totalCost: totalCost,
          avgInputTokens: Math.round(totalInput / numCalls),
          avgOutputTokens: Math.round(totalOutput / numCalls),
          avgCostPerSession: numSessions > 0 ? (totalCost / numSessions) : (totalCost / numCalls),
          totalInputTokens: totalInput,
          totalOutputTokens: totalOutput
        }

        return res.json({
          metrics,
          logs: formattedLogs,
          ...metrics
        })
      }
    } catch (e) {}

    // 2. Fallback to api_keys store
    const { data: keyData } = await sb
      .from('api_keys')
      .select('key_value')
      .eq('key_name', 'CEREBRAS_USAGE_DATA')
      .single()

    if (keyData?.key_value) {
      try {
        const parsed = JSON.parse(keyData.key_value)
        const logs = parsed.logs || []
        const totalCalls = parsed.totalCalls || logs.length
        const totalInput = parsed.totalInputTokens || 0
        const totalOutput = parsed.totalOutputTokens || 0
        const totalCost = parsed.totalCost || 0
        const numSessions = Object.keys(parsed.sessionCosts || {}).length

        const metrics = {
          totalCalls,
          totalTokens: totalInput + totalOutput,
          totalCost,
          avgInputTokens: totalCalls > 0 ? Math.round(totalInput / totalCalls) : 0,
          avgOutputTokens: totalCalls > 0 ? Math.round(totalOutput / totalCalls) : 0,
          avgCostPerSession: numSessions > 0 ? (totalCost / numSessions) : (totalCalls > 0 ? (totalCost / totalCalls) : 0),
          totalInputTokens: totalInput,
          totalOutputTokens: totalOutput
        }

        return res.json({
          metrics,
          logs,
          ...metrics
        })
      } catch (e) {}
    }

    // Default empty response
    const defaultMetrics = {
      totalCalls: 0,
      totalTokens: 0,
      totalCost: 0,
      avgInputTokens: 0,
      avgOutputTokens: 0,
      avgCostPerSession: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0
    }

    res.json({
      metrics: defaultMetrics,
      logs: [],
      ...defaultMetrics
    })

  } catch (err: any) {
    console.error('[admin/llm-usage] GET Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
