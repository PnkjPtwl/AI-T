import express from 'express'
import {
  managerSignup,
  repSignup,
  login,
  getDeepgramKey
} from '../controllers/authController'
import { authenticate } from '../middleware/auth'

const router = express.Router()

router.post('/signup/manager', managerSignup)  // manager creates org
router.post('/signup/rep', repSignup)          // rep joins via invite code
router.post('/login', login)                   // both use same login
router.get('/deepgram-key', authenticate, getDeepgramKey)

export default router