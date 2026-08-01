# SalesCoach V1 Architecture Snapshot
> **Backup Date:** 2026-08-01  
> **Purpose:** This is the complete architectural snapshot of V1 before migrating to V2. All files in this directory are exact copies of the V1 state.

---

## Database Tables (Supabase/PostgreSQL)

### 1. `organisations`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | auto-generated |
| name | TEXT UNIQUE | e.g., "Acme Corp" |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 2. `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | matches Supabase Auth user ID |
| name | TEXT | |
| email | TEXT UNIQUE | |
| role | TEXT | 'manager', 'rep', 'admin' |
| org_id | UUID FK → organisations | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 3. `calls` (Sales Call Records)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| rep_id | UUID FK → users | |
| org_id | UUID FK → organisations | |
| duration_sec | INTEGER | |
| recorded_at | TIMESTAMP | |
| transcript_text | TEXT | |
| raw_metrics_json | JSONB | |

### 4. `coaching_signals`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| call_id | UUID FK → calls | |
| signal_type | TEXT | |
| value | FLOAT | |

### 5. `training_scenarios` (AI Personas)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| org_id | UUID FK → organisations | |
| persona_name | TEXT | Internal reference |
| persona_type | TEXT | |
| contact_title | TEXT | Display label |
| contact_company | TEXT | Display label |
| difficulty | TEXT | Easy/Medium/Hard/beginner/intermediate/advanced |
| context_text | TEXT | Scenario instructions |
| personality_traits | JSONB | |
| evaluation_focus | TEXT | |
| objection_style | TEXT | |
| conversation_expectations | TEXT | |
| target_skills | TEXT | |
| custom_prompt | TEXT | |
| scorecard_metrics | JSONB | [{name, description, weight}] |
| account_name | TEXT | Links to RAG knowledge base |

### 6. `training_sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| rep_id | UUID FK → users | |
| scenario_id | UUID FK → training_scenarios | |
| messages_json | JSONB | [{role, content, voiceMetrics?}] |
| feedback_json | JSONB | AI evaluation results |
| completed_at | TIMESTAMP | null = in progress |

### 7. `training_assignments`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| rep_id | UUID FK → users | |
| manager_id | UUID FK → users | |
| scenario_id | UUID FK → training_scenarios | |
| session_id | UUID FK → training_sessions | nullable |
| status | TEXT | Pending/In Progress/Completed/Overdue |
| priority | TEXT | Low/Medium/High |
| deadline | TIMESTAMP | |
| avatar_type | TEXT | default 'female' |
| completed_at | TIMESTAMP | |

### 8. `scenario_evaluation_questions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| scenario_id | UUID FK → training_scenarios | |
| category | TEXT | |
| question_text | TEXT | |
| question_type | TEXT | 'boolean' or 'scale' |
| confidence_score | FLOAT | |

### 9. `question_bank`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| category | TEXT | |
| question_text | TEXT | |
| scenario_id | UUID FK → training_scenarios | nullable |
| average_rating | FLOAT | default 0 |
| total_ratings | INTEGER | default 0 |

---

## Backend Controllers (V1)

| Controller | File | Key Functions |
|------------|------|---------------|
| Auth | `authController.ts` | Login, signup, getDeepgramKey |
| Session | `sessionController.ts` | startPractice, sendMessage, endSession, pauseSession, retrySession, processLiveTurn, processLiveCoach, liveSentiment |
| Scenario | `scenarioController.ts` | getScenarios, createScenario, updateScenario, deleteScenario, generateScorecardMetrics, assignRepsToScenario |
| User | `userController.ts` | User management, manager dashboard |
| TTS | `ttsController.ts` | Text-to-speech via ElevenLabs |
| Persona | `personaController.ts` | Persona generation |
| Question | `questionController.ts` | Question bank management |
| Call | `callController.ts` | Call records |
| Coaching | `coachingController.ts` | Coaching signals |

## Frontend Routes (V1)

| Route | Description |
|-------|-------------|
| `/rep/dashboard` | Sales Rep main dashboard |
| `/rep/train` | Training scenario list |
| `/rep/train/[scenarioId]` | Live training session |
| `/rep/my-stats` | Rep performance stats |
| `/rep/reports` | Rep reports |
| `/rep/coaching` | Coaching view |
| `/rep/settings` | Settings |
| `/manager/dashboard` | Manager dashboard |

## AI/Third-Party Integrations (V1)

| Service | Purpose | Integration |
|---------|---------|-------------|
| Groq (llama-3.3-70b) | Live turn AI persona + evaluation | REST API via groq-sdk |
| Groq (llama-3.1-8b) | Live sentiment + coach tips | REST API (fast model) |
| Deepgram | STT, WPM, filler detection | Frontend WebSocket |
| ElevenLabs | Text-to-Speech | Backend REST API |
| RAG (Port 8001) | Knowledge base context injection | Python FastAPI service |

## RAG Knowledge Base (V1)

- **Service:** Python FastAPI on port 8001
- **Current Account:** Phoenix Automotive
- **Vector Store:** Local embeddings
- **Integration:** `ragClient.ts` utility calls RAG API, injects context into Groq prompts

---

## Files Backed Up

- `V1_FULL_SCHEMA.sql` — Complete database schema
- `V1_seed.ts` — Seed data script  
- `V1_migrate.ts` — Migration runner
- `V1_migrations/` — All 14 migration SQL files
