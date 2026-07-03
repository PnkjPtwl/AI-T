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

export function generateSystemInstruction(scenario: any): string {
  let basePrompt = "";

  // 1. Direct Override (Highest Priority)
  if (scenario.custom_prompt && scenario.custom_prompt.trim() !== '') {
    basePrompt = scenario.custom_prompt;
  } else {
    // 2. Parse soft-schema metadata from context_text
    let metadata: any = {};
    const jsonMatch = scenario.context_text?.match(/\[SCENARIO_METADATA:\s*({.*?})\]/s);
    if (jsonMatch) {
      try {
        metadata = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("Failed to parse SCENARIO_METADATA", e);
      }
    }

    // 3. Check if we have rich AI-extracted metadata
    if (metadata.personality_traits && metadata.communication_style) {
      basePrompt = `You are a ${scenario.persona_type} named ${scenario.persona_name}.
You are highly ${metadata.personality_traits}.
Your communication style is: ${metadata.communication_style}.
You frequently raise objections such as: ${metadata.objection_style || 'General hesitation based on value'}.
You make decisions based on: ${metadata.decision_drivers || 'ROI and cost-effectiveness'}.
Maintain this behavior consistently and challenge vague responses.`;
    } else if (scenario.persona_name && scenario.context_text) {
      // 4. Use DB fields directly for custom/dynamic personas
      basePrompt = `You are acting as a specific buyer persona in a sales coaching simulation.
--- PERSONA DETAILS ---
Name: ${scenario.persona_name}
Role: ${scenario.persona_type || 'Customer'}

--- SCENARIO DETAILS ---
Context: ${scenario.context_text}

--- DIFFICULTY BEHAVIOR ---
Difficulty Level: ${scenario.difficulty?.toUpperCase() || 'UNKNOWN'}
You should adjust your resistance and objections based on this difficulty level.`;
    } else {
      // 5. Fallback to hardcoded JSON configurations (Original Logic for extremely legacy data)
      const personas = JSON.parse(fs.readFileSync(personasPath, 'utf8'));
      const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));
      const objections = JSON.parse(fs.readFileSync(objectionsPath, 'utf8'));

      const personaConfig = personas.find((p: any) => p.persona_name === scenario.persona_name) || personas[0];
      
      const match = scenario.context_text?.match(/\[SCENARIO:\s*(.*?)\]/);
      const extractedScenarioName = match ? match[1] : scenario.persona_type;
      const scenarioConfig = scenarios.find((s: any) => s.scenario_name === extractedScenarioName) || scenarios[0];

      const relevantObjections = scenarioConfig.likely_objections.map((objKey: string) => {
        return objections[objKey] ? `${objKey}: ${objections[objKey].ai_behavior} (e.g. "${objections[objKey].examples[0]}")` : '';
      }).filter(Boolean).join('\n');

      let difficultyModifier = '';
      if (scenario.difficulty === 'beginner') {
        difficultyModifier = 'You are cooperative, open to discussion, and relatively easy to convince. Do not be overly aggressive.';
      } else if (scenario.difficulty === 'intermediate') {
        difficultyModifier = 'You are slightly resistant. You will ask objections and expect good answers before yielding.';
      } else {
        difficultyModifier = 'You are highly skeptical, aggressive with objections, and very difficult to convince. Push back hard on vague answers.';
      }

      basePrompt = `You are acting as a specific buyer persona in a sales coaching simulation.
--- PERSONA DETAILS ---
Name/Role: ${personaConfig.persona_name} (${personaConfig.persona_type})
Personality: ${personaConfig.personality_description}
Emotional State: ${personaConfig.emotional_state}
Communication Style: ${personaConfig.communication_style}
Response Behavior: ${personaConfig.response_behavior}
Escalation Behavior: ${personaConfig.escalation_behavior}

--- SCENARIO DETAILS ---
Scenario: ${scenarioConfig.scenario_name}
Context: ${scenarioConfig.business_context}
Your Goal: ${scenarioConfig.customer_goal}

--- OBJECTIONS TO USE ---
Based on the scenario, you should actively try to weave in these objections and behaviors:
${relevantObjections}

--- DIFFICULTY BEHAVIOR ---
Difficulty Level: ${scenario.difficulty?.toUpperCase() || 'UNKNOWN'}
${difficultyModifier}`;
    }
  }

  // ALWAYS append these strict rules regardless of where the prompt came from
  return `${basePrompt}

--- STRICT CONVERSATIONAL RULES (MUST FOLLOW) ---
1. You are acting as a real person in a live, spoken conversation. DO NOT break character. DO NOT act like an AI assistant.
2. CRITICAL: Limit your responses to 1-3 sentences MAXIMUM. NEVER output long paragraphs or over-explain.
3. Be highly conversational, natural, and human-like.
4. Respond ONLY to the latest user input. Do not repeat previous points unless explicitly asked.
5. Reveal information GRADUALLY. Do not give away all your details or pain points at once. Make the sales rep work for it by asking good questions.
6. Match your response length to the user's input length (e.g., if they ask a quick question, give a quick answer).`;
}
