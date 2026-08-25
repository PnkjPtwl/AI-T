import { supabase } from '../db/supabase'

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
