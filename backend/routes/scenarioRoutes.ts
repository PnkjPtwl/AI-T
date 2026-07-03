import express from 'express'
import { authenticate } from '../middleware/auth'
import { managerOnly } from '../middleware/roleGuard'
import { getScenarios, createScenario, getScenario, updateScenario, deleteScenario, assignRepsToScenario, getScenarioAssignments, getScorecardMetrics } from '../controllers/scenarioController'

const router = express.Router()

// GET /api/scenarios (manager and rep can view org scenarios)
router.get('/', authenticate, getScenarios)

// GET /api/scenarios/scorecard-metrics (canonical metrics list)
router.get('/scorecard-metrics', authenticate, getScorecardMetrics)

// GET /api/scenarios/:scenarioId (fetch single scenario)
router.get('/:scenarioId', authenticate, getScenario)

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
