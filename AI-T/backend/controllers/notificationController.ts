import { supabase } from '../db/supabase'

// ─────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────
export type NotificationType =
  | 'assignment_overdue'
  | 'score_critical'
  | 'attempt_limit'
  | 'assignment_completed'
  | 'score_low'
  | 'no_activity'
  | 'training_started'
  | 'score_improved'
  | 'deadline_approaching'
  | 'assignment_created'
  | 'score_high'
  | 'scenario_updated'

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low'

interface CreateNotificationParams {
  orgId: string
  managerId: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  body: string
  metadata?: Record<string, any>
}

// ─────────────────────────────────────────────────────
// CORE HELPER — called from other controllers
// ─────────────────────────────────────────────────────
export const createNotification = async (params: CreateNotificationParams): Promise<void> => {
  try {
    const { error } = await supabase.from('notifications').insert({
      org_id: params.orgId,
      manager_id: params.managerId,
      type: params.type,
      priority: params.priority,
      title: params.title,
      body: params.body,
      metadata: params.metadata || {},
    })

    if (error) {
      // Gracefully fail — never let notification errors break core flows
      console.warn('[createNotification] Failed to insert notification:', error.message)
    }
  } catch (err: any) {
    console.warn('[createNotification] Unexpected error:', err.message)
  }
}

// ─────────────────────────────────────────────────────
// DEDUPLICATION HELPER — avoid spamming same notification
// Checks if a notification of the same type + metadata.assignmentId
// already exists in the last 24 hours
// ─────────────────────────────────────────────────────
export const notificationExists = async (
  managerId: string,
  type: NotificationType,
  assignmentId?: string
): Promise<boolean> => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    if (assignmentId) {
      // Check ALL notifications (read or unread) of this type for this assignment in last 24h.
      // We intentionally include read ones — otherwise the scanner re-creates a notification
      // the manager just dismissed, causing it to appear again on the next 30s poll.
      const { data: detailed } = await supabase
        .from('notifications')
        .select('id, metadata')
        .eq('manager_id', managerId)
        .eq('type', type)
        .gte('created_at', since)

      return (detailed || []).some(
        (n: any) => n.metadata?.assignmentId === assignmentId
      )
    }

    const { data } = await supabase
      .from('notifications')
      .select('id')
      .eq('manager_id', managerId)
      .eq('type', type)
      .gte('created_at', since)
      .limit(1)

    return (data || []).length > 0
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────
// DEADLINE SCANNER
// Scans training_assignments for:
//   - Overdue (past deadline, not completed) → critical
//   - Approaching deadline (within 48h) → medium
//   - No activity in 3+ days (In Progress) → high
// Called from GET /api/manager/notifications to stay current
// ─────────────────────────────────────────────────────
const scanDeadlines = async (managerId: string, orgId: string): Promise<void> => {
  try {
    const now = new Date()
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    const ago3d = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    // Fetch all non-completed assignments managed by this manager
    const { data: assignments, error } = await supabase
      .from('training_assignments')
      .select(`
        id,
        rep_id,
        scenario_id,
        status,
        deadline,
        updated_at,
        rep:users!rep_id(id, name),
        scenario:training_scenarios!training_assignments_scenario_id_fkey(id, persona_name, contact_title, contact_company)
      `)
      .eq('manager_id', managerId)
      .neq('status', 'Completed')

    if (error || !assignments) return

    for (const a of assignments) {
      const rep = (a as any).rep
      const scenario = (a as any).scenario
      const repName = rep?.name || 'A rep'
      const scenarioTitle =
        scenario?.contact_title
          ? `${scenario.contact_title} - ${scenario.contact_company || ''}`
          : scenario?.persona_name || 'Unknown Scenario'
      const deadline = a.deadline ? new Date(a.deadline) : null

      // 1. OVERDUE
      if (deadline && deadline < now && a.status !== 'Overdue') {
        const alreadyExists = await notificationExists(managerId, 'assignment_overdue', a.id)
        if (!alreadyExists) {
          await createNotification({
            orgId,
            managerId,
            type: 'assignment_overdue',
            priority: 'critical',
            title: 'Assignment Overdue',
            body: `${repName}'s training on "${scenarioTitle}" has passed its deadline without completion.`,
            metadata: {
              repName,
              repId: rep?.id,
              scenarioTitle,
              assignmentId: a.id,
            },
          })
        }
      }

      // 2. APPROACHING DEADLINE (within 48h, not yet overdue)
      if (deadline && deadline > now && deadline < in48h) {
        const alreadyExists = await notificationExists(managerId, 'deadline_approaching', a.id)
        if (!alreadyExists) {
          const hoursLeft = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60))
          await createNotification({
            orgId,
            managerId,
            type: 'deadline_approaching',
            priority: 'medium',
            title: 'Deadline Approaching',
            body: `${repName}'s training on "${scenarioTitle}" is due in ${hoursLeft} hours.`,
            metadata: {
              repName,
              repId: rep?.id,
              scenarioTitle,
              assignmentId: a.id,
              hoursLeft,
            },
          })
        }
      }

      // 3. NO ACTIVITY (In Progress but no session activity in 3+ days)
      if (a.status === 'In Progress') {
        const lastUpdate = new Date(a.updated_at)
        if (lastUpdate < ago3d) {
          const alreadyExists = await notificationExists(managerId, 'no_activity', a.id)
          if (!alreadyExists) {
            await createNotification({
              orgId,
              managerId,
              type: 'no_activity',
              priority: 'high',
              title: 'No Recent Activity',
              body: `${repName} hasn't made progress on "${scenarioTitle}" in over 3 days.`,
              metadata: {
                repName,
                repId: rep?.id,
                scenarioTitle,
                assignmentId: a.id,
              },
            })
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[scanDeadlines] Error during scan:', err.message)
  }
}

// ─────────────────────────────────────────────────────
// GET /api/manager/notifications
// Returns all notifications for the authenticated manager.
// Also triggers deadline scan to ensure freshness.
// ─────────────────────────────────────────────────────
export const getNotifications = async (req: any, res: any) => {
  const managerId = req.user.id
  const orgId = req.user.org_id

  try {
    // Run deadline scanner on every GET (debounced by 24h dedup logic)
    await scanDeadlines(managerId, orgId)

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('manager_id', managerId)
      .eq('read', false)           // ← only return unread; dismissed ones never come back
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    // All returned notifications are unread by definition
    const unreadCount = (data || []).length

    res.json({
      notifications: data || [],
      unreadCount,
    })
  } catch (err: any) {
    console.error('[getNotifications] Error:', err)
    res.status(500).json({ error: 'Failed to fetch notifications', message: err.message })
  }
}

// ─────────────────────────────────────────────────────
// PATCH /api/manager/notifications/:id/read
// Mark a single notification as read
// ─────────────────────────────────────────────────────
export const markNotificationRead = async (req: any, res: any) => {
  const managerId = req.user.id
  const { id } = req.params

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('manager_id', managerId) // security: only own notifications

    if (error) throw error
    res.json({ success: true })
  } catch (err: any) {
    console.error('[markNotificationRead] Error:', err)
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
}

// ─────────────────────────────────────────────────────
// PATCH /api/manager/notifications/read-all
// Mark all notifications for this manager as read
// ─────────────────────────────────────────────────────
export const markAllNotificationsRead = async (req: any, res: any) => {
  const managerId = req.user.id

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('manager_id', managerId)
      .eq('read', false)

    if (error) throw error
    res.json({ success: true })
  } catch (err: any) {
    console.error('[markAllNotificationsRead] Error:', err)
    res.status(500).json({ error: 'Failed to mark all notifications as read' })
  }
}
