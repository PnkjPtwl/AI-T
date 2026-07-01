import express from 'express'
import { authenticate } from '../middleware/auth'
import { getAnamSessionToken } from '../controllers/anamController'

const router = express.Router()

// POST /api/anam/session-token
// Returns a short-lived Anam session token for the browser SDK.
// Requires a valid JWT (rep or manager can use this during a session).
router.post('/session-token', authenticate, getAnamSessionToken)

export default router
