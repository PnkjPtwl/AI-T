import express from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth'
import { managerOnly } from '../middleware/roleGuard'
import { uploadCalls } from '../controllers/callController'

const router = express.Router()

// Store file in memory (no disk writes) — buffer available at req.file.buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },  // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Only CSV files are allowed'))
    }
  }
})

// POST /api/calls/upload
// Guards: must be authenticated + must be a manager
router.post(
  '/upload',
  authenticate,          // 1. verify JWT → attach req.user
  managerOnly,           // 2. check role === 'manager'
  upload.single('file'), // 3. parse multipart/form-data, field name = "file"
  uploadCalls            // 4. process CSV and insert rows
)

export default router
