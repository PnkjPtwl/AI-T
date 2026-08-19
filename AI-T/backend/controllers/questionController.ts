import { Request, Response } from 'express'
import { supabase } from '../db/supabase'
import OpenAI from 'openai'
import { getSecret } from '../lib/secrets'
import { searchKnowledgeBase, formatRagContext } from '../utils/ragClient'

// POST /api/questions/generate
export const generateQuestions = async (req: Request, res: Response) => {
  try {
    const { categories, context_text, persona_name, persona_type, account_name, scorecard_metrics } = req.body
    
    const validCategories = Array.isArray(categories) && categories.length > 0
      ? categories
      : ['Discovery', 'Objection Handling', 'Value Proposition', 'Closing Skills']

    const cerebrasApiKey = await getSecret('CEREBRAS_API_KEY')
    const groqApiKey = await getSecret('GROQ_API_KEY')
    const isCerebras = Boolean(cerebrasApiKey)
    const openai = new OpenAI({
      apiKey: cerebrasApiKey || groqApiKey || '',
      baseURL: isCerebras ? 'https://api.cerebras.ai/v1' : 'https://api.groq.com/openai/v1'
    })
    const modelName = isCerebras ? 'gpt-oss-120b' : 'openai/gpt-oss-20b'

    // Fetch Knowledge Base chunks from RAG ONLY if a specific account_name is provided
    let kbContextStr = ''
    if (account_name) {
      try {
        const searchTarget = `${account_name} ${persona_name || ''} ${context_text || ''} ${validCategories.join(' ')} questions discovery objections`.trim()
        const kbChunks = await searchKnowledgeBase(searchTarget, account_name, 5)
        if (kbChunks && kbChunks.length > 0) {
          kbContextStr = formatRagContext(kbChunks, account_name)
          console.log(`[QuestionsRAG] Retrived ${kbChunks.length} KB chunks for question generation for ${account_name}.`)
        }
      } catch (ragErr) {
        console.warn('[QuestionsRAG] KB retrieval skipped/failed:', ragErr)
      }
    }

    let metricsContextStr = ''
    if (Array.isArray(scorecard_metrics) && scorecard_metrics.length > 0) {
      metricsContextStr = scorecard_metrics.map((m: any) => `- ${m.name}: ${m.description || ''}`).join('\n')
    }

    const prompt = `
You are an expert sales trainer. The user wants to generate test questions for a sales training scenario.
Persona Name: ${persona_name || 'N/A'}
Persona Type: ${persona_type || 'N/A'}
Context: ${context_text || 'No additional context provided.'}
${metricsContextStr ? `\nSCORECARD EVALUATION METRICS:\n${metricsContextStr}\n` : ''}
${kbContextStr ? `\nKNOWLEDGE BASE CONTEXT:\n${kbContextStr}\n` : ''}

Please generate exactly 2 distinct questions for EACH of the following categories: ${validCategories.join(', ')}.
INSTRUCTIONS:
- Base the questions directly on the Persona Context and Scorecard Metrics provided above${kbContextStr ? ' and the facts, pain points, or requirements in the Knowledge Base context' : ''}.
- These questions are what the Sales Rep should aim to ask the Persona or answer during the roleplay to succeed.
- Phrase them as "Questions the Rep should aim to ask/answer".

Return ONLY raw JSON with this format:
{
  "questions": [
    {
      "category": "category name",
      "text": "The question text..."
    }
  ]
}
`

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are an expert AI API. Output ONLY raw JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.5,
      response_format: { type: 'json_object' }
    })

    const text = completion.choices[0].message.content || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : '{}';
    const data = JSON.parse(jsonText)
    const aiQuestions = data.questions || []

    // Fetch top questions from the bank for these categories
    let formattedBankQuestions: any[] = []
    try {
      const { data: bankQuestions } = await supabase
        .from('question_bank')
        .select('id, category, question_text, average_rating')
        .in('category', validCategories)
        .order('average_rating', { ascending: false })
        .order('total_ratings', { ascending: false })
        .limit(20);
        
      if (bankQuestions) {
        formattedBankQuestions = bankQuestions.map(q => ({
          id: q.id,
          category: q.category,
          text: q.question_text,
          isBank: true,
          rating: q.average_rating
        }))
      }
    } catch (bankErr) {
      console.warn('[QuestionsBank] question_bank query fallback:', bankErr)
    }

    // Combine them
    const allQuestions = [...aiQuestions.map((q: any) => ({...q, isBank: false})), ...formattedBankQuestions]

    res.json(allQuestions)
  } catch (err: any) {
    console.error('generateQuestions error:', err)
    res.status(500).json({ error: err.message })
  }
}

// GET /api/questions?category=XYZ
export const getQuestions = async (req: Request, res: Response) => {
  try {
    const { category, limit = 10 } = req.query
    
    let query = supabase
      .from('question_bank')
      .select('*')
      .order('average_rating', { ascending: false })
      .order('total_ratings', { ascending: false })
      .limit(Number(limit))
      
    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query
    if (error) throw error

    res.json(data)
  } catch (err: any) {
    console.error('getQuestions error:', err)
    res.status(500).json({ error: err.message })
  }
}

// POST /api/questions/rate
export const rateQuestion = async (req: Request, res: Response) => {
  try {
    const { id, rating } = req.body
    if (!id || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid id and rating (1-5) are required' })
    }

    // Fetch current stats
    const { data: q, error: fetchErr } = await supabase
      .from('question_bank')
      .select('average_rating, total_ratings')
      .eq('id', id)
      .single()

    if (fetchErr || !q) {
      return res.status(404).json({ error: 'Question not found' })
    }

    // Calculate new average
    const currentTotalRatings = q.total_ratings || 0
    const currentAverage = q.average_rating || 0
    
    const newTotalRatings = currentTotalRatings + 1
    const newAverage = ((currentAverage * currentTotalRatings) + rating) / newTotalRatings

    const { data, error } = await supabase
      .from('question_bank')
      .update({
        average_rating: newAverage,
        total_ratings: newTotalRatings
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    console.error('rateQuestion error:', err)
    res.status(500).json({ error: err.message })
  }
}

// POST /api/questions
export const addQuestion = async (req: Request, res: Response) => {
  try {
    const { category, question_text, scenario_id } = req.body
    if (!category || !question_text) {
      return res.status(400).json({ error: 'category and question_text are required' })
    }

    const { data, error } = await supabase
      .from('question_bank')
      .insert({
        category,
        question_text,
        scenario_id: scenario_id || null,
        average_rating: 0,
        total_ratings: 0
      })
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    console.error('addQuestion error:', err)
    res.status(500).json({ error: err.message })
  }
}
