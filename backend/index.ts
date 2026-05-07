import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/authRoutes'
import callRoutes from './routes/callRoutes'
import userRoutes from './routes/userRoutes'
import coachingRoutes from './routes/coachingRoutes'
import sessionRoutes from './routes/sessionRoutes'
import scenarioRoutes from './routes/scenarioRoutes'
import personaRoutes from './routes/personaRoutes'

const app = express()
const PORT = process.env.PORT || 4000

// ─── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: 'http://localhost:3000',  // Next.js frontend
  credentials: true
}))
app.use(express.json())

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth',     authRoutes)
app.use('/api/calls',    callRoutes)
app.use('/api/users',    userRoutes)
app.use('/api/coaching', coachingRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/scenarios', scenarioRoutes)
app.use('/api/persona',   personaRoutes)

// ─── Health check ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Auth server running' })
})

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Backend running at http://localhost:${PORT}`)
  console.log(`   POST /api/auth/signup/manager`)
  console.log(`   POST /api/auth/signup/rep`)
  console.log(`   POST /api/auth/login`)
  console.log(`   POST /api/calls/upload  (manager only, multipart CSV)`)
})
