# SalesCoach AI: Enterprise Sales Intelligence & Coaching Platform

SalesCoach AI is an immersive, mission-focused training environment designed to transform sales representatives into high-performing tactical operators. Through AI-driven persona simulations and deep performance analytics, the platform provides a risk-free workspace for perfecting discovery, objection handling, and closing strategies.

## 🚀 Key Features

### 🛡️ Tactical Command Center (Dashboards)
*   **Manager Intelligence**: Executive overview of team performance, skill distribution matrices, and tactical correlation mapping.
*   **Representative Workspace**: Actionable "Mission Control" focused on active training priorities, daily coaching recommendations, and performance snapshots.

### 🎭 Intelligence Briefing (Pre-Simulation)
*   **Multi-Dimensional Profiles**: Detailed customer archetypes, functional roles, and psychological profiles.
*   **Discovery Roadmaps**: Suggested strategic questions and expected objections to prepare reps for the field.
*   **AI Voice Selection**: High-fidelity ElevenLabs voice integration for realistic vocal interactions.

### 🎙️ Live Simulation Engine
*   **Voice & Text Interaction**: Real-time dialogue with AI personas powered by Llama 3.1 (via Groq).
*   **Dynamic Feedback**: Context-aware AI responses that challenge reps based on their input quality.
*   **Attempt Tracking**: Integrated "Mission Quota" system (3 attempts per persona) to encourage focused practice.

### 📊 Performance Intelligence
*   **Growth Trajectory**: Historical proficiency mapping and operational readiness indices.
*   **Competency Matrix**: Multi-axial skill breakdown (Discovery, Closing, Empathy, etc.).
*   **Persona Adaptation Analysis**: Specific insights into performance variance across different buyer archetypes.

---

## 🛠️ Technology Stack

### Frontend
*   **Framework**: Next.js 14 (App Router)
*   **Styling**: Premium Enterprise CSS System (Modern SaaS aesthetic)
*   **Analytics**: Recharts (High-fidelity data visualization)
*   **Icons**: Lucide React

### Backend
*   **Runtime**: Node.js & Express
*   **Language**: TypeScript
*   **Database**: Supabase (PostgreSQL)
*   **AI Integration**: 
    *   **LLM**: Groq (Llama 3.1-70b/8b)
    *   **Voice Synthesis**: ElevenLabs (API v1)
    *   **Transcription**: AssemblyAI / Groq Whisper

---

## 📦 Project Structure

```text
├── backend/
│   ├── controllers/      # Business logic & AI orchestration
│   ├── routes/           # API endpoint definitions
│   ├── db/               # Migrations & database schema
│   └── data/             # Persona & Scenario definitions
├── frontend/
│   ├── app/              # Next.js App Router (Rep & Manager views)
│   ├── components/       # Reusable UI components & Layouts
│   └── public/           # Static assets
└── scratch/              # Maintenance & utility scripts
```

---

## ⚙️ Getting Started

### 1. Prerequisites
*   Node.js 18+
*   Supabase Account
*   Groq API Key
*   ElevenLabs API Key

### 2. Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `npm install`
3. Configure your `.env` file with the following variables:
   ```env
   SUPABASE_URL=your_url
   SUPABASE_SERVICE_ROLE_KEY=your_key
   GROQ_API_KEY=your_key
   ELEVENLABS_API_KEY=your_key
   ```
4. Start the server: `npm run dev`

### 3. Frontend Setup
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Configure your `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```
4. Launch the application: `npm run dev`

---

## 📝 Administrative Controls
Managers can deploy new missions, manage representative assignments, and review detailed tactical reports (transcripts + skill grades) for every simulation completed by their team.

## 🛡️ Security & Integrity
*   **JWT Authentication**: Secure role-based access for Managers and Representatives.
*   **Environment Isolation**: Secrets are managed via standard `.env` protocols.

---
*Developed for high-performance sales teams.*
