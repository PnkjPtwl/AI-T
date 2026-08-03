import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { initSecrets } from './lib/secrets'
import { getSupabase, setSyncSupabase } from './db/supabase'
import authRoutes from './routes/authRoutes'
import callRoutes from './routes/callRoutes'
import userRoutes from './routes/userRoutes'
import coachingRoutes from './routes/coachingRoutes'
import sessionRoutes from './routes/sessionRoutes'
import scenarioRoutes from './routes/scenarioRoutes'
import personaRoutes from './routes/personaRoutes'
import ttsRoutes from './routes/ttsRoutes'
import questionRoutes from './routes/questionRoutes'
import dashboardRoutes from './routes/dashboardRoutes'
import assignmentRoutes from './routes/assignmentRoutes'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        `http://${process.env.ALLOWED_ORIGIN || 'localhost'}`,
        `https://${process.env.ALLOWED_ORIGIN || 'localhost'}`
      ]
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}))
app.use(express.json())

// Serve local avatar & asset uploads statically
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')))

app.use('/api/auth',     authRoutes)
app.use('/api/calls',    callRoutes)
app.use('/api/users',    userRoutes)
app.use('/api/coaching', coachingRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/scenarios', scenarioRoutes)
app.use('/api/persona',   personaRoutes)
app.use('/api/tts',       ttsRoutes)
app.use('/api/questions', questionRoutes)
app.use('/api',           dashboardRoutes)
app.use('/api',           assignmentRoutes)


app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend running', timestamp: new Date().toISOString() })
})

async function main() {
  await initSecrets()
  const sb = await getSupabase()
  setSyncSupabase(sb)

  app.listen(PORT, () => {
    console.log(`✅  Backend running at http://localhost:${PORT}`)
  })
}

main().catch(err => {
  console.error('❌ Failed to start server:', err)
  process.exit(1)
})
