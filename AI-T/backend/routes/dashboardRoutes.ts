import { Router } from 'express'
import { getRepDashboard, getManagerAnalytics } from '../controllers/dashboardController'
import { authenticate } from '../middleware/auth'

const router = Router()

// Rep Routes
router.get('/reps/me/dashboard', authenticate, getRepDashboard)

// Manager Routes
router.get('/manager/analytics', authenticate, getManagerAnalytics)

export default router
