import express from 'express'
import { authenticate } from '../middleware/auth'
import { managerOnly } from '../middleware/roleGuard'
import { getMe, getReps, getOrganizationDetails, getRepSessions, getDashboardStats, getCoachingAlerts, getTeamAnalytics, getMyAnalytics, assignTraining, getMyAssignments, getTeamAssignments, updateAssignment, deleteAssignment, addNote, getRepNotes, getMyNotes, getSentNotes, completeAssignment } from '../controllers/userController'

const router = express.Router()

// GET /api/users/me
router.get('/me', authenticate, getMe)

// GET /api/users/my-analytics
router.get('/my-analytics', authenticate, getMyAnalytics)

// GET /api/users/my-assignments
router.get('/my-assignments', authenticate, getMyAssignments)

// GET /api/users/my-notes
router.get('/my-notes', authenticate, getMyNotes)

// GET /api/users/reps
router.get('/reps', authenticate, managerOnly, getReps)

// GET /api/users/organization (and alias org-details)
router.get('/organization', authenticate, managerOnly, getOrganizationDetails)
router.get('/org-details', authenticate, managerOnly, getOrganizationDetails)

// GET /api/users/dashboard-stats
router.get('/dashboard-stats', authenticate, managerOnly, getDashboardStats)

// GET /api/users/coaching-alerts
router.get('/coaching-alerts', authenticate, managerOnly, getCoachingAlerts)

// GET /api/users/team-analytics
router.get('/team-analytics', authenticate, managerOnly, getTeamAnalytics)

// GET /api/users/team-assignments
router.get('/team-assignments', authenticate, managerOnly, getTeamAssignments)

// POST /api/users/assign-training
router.post('/assign-training', authenticate, managerOnly, assignTraining)

// PATCH /api/users/assignments/:assignmentId
router.patch('/assignments/:assignmentId', authenticate, managerOnly, updateAssignment)

// DELETE /api/users/assignments/:assignmentId
router.delete('/assignments/:assignmentId', authenticate, managerOnly, deleteAssignment)

// POST /api/users/complete-assignment
router.post('/complete-assignment', authenticate, completeAssignment)

// GET /api/users/reps/:repId/sessions
router.get('/reps/:repId/sessions', authenticate, managerOnly, getRepSessions)

// GET /api/users/reps/:repId/notes
router.get('/reps/:repId/notes', authenticate, managerOnly, getRepNotes)

// POST /api/users/reps/:repId/notes
router.post('/reps/:repId/notes', authenticate, managerOnly, addNote)

// GET /api/users/sent-notes
router.get('/sent-notes', authenticate, managerOnly, getSentNotes)

export default router
