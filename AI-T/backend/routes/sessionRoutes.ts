import express from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth'
import { repOnly } from '../middleware/roleGuard'
import { getMySessions, startPractice, sendMessage, endSession, getSession, deleteSession, liveSentiment, processLiveTurn, processLiveCoach } from '../controllers/sessionController'

const router = express.Router()

// GET /api/sessions/my-sessions
router.get('/my-sessions', authenticate, repOnly, getMySessions)

// POST /api/sessions/start
router.post('/start', authenticate, repOnly, startPractice)

// POST /api/sessions/message
router.post('/message', authenticate, repOnly, sendMessage)

// Removed voice-message route

// POST /api/sessions/live-sentiment
router.post('/live-sentiment', authenticate, repOnly, liveSentiment)

// POST /api/sessions/live-turn
router.post('/live-turn', authenticate, repOnly, processLiveTurn)

// POST /api/sessions/live-coach
router.post('/live-coach', authenticate, repOnly, processLiveCoach)

// POST /api/sessions/end
router.post('/end', authenticate, repOnly, endSession)

// GET /api/sessions/:sessionId
router.get('/:sessionId', authenticate, getSession)

// DELETE /api/sessions/:sessionId
router.delete('/:sessionId', authenticate, deleteSession)

export default router
