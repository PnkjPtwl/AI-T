import { Request, Response } from 'express'

const SCORECARD_CATEGORIES: Record<string, { description: string; high: string; low: string }> = {
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

