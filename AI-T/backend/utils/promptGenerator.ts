import fs from 'fs'
import path from 'path'

// Resolve paths safely for both dev (ts-node) and prod (dist/)
const getDataPath = (filename: string) => {
  const devPath = path.join(__dirname, '../data', filename);
  const prodPath = path.join(__dirname, '../../data', filename);
  return fs.existsSync(devPath) ? devPath : prodPath;
};

const personasPath = getDataPath('personas.json');
const scenariosPath = getDataPath('scenarios.json');
const objectionsPath = getDataPath('objections.json');

/**
 * Generates the system instruction for the AI persona.
 * @param scenario - The training scenario object from the database.
 * @param hasRagContext - Set to TRUE only when RAG/Knowledge Base context is actually being injected.
 *                        This controls whether the prompt implies a pre-existing relationship with the seller.
 */
export function generateSystemInstruction(scenario: any, hasRagContext: boolean = false): string {
  let basePrompt = "";

  // Extract explicit role/company details to prevent buyer/seller role confusion
  const pName = scenario.persona_name || scenario.contact_title || 'Sarah Thompson'
  const cTitle = scenario.contact_title || scenario.persona_type || 'Decision Maker / Buyer'
  const cCompany = scenario.contact_company || 'Phoenix Automotive'
  const sCompany = 'Relanto'

  // Clean context text
  const cleanCtx = (scenario.context_text || '')
    .replace(/\n*\[SCENARIO_METADATA:\s*{[\s\S]*?}\]/g, '')
    .replace(/-\s*\[(Opening|Closing|Discovery|Objection|Pitch|Technical|General)\][^\n]*/gi, '')
    .replace(/Questions the Rep should aim to ask:[^\n]*/gi, '')
    .trim()

  // 1. Direct Override (Highest Priority)
  if (scenario.custom_prompt && scenario.custom_prompt.trim() !== '') {
    basePrompt = scenario.custom_prompt;
  } else {
    // 2. Build interaction context based on whether RAG knowledge base is active
    const interactionContext = hasRagContext
      ? `--- INTERACTION CONTEXT & RELATIONSHIP WITH SELLER ---
The human Sales Rep speaking with you represents ${sCompany}.
ESTABLISHED RELATIONSHIP: Your company (${cCompany}) has already been in active discussions with ${sCompany}. You have completed prior discovery sessions and email exchanges with ${sCompany} regarding your current initiatives and pain points.
DO NOT claim this is your first interaction with ${sCompany}. You know ${sCompany} and have ongoing meeting history with them. Use the knowledge base context provided to accurately reference past calls and history.`
      : `--- INTERACTION CONTEXT ---
The human Sales Rep speaking with you represents ${sCompany}.
FIRST SCHEDULED MEETING: This is your first proper sit-down meeting with this sales rep. You agreed to this meeting after a brief introductory exchange (a short email or a quick 5-minute intro call) where you heard that ${sCompany} may have a relevant solution for a challenge your team is facing.
You have a general awareness of ${sCompany} but no deep knowledge of their product. You came into this meeting with an open but discerning mind — you have real problems to solve and you are willing to explore, but you need the rep to earn your trust and demonstrate value.
DO NOT reference any detailed past calls, proposals, or in-depth discussions with ${sCompany}. This is a fresh first meeting.`

    basePrompt = `You are acting as the buyer persona in a sales practice roleplay simulation.

--- YOUR IDENTITY (BUYER / CUSTOMER) ---
Your Name: ${pName}
Your Title/Role: ${cTitle}
Your Company: ${cCompany}

${interactionContext}

--- PERSONA DETAILS & BEHAVIOR ---
Context & Background:
${scenario.customer_background || cleanCtx || `${cCompany} is evaluating supplier capabilities, performance specifications, and implementation requirements.`}

Personality Traits:
${typeof scenario.personality_traits === 'string' ? scenario.personality_traits : Array.isArray(scenario.personality_traits) ? scenario.personality_traits.join(', ') : 'Analytical, data-driven, thorough'}

Objection Style & Hesitations:
${scenario.objection_style || 'Challenges pricing, implementation timeline, and ROI capabilities'}

--- DIFFICULTY BEHAVIOR ---
Difficulty Level: ${scenario.difficulty?.toUpperCase() || 'ADVANCED'}
Adjust your resistance and objections based on this difficulty level.`;
  }

  // ALWAYS append strict rules
  return `${basePrompt}

--- STRICT CONVERSATIONAL RULES (MUST FOLLOW) ---
1. You are acting as a real person in a live, spoken conversation. DO NOT break character. DO NOT act like an AI assistant. You are ${pName} at ${cCompany}. The sales rep is from ${sCompany}.
2. CRITICAL: Limit your responses to 1-3 sentences MAXIMUM. NEVER output long paragraphs or over-explain.
3. Be highly conversational, natural, and human-like.
4. Respond ONLY to the latest user input. Do not repeat previous points unless explicitly asked.
5. Reveal information GRADUALLY. Do not give away all your details or pain points at once. Make the sales rep work for it by asking good questions.
6. Match your response length to the user's input length (e.g., if they ask a quick question, give a quick answer).`;
}
