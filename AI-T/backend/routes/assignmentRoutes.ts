import { Router } from 'express'
import { createAssignments, getManagerAssignments, getAssignmentDetails } from '../controllers/assignmentController'
import { authenticate } from '../middleware/auth'

const router = Router()

router.post('/manager/assignments', authenticate, createAssignments)
router.get('/manager/assignments', authenticate, getManagerAssignments)
router.get('/manager/assignments/:id', authenticate, getAssignmentDetails)

export default router
