import { Router } from 'express'
import { getRepDashboard, getRepStats, getManagerAnalytics } from '../controllers/dashboardController'
import { authenticate } from '../middleware/auth'

const router = Router()

// Rep Routes
router.get('/reps/me/dashboard', authenticate, getRepDashboard)
router.get('/reps/me/stats', authenticate, getRepStats)

// Manager Routes
router.get('/manager/analytics', authenticate, getManagerAnalytics)

export default router
