import express from 'express'
import { authenticate } from '../middleware/auth'
import { managerOnly } from '../middleware/roleGuard'
import { 
  generateQuestions, 
  getQuestions,
  rateQuestion,
  addQuestion
} from '../controllers/questionController'

const router = express.Router()

// POST /api/questions/generate
router.post('/generate', authenticate, managerOnly, generateQuestions)

// GET /api/questions
router.get('/', authenticate, managerOnly, getQuestions)

// POST /api/questions/rate
router.post('/rate', authenticate, managerOnly, rateQuestion)

// POST /api/questions
router.post('/', authenticate, managerOnly, addQuestion)

export default router
