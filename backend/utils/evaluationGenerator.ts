export const SCORECARD_CATEGORIES: Record<string, { description: string; high: string; low: string }> = {
  'Communication & Professionalism': {
    description: 'How clearly, professionally and confidently the rep communicates throughout the call.',
    high: 'Clear articulation, professional tone, confident delivery, no filler words.',
    low: 'Rambling, unprofessional language, lacks confidence or clarity.',
  },
  'Customer Understanding': {
    description: 'How well the rep discovers and understands the prospect\'s situation, needs, and context.',
    high: 'Asks deep discovery questions, listens actively, reflects back accurately.',
    low: 'Generic questions, misses key context, talks more than listens.',
  },
  'Active Listening & Engagement': {
    description: 'Whether the rep actively acknowledges what the prospect says and keeps them engaged.',
    high: 'Responds to specifics, builds on prospect answers, uses their language.',
    low: 'Ignores prospect input, jumps ahead, follows a rigid script.',
  },
  'Value Communication': {
    description: 'How well the rep articulates the value of their solution in terms of the prospect\'s pain points.',
    high: 'Ties features to specific business outcomes, uses prospect\'s language.',
    low: 'Feature-dumps, fails to connect to prospect pain, abstract value claims.',
  },
  'Objection & Concern Handling': {
    description: 'The rep\'s ability to handle objections with empathy and a clear response.',
    high: 'Acknowledges concern, reframes clearly, provides evidence or examples.',
    low: 'Gets defensive, ignores objection, or gives a generic dismissive response.',
  },
  'Next Steps & Call Effectiveness': {
    description: 'Whether the rep drives toward a clear, agreed-upon next step before ending the call.',
    high: 'Proposes a specific next step, confirms agreement, sets a clear date.',
    low: 'Call ends ambiguously, no follow-up planned, no urgency created.',
  },
}

/** Returns the canonical list of scorecard metric names */
export function getScorecardMetricNames(): string[] {
  return Object.keys(SCORECARD_CATEGORIES)
}

/** Converts a metric name to its snake_case score key (used in feedback_json.scores) */
export function metricToScoreKey(metric: string): string {
  return metric.toLowerCase().replace(/[^a-z]/g, '_').replace(/__+/g, '_')
}

/** Returns the canonical score keys that the AI evaluator will produce */
export function getScorecardScoreKeys(): string[] {
  return getScorecardMetricNames().map(metricToScoreKey)
}

export function generateEvaluationPrompt(scenarioName: string, transcript: string, evaluationFocus?: string, voiceAggregate?: any): string {
  // Determine which metrics to use
  let metricsToUse: string[]

  if (evaluationFocus && evaluationFocus.trim().length > 0) {
    // Use manager-specified metrics
    const specified = evaluationFocus.split(',').map(s => s.trim()).filter(Boolean)
    // Map them to our known scorecard keys
    metricsToUse = specified.filter(m => SCORECARD_CATEGORIES[m])
    // Fallback to all if none match
    if (metricsToUse.length === 0) metricsToUse = Object.keys(SCORECARD_CATEGORIES)
  } else {
    // Default: all metrics
    metricsToUse = Object.keys(SCORECARD_CATEGORIES)
  }

  const criteriaText = metricsToUse.map(key => {
    const cat = SCORECARD_CATEGORIES[key]
    if (!cat) return ''
    return `- ${key}:\n  Description: ${cat.description}\n  High Score Indicator: ${cat.high}\n  Low Score Indicator: ${cat.low}`
  }).filter(Boolean).join('\n')

  const scoreKeys = metricsToUse.map(m => `"${m.toLowerCase().replace(/[^a-z]/g, '_').replace(/__+/g, '_')}": {
      "score": <number 0-100>,
      "actual_answer": "<Quote or summarize what the rep actually said/did regarding this criteria. If they didn't demonstrate it, state that.>",
      "better_answer": "<What the rep should have said/did to score 100>"
    }`).join(',\n    ')

  // Voice delivery section — only included when prosody data is available
  let voiceSection = ''
  let voiceOutputKey = ''
  if (voiceAggregate) {
    voiceSection = `
--- VOICE DELIVERY DATA (from audio analysis) ---
The rep's voice was analyzed across ${voiceAggregate.turnCount} voice turns:
- Average Pitch: ${voiceAggregate.avgPitchMean} Hz (std deviation: ${voiceAggregate.avgPitchStd} Hz)
- Average Energy Level: ${voiceAggregate.avgEnergyMean}
- Pause/Hesitation Ratio: ${Math.round(voiceAggregate.avgPauseRatio * 100)}% of speaking time was silence/hesitation
- Total Speaking Duration: ${voiceAggregate.totalDurationSec} seconds

Use this data to comment on the rep's vocal delivery — confidence (steady pitch, good energy), hesitation (high pause ratio suggests uncertainty), and engagement (pitch variation shows expressiveness vs monotone).
`
    voiceOutputKey = `\n  "voice_delivery_feedback": "<1-2 sentence natural language observation about the rep's vocal delivery based on the voice data above>",`
  }

  return `You are an expert Sales Coach Analyst. You are evaluating a sales practice conversation between an AI Persona (acting as the buyer) and a human Sales Rep.

--- EVALUATION CRITERIA ---
Evaluate the rep strictly on the following metrics that the manager has selected:
${criteriaText}

--- SCENARIO ---
Scenario Name: ${scenarioName}

--- TRANSCRIPT ---
${transcript}
${voiceSection}
--- STRICT SCORING RULES ---
1. EVIDENCE-BASED: You MUST ONLY award points for skills explicitly demonstrated in the transcript. 
2. SHORT CONVERSATIONS: If the transcript is extremely short (e.g. the rep only spoke 1 or 2 lines), they have NOT demonstrated most skills. Any skill NOT explicitly demonstrated MUST receive a score of 0. Do not give "neutral" scores (like 50) for unobserved skills.
3. NO HALLUCINATIONS: Do not invent objections, highlights, or feedback for things that did not actually happen in the transcript.

--- INSTRUCTIONS ---
Analyse the transcript deeply based on the rules above. Return ONLY a raw JSON object with no markdown, no backticks, no extra text.
{
  "scores": {
    ${scoreKeys}
  },
  "overall_score": <average of all the scores in the criteria above, number 0-100>,
  "summary": "<concise narrative summary of the interaction>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],${voiceOutputKey}
  "objections_analysis": [
    {
      "objection": "<the specific objection raised>",
      "rep_response": "<how the rep responded>",
      "is_effective": <boolean>,
      "feedback": "<why it was or wasn't effective>"
    }
  ],
  "highlights": [
    {
      "type": "strong" | "weak",
      "rep_quote": "<exact quote from the rep>",
      "context": "<why this was a strong or weak moment>",
      "suggestion": "<for weak moments only>"
    }
  ],
  "outcome_analysis": "<explanation of why the conversation succeeded or failed>",
  "next_practice_recommendation": "<suggested specific scenario or skill to practice next>"
}
`
}

/**
 * Generates a focused prompt for Conversation Analytics (rep tone + customer sentiment arc).
 * This is COMPLETELY SEPARATE from the scorecard evaluation and never affects scores.
 *
 * @param transcript - Full conversation transcript (Human Sales Rep / AI Prospect labels)
 * @param voiceAggregate - Optional aggregated prosody data from the rep's voice turns
 */
export function generateConversationAnalyticsPrompt(transcript: string, voiceAggregate?: any): string {
  // Build each exchange as a numbered step
  const lines = transcript.split('\n').filter((l: string) => l.trim())
  const steps: { step: number; rep: string; customer: string }[] = []
  let step = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Human Sales Rep:')) {
      const rep = lines[i].replace('Human Sales Rep:', '').trim()
      const customer = (lines[i + 1] || '').replace('AI Prospect (Buyer):', '').trim()
      step++
      steps.push({ step, rep, customer })
      i++ // skip next line (already consumed as customer)
    }
  }

  const stepsJson = JSON.stringify(steps.map(s => ({
    step: s.step,
    rep_message: s.rep.substring(0, 300),
    customer_message: s.customer.substring(0, 300)
  })), null, 2)

  // Build voice context section if available
  let voiceContext = ''
  if (voiceAggregate && voiceAggregate.totalDurationSec > 0) {
    const repWordCount = lines
      .filter((l: string) => l.startsWith('Human Sales Rep:'))
      .map((l: string) => l.replace('Human Sales Rep:', '').trim().split(/\s+/).length)
      .reduce((a: number, b: number) => a + b, 0)

    const wpm = Math.round((repWordCount / voiceAggregate.totalDurationSec) * 60)

    voiceContext = `
--- REP COMMUNICATION DATA (from speech timing) ---
- Total Speaking Duration: ${voiceAggregate.totalDurationSec.toFixed(1)}s
- Computed WPM: ${wpm}

Use this to populate avg_wpm accurately.
`
  }

  return `You are an expert conversational AI analyst. Analyse the following sales conversation and produce a structured JSON report.

IMPORTANT: Do NOT score the rep on sales skills — that is handled by a separate evaluator.
Focus ONLY on:
1. Rep's TONE and COMMUNICATION STYLE throughout the conversation
2. Customer's SENTIMENT at each conversation step
${voiceContext}
--- CONVERSATION STEPS ---
${stepsJson}

--- INSTRUCTIONS ---
Return ONLY a raw JSON object (no markdown, no backticks):

{
  "rep_tone_profile": {
    "professional": <0-100>,
    "friendly": <0-100>,
    "confident": <0-100>,
    "empathetic": <0-100>,
    "calm": <0-100>,
    "aggressive": <0-100, pushy/pressure tactics — ideally very low>,
    "passive": <0-100, too non-committal — ideally low>
  },
  "rep_voice_stats": {
    "avg_wpm": <number or null if no voice data>,
    "communication_style": "Consultative" | "Direct" | "Passive" | "Assertive" | "Enthusiastic" | "Analytical",
    "energy_label": "High" | "Medium" | "Low",
    "warmth_score": <0-100>
  },
  "customer_sentiment_arc": [
    {
      "step": <step number>,
      "sentiment_score": <0-100 where 0=very negative, 50=neutral, 100=very positive>,
      "label": "Very Positive" | "Positive" | "Neutral" | "Negative" | "Very Negative",
      "reason": "<1 short sentence explaining why>"
    }
  ],
  "ai_conversation_summary": "<2-3 sentences of narrative insight about the overall conversational dynamic>"
}

RULES:
- customer_sentiment_arc MUST have exactly one entry per step (${steps.length} steps total).
- Sentiment MUST change naturally across steps — avoid identical scores.
- INFER energy_label and warmth_score carefully from semantic enthusiasm, conversational momentum, word choice, and empathy shown in the text.
- Be specific in the reason field — reference what was actually said.
- If 0 steps, return empty arc and zeros everywhere.
`
}
