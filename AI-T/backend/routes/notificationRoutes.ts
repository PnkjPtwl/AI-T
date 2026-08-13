import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController'

const router = Router()

// All routes require authentication
router.use(authenticate)

// GET /api/manager/notifications — fetch all notifications + trigger deadline scan
router.get('/', getNotifications)

// PATCH /api/manager/notifications/read-all — must come before /:id route
router.patch('/read-all', markAllNotificationsRead)

// PATCH /api/manager/notifications/:id/read — mark single notification read
router.patch('/:id/read', markNotificationRead)

export default router
