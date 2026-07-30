import express from 'express'
import {
  managerSignup,
  repSignup,
  login
} from '../controllers/authController'

const router = express.Router()

router.post('/signup/manager', managerSignup)  // manager creates org
router.post('/signup/rep', repSignup)          // rep joins via invite code
router.post('/login', login)                   // both use same login

export default router