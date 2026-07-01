import { supabase } from '../db/supabase'
import { getSecret } from '../lib/secrets'

export const getMySignals = async (req: any, res: any) => {
  const repId = req.user.id

  const { data, error } = await supabase
    .from('coaching_signals')
    .select('signal_type, value, created_at, calls!inner(rep_id)')
    .eq('calls.rep_id', repId)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const latest: Record<string, number> = {
    talk_ratio: 0,
    question_rate: 0,
    interactivity: 0,
    monologue_flag: 0
  }

  const seen = new Set()
  for (const row of (data || [])) {
    if (!seen.has(row.signal_type)) {
      latest[row.signal_type] = row.value
      seen.add(row.signal_type)
    }
  }

  res.json(latest)
}

export const generateStudyGuide = async (req: any, res: any) => {
  const { repName, weakestSkill, strongestSkill } = req.body
  const apiKey = await getSecret('GROQ_API_KEY')

  if (!apiKey) {
    return res.status(500).json({ error: 'AI Service not configured' })
  }

  try {
    const prompt = `Act as a World-Class Sales Coach. 
Representative Name: ${repName}
Primary Weakness: ${weakestSkill}
Primary Strength: ${strongestSkill}

Create a highly strategic, 5-step Study Guide to help this representative improve their ${weakestSkill}. 
Leverage their strength in ${strongestSkill} where possible. 
Include:
1. Theoretical Foundation (Why it matters)
2. Tactical Framework (The "How-To")
3. Roleplay Exercise (Specific scenario to practice)
4. Key Phrases/Scripts to use
5. Success Metric for the next training session.

Format the response in professional Markdown.`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    })

    const data = await response.json()
    const guide = data.choices?.[0]?.message?.content || 'Failed to generate guide.'

    res.json({ guide })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
