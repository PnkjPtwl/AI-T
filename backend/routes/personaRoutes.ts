import express from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth'
import { managerOnly } from '../middleware/roleGuard'
import { generatePersonaFromAudio } from '../controllers/personaController'

const router = express.Router()

// Store file in memory for AssemblyAI upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB max
})

// POST /api/persona/from-audio
router.post(
  '/from-audio',
  authenticate,
  managerOnly,
  upload.single('file'),
  generatePersonaFromAudio
)

export default router
