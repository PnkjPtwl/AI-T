import { supabase } from '../db/supabase'
import { parse } from 'csv-parse/sync'
import { computeMetricsForCall } from '../services/metricsEngine'

// ─── POST /api/calls/upload ────────────────────────────────
// Accepts multipart/form-data with field name "file" (CSV)
// CSV columns: rep_email, duration_sec, recorded_at, transcript
export const uploadCalls = async (req, res) => {
  // multer attaches the file to req.file
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send a CSV as form-data field "file".' })
  }

  const managerOrgId = req.user.org_id

  // ── 1. Parse CSV from buffer ───────────────────────────
  let rows: any[]
  try {
    rows = parse(req.file.buffer, {
      columns:          true,   // first row = headers
      skip_empty_lines: true,
      trim:             true,
    })
  } catch (parseErr: any) {
    return res.status(400).json({ error: `CSV parse error: ${parseErr.message}` })
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: 'CSV file is empty or has no data rows.' })
  }

  const REQUIRED_COLS = ['rep_email', 'duration_sec', 'recorded_at', 'transcript']
  const headers = Object.keys(rows[0])
  const missing = REQUIRED_COLS.filter(c => !headers.includes(c))
  if (missing.length) {
    return res.status(400).json({
      error: `CSV is missing required columns: ${missing.join(', ')}`,
      expected: REQUIRED_COLS,
      got: headers,
    })
  }

  // ── 2. Pre-fetch all reps in this org (avoids N+1 queries) ─
  const { data: orgReps, error: repFetchErr } = await supabase
    .from('users')
    .select('id, email')
    .eq('org_id', managerOrgId)
    .eq('role', 'rep')

  if (repFetchErr) {
    return res.status(500).json({ error: `Failed to fetch org reps: ${repFetchErr.message}` })
  }

  // email → id map (lowercase for safe comparison)
  const repMap: Record<string, string> = {}
  for (const rep of orgReps ?? []) {
    repMap[rep.email.toLowerCase()] = rep.id
  }

  // ── 3. Validate & build insert rows ───────────────────────
  const toInsert: any[]  = []
  const failed:   any[]  = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2  // +2 because row 1 = header
    const errors: string[] = []

    // rep_email → rep_id
    const email = (row.rep_email ?? '').toLowerCase().trim()
    const repId = repMap[email]
    if (!email)  errors.push('rep_email is empty')
    else if (!repId) errors.push(`rep_email "${email}" not found in your org`)

    // duration_sec — must be a positive number
    const duration = Number(row.duration_sec)
    if (!row.duration_sec || isNaN(duration) || duration <= 0) {
      errors.push(`duration_sec "${row.duration_sec}" is not a valid positive number`)
    }

    // recorded_at — must be parseable as a date
    const recordedAt = new Date(row.recorded_at)
    if (!row.recorded_at || isNaN(recordedAt.getTime())) {
      errors.push(`recorded_at "${row.recorded_at}" is not a valid date`)
    }

    // transcript — must not be blank
    if (!row.transcript || row.transcript.trim() === '') {
      errors.push('transcript is empty')
    }

    if (errors.length > 0) {
      failed.push({ row: rowNum, data: row, reasons: errors })
      console.warn(`⚠️  Row ${rowNum} skipped:`, errors)
      return
    }

    toInsert.push({
      rep_id:          repId,
      org_id:          managerOrgId,
      duration_sec:    Math.round(duration),
      recorded_at:     recordedAt.toISOString(),
      transcript_text: row.transcript.trim(),
      raw_metrics_json: null,   // filled later by AI processing
    })
  })

  // ── 4. Bulk insert valid rows ──────────────────────────────
  let succeeded = 0
  let computedMetrics = 0

  if (toInsert.length > 0) {
    const { data: insertedCalls, error: insertErr } = await supabase
      .from('calls')
      .insert(toInsert)
      .select('id') // ← Return the inserted rows so we get the IDs

    if (insertErr) {
      return res.status(500).json({
        error:    `Database insert failed: ${insertErr.message}`,
        attempted: toInsert.length,
        failed:   failed.length,
        skipped:  failed,
      })
    }
    
    succeeded = toInsert.length

    // ── 4b. Auto-compute metrics for inserted calls ────────────
    if (insertedCalls && insertedCalls.length > 0) {
      console.log(`⏳ Computing metrics for ${insertedCalls.length} new calls...`)
      
      const results = await Promise.allSettled(
        insertedCalls.map(c => computeMetricsForCall(c.id))
      )
      
      computedMetrics = results.filter(r => r.status === 'fulfilled').length
      const computeErrors = results.filter(r => r.status === 'rejected')
      
      if (computeErrors.length > 0) {
        console.error(`⚠️  Failed to compute metrics for ${computeErrors.length} calls`)
      }
    }
  }

  // ── 5. Return summary ──────────────────────────────────────
  return res.status(200).json({
    message:   `Upload complete`,
    total:     rows.length,
    succeeded,
    computedMetrics,
    failed:    failed.length,
    skipped:   failed,   // details of each skipped row + reason
  })
}
