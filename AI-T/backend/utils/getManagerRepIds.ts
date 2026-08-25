import { supabase } from '../db/supabase'

/**
 * Returns the list of rep UUIDs assigned to a given manager
 * via the manager_rep_assignments table.
 * Returns empty array if manager has no assigned reps.
 */
export async function getManagerRepIds(managerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('manager_rep_assignments')
    .select('rep_id')
    .eq('manager_id', managerId)

  if (error) {
    console.warn('[getManagerRepIds] Error fetching rep assignments:', error.message)
    return []
  }

  return (data || []).map((row: any) => row.rep_id)
}

/**
 * Returns the manager_id for a given rep, or null if unassigned.
 */
export async function getRepManagerId(repId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('manager_rep_assignments')
    .select('manager_id')
    .eq('rep_id', repId)
    .single()

  if (error || !data) return null
  return data.manager_id
}
