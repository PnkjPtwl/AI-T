import 'dotenv/config'
import express from 'express'
import cors from 'cors'
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
import tavusRoutes from './routes/tavusRoutes'
import anamRoutes from './routes/anamRoutes'
import questionRoutes from './routes/questionRoutes'

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

app.use('/api/auth',     authRoutes)
app.use('/api/calls',    callRoutes)
app.use('/api/users',    userRoutes)
app.use('/api/coaching', coachingRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/scenarios', scenarioRoutes)
app.use('/api/persona',   personaRoutes)
app.use('/api/tts',       ttsRoutes)
app.use('/api/tavus',     tavusRoutes)
app.use('/api/anam',      anamRoutes)
app.use('/api/questions', questionRoutes)

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
