import express from 'express'
import { authenticate } from '../middleware/auth'
import { synthesizeSpeech, synthesizeSpeechBase64 } from '../controllers/ttsController'

const router = express.Router()

// POST /api/tts — convert text to ElevenLabs audio, stream back to client (audio/mpeg)
router.post('/', authenticate, synthesizeSpeech)

// POST /api/tts/base64 — convert text to PCM audio, return as base64 for Anam AI passthrough
router.post('/base64', authenticate, synthesizeSpeechBase64)

export default router
