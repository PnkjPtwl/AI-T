import express from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth'
import { repOnly } from '../middleware/roleGuard'
import { 
  getMySessions, 
  startPractice, 
  sendMessage, 
  sendVoiceMessage, 
  endSession, 
  getSession,
  deleteSession
} from '../controllers/sessionController'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// GET /api/sessions/my-sessions
router.get('/my-sessions', authenticate, repOnly, getMySessions)

// POST /api/sessions/start
router.post('/start', authenticate, repOnly, startPractice)

// POST /api/sessions/message
router.post('/message', authenticate, repOnly, sendMessage)

// POST /api/sessions/voice-message
router.post('/voice-message', authenticate, repOnly, upload.single('audio'), sendVoiceMessage)

// POST /api/sessions/end
router.post('/end', authenticate, repOnly, endSession)

// GET /api/sessions/:sessionId
router.get('/:sessionId', authenticate, getSession)

// DELETE /api/sessions/:sessionId
router.delete('/:sessionId', authenticate, deleteSession)

export default router
