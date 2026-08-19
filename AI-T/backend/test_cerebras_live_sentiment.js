const { OpenAI } = require('openai');
require('dotenv').config({ path: 'c:/Users/Relanto/SalesCoach_version/AI-T/AI-T/backend/.env' });

async function test() {
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const client = new OpenAI({
    baseURL: 'https://api.cerebras.ai/v1',
    apiKey: cerebrasKey
  });

  const kbContextStr = `--- KNOWLEDGE BASE EXCERPT (Source: spark_solutions / 04_Competitive_Battle_Cards.md) ---
Pricing is $18 PEPM for core payroll, tiered down to $14 PEPM at 500+ employees. Implementation fee is $7,500 waived on 3-year term.
--- KNOWLEDGE BASE EXCERPT (Source: spark_solutions / company-profile.md) ---
Spark Solutions currently uses ADP for payroll. Experiencing high tax penalty rates ($48,000 last year) and manual off-cycle run overhead.`;

  const factCheckJsonBlock = `,
  "fact_check": {
    "has_contradiction": <boolean>,
    "rep_claim": "<what the rep said that contradicts the KB, or empty string if no contradiction>",
    "kb_fact": "<the actual fact from the KB that contradicts the rep's claim, or empty string>",
    "correction_hint": "<a short, helpful correction the rep should know, or empty string>"
  }`;

  const ragBlock = `\nKNOWLEDGE BASE CONTEXT (use to ground your advice — this is BACKGROUND HISTORY, NOT the current conversation):\n${kbContextStr}\n`;

  const prompt = `You are a real-time AI sales coach helping a Sales Rep during a live practice call. Return ONLY a raw JSON object (no markdown, no backticks).

ROLE CONTEXT: The Sales Rep is the person doing the practice (they said the first message above). The AI Persona they are speaking WITH is called "Tony Stark". Suggestions must be written AS the Sales Rep speaking TO Tony Stark — never address the rep by name in the suggestions.

--- RECENT CONVERSATION HISTORY ---
Tony Stark: Thanks, Alex. We're reviewing the roadmap—specifically the ADP data migration steps and how the Active Directory integration will work. Could you walk us through those details?
Sales Rep: Sure, our implementation roadmap includes a four-phase migration where we extract historical payroll data from ADP, transform it into our schema, and run parallel payroll runs for validation before go-live. This approach has been used successfully with Apex Cloud Services and Novus Technology Partners, achieving zero payroll errors.
Tony Stark: That sounds solid, Alex. My next concern is cost—how does the pricing break down across those four phases, and what guarantees do we have if we hit an unexpected issue during the parallel run?
-----------------------------------

Sales Rep's LATEST message: "Sure, our implementation roadmap includes a four-phase migration where we extract historical payroll data from ADP, transform it into our schema, and run parallel payroll runs for validation before go-live. This approach has been used successfully with Apex Cloud Services and Novus Technology Partners, achieving zero payroll errors."
Tony Stark's LATEST reply: "That sounds solid, Alex. My next concern is cost—how does the pricing break down across those four phases, and what guarantees do we have if we hit an unexpected issue during the parallel run?"
${ragBlock}
Return this exact JSON structure:
{
  "customer_sentiment": <integer 0-100, 0=very negative, 50=neutral, 100=very positive>,
  "rep_tone_type": "good" | "warn",
  "coaching_hint": "<1 concise, prescriptive coaching sentence — reference MEDDICC framework stages if relevant>",
  "suggested_followups": ["<full response 1>", "<full response 2>", "<full response 3>"],
  "suggested_followups_sources": ["kb" | "general", "kb" | "general", "kb" | "general"],
  "battle_card": "<1-2 sentence competitive or product positioning insight the rep can use right now>",
  "meddpicc_status": { "Metrics": <bool>, "Economic Buyer": <bool>, "Decision Criteria": <bool>, "Decision Process": <bool>, "Paper Process": <bool>, "Identify Pain": <bool>, "Champion": <bool>, "Competition": <bool> },
  "meddpicc_tip": "<1 sentence identifying the most critical unchecked MEDDPICC component to probe next, with a specific suggested question>",
  "tone_distribution": { "alert": <int>, "hesitant": <int>, "warm": <int>, "wise": <int> }${factCheckJsonBlock}
}
tone_distribution values must sum to exactly 100.
`;

  try {
    const res = await client.chat.completions.create({
      model: 'gpt-oss-120b',
      messages: [
        { role: 'system', content: 'Return ONLY raw JSON with no markdown formatting. The output must be a single valid JSON object. Do not include markdown code blocks.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1600,
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });
    console.log("SUCCESS! Response raw content:");
    console.log(res.choices[0].message.content);
    const parsed = JSON.parse(res.choices[0].message.content);
    console.log("PARSED SUCCESSFULLY! keys:", Object.keys(parsed));
  } catch (err) {
    console.error("ERROR in Cerebras call:", err);
  }
}

test();
