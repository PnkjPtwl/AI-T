import express from 'express'
import { createConversation } from '../controllers/tavusController'
import { authenticate } from '../middleware/auth'

const router = express.Router()

// Ensure the user is authenticated before creating a Tavus session
router.post('/create-conversation', authenticate, createConversation)

export default router
