import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authenticate } from '../middleware/auth'
import { managerOnly } from '../middleware/roleGuard'
import {
  listKnowledgeBases,
  getKnowledgeBaseDetails,
  createKnowledgeBase,
  uploadDocuments,
  deleteKnowledgeBase
} from '../controllers/knowledgeBaseController'

const router = express.Router()

// Ensure temp upload directory exists at startup
const kbTempDir = path.join(__dirname, '../public/uploads/kb_temp')
if (!fs.existsSync(kbTempDir)) {
  fs.mkdirSync(kbTempDir, { recursive: true })
}

// Multer — temp disk storage for uploaded KB documents
const kbStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, kbTempDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname).toLowerCase()
    // Preserve original name prefix so the RAG service sees a readable filename
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    cb(null, `${base}-${unique}${ext}`)
  }
})

const upload = multer({
  storage: kbStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = ['.md', '.docx', '.txt']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: .md, .docx, .txt`))
    }
  }
})

// GET /api/knowledge-base — list all KBs for the org
router.get('/', authenticate, managerOnly, listKnowledgeBases)

// GET /api/knowledge-base/:slug — get details for a specific KB
router.get('/:slug', authenticate, managerOnly, getKnowledgeBaseDetails)

// POST /api/knowledge-base — create a new KB with initial document upload
router.post('/', authenticate, managerOnly, upload.array('files', 20), createKnowledgeBase)

// POST /api/knowledge-base/:slug/upload — append more documents to an existing KB
router.post('/:slug/upload', authenticate, managerOnly, upload.array('files', 20), uploadDocuments)

// DELETE /api/knowledge-base/:slug — delete KB and all its embeddings
router.delete('/:slug', authenticate, managerOnly, deleteKnowledgeBase)

export default router
