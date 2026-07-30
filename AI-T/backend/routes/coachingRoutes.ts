import express from 'express'
import { authenticate } from '../middleware/auth'
import { repOnly } from '../middleware/roleGuard'
import { getMySignals, generateStudyGuide } from '../controllers/coachingController'

const router = express.Router()

// GET /api/coaching/my-signals
router.get('/my-signals', authenticate, repOnly, getMySignals)

// POST /api/coaching/generate-guide
router.post('/generate-guide', authenticate, generateStudyGuide)

export default router
