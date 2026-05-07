import { AssemblyAI } from 'assemblyai'
import { Groq } from 'groq-sdk'

// Endpoint: POST /api/persona/from-audio
export const generatePersonaFromAudio = async (req: any, res: any) => {
  try {
    const audioFile = req.file

    if (!audioFile) {
      return res.status(400).json({ error: 'Audio/video file is required.' })
    }

    const assemblyApiKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyApiKey || assemblyApiKey === 'your_key_here') {
      return res.status(500).json({
        error: 'AssemblyAI API Key is missing or invalid. Please configure it in the backend .env file.'
      })
    }

    const aai = new AssemblyAI({ apiKey: assemblyApiKey })

    // 1. Transcribe with Speaker Diarization
    const transcript = await aai.transcripts.transcribe({
      audio: audioFile.buffer,
      speaker_labels: true,
      speech_models: ["universal-3-pro", "universal-2"],
    } as any)

    if (transcript.status === 'error') {
      throw new Error(`AssemblyAI Error: ${transcript.error}`)
    }

    if (!transcript.utterances || transcript.utterances.length === 0) {
      return res.status(400).json({ error: 'No speech detected in the audio file.' })
    }

    // Format diarized transcript
    const formattedTranscript = transcript.utterances
      .map(u => `Speaker ${u.speaker}: ${u.text}`)
      .join('\n')

    // 2. Extract Persona using Groq
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })

    const extractionPrompt = `
You are an expert sales coach and persona designer.
Read the following diarized transcript of a sales call. 
Your task is to:
1. Identify which speaker is the client/buyer (the prospect being sold to).
2. Extract detailed persona information about this client/buyer.

Transcript:
"""
${formattedTranscript}
"""

Return ONLY a valid JSON object matching this exact structure:
{
  "persona_name": "string (Make up a realistic name if not mentioned)",
  "persona_type": "string (MUST BE EXACTLY ONE OF: 'Careful Budgeter (Very price-conscious)', 'Easy Supporter (Already interested)', 'Tech Deep-Diver (Wants technical details)', 'Busy Boss (Short on time)', 'Comparison Shopper (Evaluating options)', 'Doubtful Buyer (Not fully convinced)', 'Curious Explorer (Just exploring)', 'Not Interested (Low engagement)')",
  "difficulty": "string (beginner, intermediate, or advanced - inferred based on behavior, justify briefly)",
  "personality_traits": "string (5-7 detailed traits with explanation, write as a descriptive paragraph, not just keywords)",
  "communication_style": "string (descriptive paragraph focusing on tone, pacing, interruptions, clarity)",
  "objection_style": "string (detailed explanation of how they object, with examples from the transcript)",
  "decision_drivers": "string (explain what influences their decisions and why, based on transcript context)",
  "target_skills": "string (comma separated list of 2-3 sales skills the rep should practice with this persona, e.g. Discovery, Objection Handling, Closing)",
  "evaluation_focus": "string (comma separated list of what the manager should evaluate the rep on for this specific persona)"
}
`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: extractionPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const resultText = completion.choices[0].message.content
    if (!resultText) {
      throw new Error("Failed to extract persona data from LLM.")
    }

    const personaData = JSON.parse(resultText)

    // Generate preview prompt (default custom_prompt)
    const generatedPrompt = `You are a ${personaData.persona_type} named ${personaData.persona_name}.
You are highly ${personaData.personality_traits}.
Your communication style is: ${personaData.communication_style}.
You frequently raise objections such as: ${personaData.objection_style}.
You make decisions based on: ${personaData.decision_drivers}.
Maintain this behavior consistently and challenge vague responses.`

    return res.status(200).json({
      success: true,
      data: personaData,
      generatedPrompt,
      transcriptPreview: formattedTranscript
    })

  } catch (error: any) {
    console.error('Error generating persona from audio:', error)
    return res.status(500).json({ error: error.message || 'An unexpected error occurred during persona generation.' })
  }
}
