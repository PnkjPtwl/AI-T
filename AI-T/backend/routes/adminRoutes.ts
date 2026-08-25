import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { adminOnly } from '../middleware/roleGuard'
import {
  getAdminStats,
  getManagers,
  getReps,
  getUnassignedReps,
  getUnassignedManagers,
  assignRep,
  unassignRep,
  bulkAssign,
  getManagerReps
} from '../controllers/adminController'

const router = Router()

// All routes require admin authentication
router.use(authenticate, adminOnly)

router.get('/stats', getAdminStats)
router.get('/managers', getManagers)
router.get('/reps', getReps)
router.get('/unassigned-reps', getUnassignedReps)
router.get('/unassigned-managers', getUnassignedManagers)
router.post('/assign-rep', assignRep)
router.post('/unassign-rep', unassignRep)
router.post('/bulk-assign', bulkAssign)
router.get('/manager/:managerId/reps', getManagerReps)

export default router
