import { Request, Response } from 'express'
import { supabase } from '../db/supabase'
import Groq from 'groq-sdk'
import { getSecret } from '../lib/secrets'

// POST /api/questions/generate
export const generateQuestions = async (req: Request, res: Response) => {
  try {
    const { categories, context_text, persona_name, persona_type } = req.body
    
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'categories array is required' })
    }

    const groqApiKey = await getSecret('GROQ_API_KEY')
    const groq = new Groq({ apiKey: groqApiKey || '' })
    
    const prompt = `
You are an expert sales trainer. The user wants to generate test questions for a sales training scenario.
Persona Name: ${persona_name || 'N/A'}
Persona Type: ${persona_type || 'N/A'}
Context: ${context_text || 'No additional context provided.'}

Please generate exactly 2 distinct questions for EACH of the following categories: ${categories.join(', ')}.
These questions are what the Sales Rep should ask the Persona to succeed, or what the Persona might challenge the Rep with. Phrase them as "Questions the Rep should aim to ask/answer".

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

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an expert AI API. Output ONLY raw JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.7
    })

    const text = completion.choices[0].message.content || '{}'
    const jsonText = text.replace(/`json|`/g, "").trim()
    const data = JSON.parse(jsonText)
    const aiQuestions = data.questions || []

    // Fetch top questions from the bank for these categories
    const { data: bankQuestions, error: bankErr } = await supabase
      .from('question_bank')
      .select('id, category, question_text, average_rating')
      .in('category', categories)
      .order('average_rating', { ascending: false })
      .order('total_ratings', { ascending: false })
      .limit(20);
      
    const formattedBankQuestions = (bankQuestions || []).map(q => ({
      id: q.id,
      category: q.category,
      text: q.question_text,
      isBank: true,
      rating: q.average_rating
    }))

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
