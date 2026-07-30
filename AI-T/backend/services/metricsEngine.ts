import { supabase } from '../db/supabase'

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

export interface CallMetrics {
  talk_ratio:         number   // 0–100 (%)
  question_rate:      number   // 0–100 (%)
  interactivity:      number   // 0–100 (%)
  monologue_flag:     number   // 1 = true, 0 = false  (stored as numeric for consistency)
}

interface ParsedTranscript {
  repTurns:      string[]   // each full rep turn (may have multiple sentences)
  customerTurns: string[]
}

// ─────────────────────────────────────────────────────────────
//  STEP 1 — PARSE TRANSCRIPT
//  Input format: "Rep: ... Customer: ... Rep: ..."
// ─────────────────────────────────────────────────────────────

export function parseTranscript(transcriptText: string): ParsedTranscript {
  const repTurns:      string[] = []
  const customerTurns: string[] = []

  if (!transcriptText || !transcriptText.trim()) {
    return { repTurns, customerTurns }
  }

  // Split on "Rep:" or "Customer:" boundaries, keeping the label
  // Handles both "Rep:" and "Customer:" regardless of extra whitespace
  const parts = transcriptText
    .split(/(?=\bRep\s*:|Customer\s*:)/i)
    .map(s => s.trim())
    .filter(Boolean)

  for (const part of parts) {
    // Extract the speaker label and the text after it
    const repMatch      = part.match(/^Rep\s*:\s*([\s\S]+)/i)
    const customerMatch = part.match(/^Customer\s*:\s*([\s\S]+)/i)

    if (repMatch)      repTurns.push(repMatch[1].trim())
    else if (customerMatch) customerTurns.push(customerMatch[1].trim())
  }

  return { repTurns, customerTurns }
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

/** Count words in a text string */
function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0)
    .length
}

/** Split a turn into individual sentences (split on . ! ?) */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─────────────────────────────────────────────────────────────
//  STEP 2 — COMPUTE METRICS
// ─────────────────────────────────────────────────────────────

export function computeMetrics(transcript: ParsedTranscript): CallMetrics {
  const { repTurns, customerTurns } = transcript

  // ── Talk Ratio ──────────────────────────────────────────────
  // (rep word count / total word count) × 100
  const repWords      = repTurns.reduce((sum, t) => sum + wordCount(t), 0)
  const customerWords = customerTurns.reduce((sum, t) => sum + wordCount(t), 0)
  const totalWords    = repWords + customerWords

  const talk_ratio = totalWords > 0
    ? round2((repWords / totalWords) * 100)
    : 0

  // ── Question Rate ───────────────────────────────────────────
  // (rep sentences ending in '?' / total rep sentences) × 100
  let totalRepSentences    = 0
  let questionSentences    = 0

  for (const turn of repTurns) {
    const sentences = splitSentences(turn)
    totalRepSentences += sentences.length
    questionSentences += sentences.filter(s => s.endsWith('?')).length
  }

  const question_rate = totalRepSentences > 0
    ? round2((questionSentences / totalRepSentences) * 100)
    : 0

  // ── Interactivity Score ─────────────────────────────────────
  // (rep turns with fewer than 20 words / total rep turns) × 100
  // High interactivity = short, snappy responses (active listening)
  const shortTurns   = repTurns.filter(t => wordCount(t) < 20).length
  const totalRepTurns = repTurns.length

  const interactivity = totalRepTurns > 0
    ? round2((shortTurns / totalRepTurns) * 100)
    : 0

  // ── Monologue Flag ──────────────────────────────────────────
  // true (1) if ANY single rep turn exceeds 180 words
  const monologue_flag = repTurns.some(t => wordCount(t) > 180) ? 1 : 0

  return { talk_ratio, question_rate, interactivity, monologue_flag }
}

// ─────────────────────────────────────────────────────────────
//  STEP 3 — PERSIST TO SUPABASE
// ─────────────────────────────────────────────────────────────

const SIGNAL_TYPES: Array<keyof CallMetrics> = [
  'talk_ratio',
  'question_rate',
  'interactivity',
  'monologue_flag',
]

async function saveCoachingSignals(callId: string, metrics: CallMetrics): Promise<void> {
  const rows = SIGNAL_TYPES.map(signal_type => ({
    call_id:     callId,
    signal_type,
    value:       metrics[signal_type],
  }))

  const { error } = await supabase
    .from('coaching_signals')
    .insert(rows)

  if (error) {
    throw new Error(`Failed to insert coaching_signals: ${error.message}`)
  }
}

async function updateCallMetricsJson(callId: string, metrics: CallMetrics): Promise<void> {
  const { error } = await supabase
    .from('calls')
    .update({ raw_metrics_json: metrics })
    .eq('id', callId)

  if (error) {
    throw new Error(`Failed to update calls.raw_metrics_json: ${error.message}`)
  }
}

// ─────────────────────────────────────────────────────────────
//  MAIN EXPORT — computeMetricsForCall(callId)
// ─────────────────────────────────────────────────────────────

export async function computeMetricsForCall(callId: string): Promise<CallMetrics> {
  // 1. Fetch the call record
  const { data: call, error: fetchError } = await supabase
    .from('calls')
    .select('id, transcript_text')
    .eq('id', callId)
    .single()

  if (fetchError || !call) {
    throw new Error(`Call not found (id: ${callId}): ${fetchError?.message ?? 'no data'}`)
  }

  if (!call.transcript_text || call.transcript_text.trim() === '') {
    throw new Error(`Call ${callId} has no transcript_text to process`)
  }

  // 2. Parse transcript → compute metrics
  const transcript = parseTranscript(call.transcript_text)
  const metrics    = computeMetrics(transcript)

  console.log(`📊 Metrics for call ${callId}:`, metrics)

  // 3. Save coaching_signals rows (upsert-style: delete old, insert fresh)
  await supabase
    .from('coaching_signals')
    .delete()
    .eq('call_id', callId)  // clear stale signals before re-inserting

  await saveCoachingSignals(callId, metrics)

  // 4. Stamp the call row with the computed JSON
  await updateCallMetricsJson(callId, metrics)

  return metrics
}

// ─────────────────────────────────────────────────────────────
//  BATCH HELPER — process multiple calls at once
// ─────────────────────────────────────────────────────────────

export async function computeMetricsForOrg(orgId: string): Promise<{
  processed: number
  failed:    number
  errors:    { callId: string; reason: string }[]
}> {
  // Fetch all calls in the org that have a transcript but no metrics yet
  const { data: calls, error } = await supabase
    .from('calls')
    .select('id')
    .eq('org_id', orgId)
    .is('raw_metrics_json', null)   // only unprocessed calls

  if (error) throw new Error(`Failed to fetch calls: ${error.message}`)

  let processed = 0
  let failed    = 0
  const errors: { callId: string; reason: string }[] = []

  for (const call of calls ?? []) {
    try {
      await computeMetricsForCall(call.id)
      processed++
    } catch (err: any) {
      failed++
      errors.push({ callId: call.id, reason: err.message })
      console.error(`❌  Failed to process call ${call.id}:`, err.message)
    }
  }

  return { processed, failed, errors }
}
