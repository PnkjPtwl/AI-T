/**
 * backend/utils/mechanicsCalculator.ts
 *
 * Calculates the hard mechanics of a sales pitch based on Modulate AI's timestamps
 * and transcripts. Also evaluates if a Live Coaching trigger is met.
 */

export interface LiveMetrics {
  wpm: number
  fillerRatio: number // percentage 0-100
  talkListenRatio: number // User percentage 0-100
  interruptionCount: number
  questionCount: number
  emotion: string
  confidenceScore: number // Modulate's confidence score
}

export interface CoachTrigger {
  shouldPopup: boolean
  tip: string
  severity: 'warning' | 'danger' | 'info'
}

/**
 * Math for Filler Words
 */
export function calculateFillerRatio(transcript: string, totalWords: number): number {
  if (totalWords === 0) return 0
  const fillerRegex = /\b(um|uh|like|you know|so|basically)\b/gi
  const matches = transcript.match(fillerRegex) || []
  return (matches.length / totalWords) * 100
}

/**
 * Math for Words Per Minute (WPM)
 */
export function calculateWPM(wordCount: number, durationMs: number): number {
  if (durationMs === 0) return 0
  const durationMins = durationMs / 60000
  return Math.round(wordCount / durationMins)
}

/**
 * Math for Talk/Listen Ratio (User %)
 */
export function calculateTalkListenRatio(userTalkTimeMs: number, aiTalkTimeMs: number): number {
  const total = userTalkTimeMs + aiTalkTimeMs
  if (total === 0) return 0
  return Math.round((userTalkTimeMs / total) * 100)
}

/**
 * Math for Question Frequency
 */
export function calculateQuestionCount(transcript: string): number {
  const questionRegex = /\?/g
  const matches = transcript.match(questionRegex) || []
  return matches.length
}

/**
 * Evaluates triggers to see if Groq needs to generate a specific pop-up.
 */
export function evaluateTriggers(metrics: LiveMetrics, durationSinceLastQuestionMs: number, pauseQualityMs: number): CoachTrigger | null {
  
  // 1. Emotion (The Vibe)
  const anxiousEmotions = ['Anxious', 'Stressed', 'Tired', 'Bored']
  if (anxiousEmotions.includes(metrics.emotion)) {
    return { shouldPopup: true, tip: `Try to sound more confident and energetic. You sound a bit ${metrics.emotion.toLowerCase()}.`, severity: 'warning' }
  }

  if (metrics.emotion === 'Angry' || metrics.emotion === 'Frustrated' || metrics.emotion === 'Contemptuous') {
    return { shouldPopup: true, tip: 'High friction detected. Take a deep breath and de-escalate.', severity: 'danger' }
  }

  // 2. Mechanics (The Skill)
  if (metrics.wpm > 160) {
    return { shouldPopup: true, tip: 'You are speaking too fast (>160 WPM). Slow down your pace.', severity: 'warning' }
  }
  if (metrics.wpm < 110 && metrics.wpm > 0) {
    return { shouldPopup: true, tip: 'You are speaking too slowly (<110 WPM). Pick up the pace.', severity: 'warning' }
  }

  if (metrics.fillerRatio > 8) {
    return { shouldPopup: true, tip: 'Too many filler words (um, uh, like). Try to embrace the silence.', severity: 'warning' }
  }

  if (metrics.confidenceScore < 0.75 && metrics.confidenceScore > 0) {
    return { shouldPopup: true, tip: 'Articulation clarity is low. Speak more clearly.', severity: 'warning' }
  }

  if (pauseQualityMs > 3000) {
    return { shouldPopup: true, tip: 'Long pause detected (>3s). Are you stuck? Check the persona brief.', severity: 'info' }
  }

  // 3. Flow (The Dynamics)
  if (metrics.talkListenRatio > 70) {
    return { shouldPopup: true, tip: 'You are monologuing! You have been talking for >70% of the time. Ask a question.', severity: 'warning' }
  }

  if (metrics.interruptionCount > 2) {
    return { shouldPopup: true, tip: 'You are interrupting the prospect too much. Practice active listening.', severity: 'danger' }
  }

  if (durationSinceLastQuestionMs > 180000 && metrics.questionCount === 0) {
    // 3 minutes
    return { shouldPopup: true, tip: 'You haven\'t asked a question in a while. Remember to discover their needs.', severity: 'warning' }
  }

  return null
}
