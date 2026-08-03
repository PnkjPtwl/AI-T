import multer from 'multer'
import path from 'path'
import fs from 'fs'

const uploadDir = path.join(__dirname, '../public/uploads/avatars')

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname) || '.png'
    cb(null, 'avatar-' + uniqueSuffix + ext)
  }
})

export const uploadAvatarMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).single('avatar')

export const handleAvatarUpload = async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' })
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`
  console.log(`[AvatarUpload] Saved local avatar image to ${avatarUrl}`)

  res.json({
    success: true,
    avatarUrl,
    filename: req.file.filename
  })
}
