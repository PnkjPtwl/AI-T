import express from 'express'
import { authenticate } from '../middleware/auth'
import { managerOnly } from '../middleware/roleGuard'
import { 
  getScenarios, 
  createScenario, 
  getScenario, 
  getScenarioById,
  getManagerScenarios,
  updateScenario, 
  deleteScenario, 
  assignRepsToScenario, 
  getScenarioAssignments, 
  generateScorecardMetrics 
} from '../controllers/scenarioController'
import { uploadAvatarMiddleware, handleAvatarUpload } from '../controllers/avatarController'
import { listKbAccounts } from '../utils/ragClient'

const router = express.Router()

// GET /api/scenarios (manager and rep can view org scenarios)
router.get('/', authenticate, getScenarios)

// GET /api/scenarios/manager/library — Manager Persona Library grid
router.get('/manager/library', authenticate, managerOnly, getManagerScenarios)

// POST /api/scenarios/upload-avatar — Local Avatar Image upload via multer
router.post('/upload-avatar', authenticate, managerOnly, uploadAvatarMiddleware, handleAvatarUpload)

// POST /api/scenarios/generate-scorecard — AI generates dynamic scorecard metrics from persona context
router.post('/generate-scorecard', authenticate, managerOnly, generateScorecardMetrics)

// GET /api/scenarios/kb-accounts — list all KB accounts for the account selector dropdown
router.get('/kb-accounts', authenticate, managerOnly, async (_req, res) => {
  const accounts = await listKbAccounts()
  res.json({ accounts })
})

// GET /api/scenarios/:scenarioId (fetch single scenario details for briefing / slideover)
router.get('/:scenarioId', authenticate, getScenarioById)

// POST /api/scenarios (managers only can create)
router.post('/', authenticate, managerOnly, createScenario)

// PUT /api/scenarios/:scenarioId (managers only can update)
router.put('/:scenarioId', authenticate, managerOnly, updateScenario)

// DELETE /api/scenarios/:scenarioId (managers only can delete)
router.delete('/:scenarioId', authenticate, managerOnly, deleteScenario)

// POST /api/scenarios/:scenarioId/assign (managers only can assign)
router.post('/:scenarioId/assign', authenticate, managerOnly, assignRepsToScenario)

// GET /api/scenarios/:scenarioId/reps (managers view assignments)
router.get('/:scenarioId/reps', authenticate, managerOnly, getScenarioAssignments)

export default router
