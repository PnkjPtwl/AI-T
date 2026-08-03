'use client'

import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import BriefingPage from './briefing/page'

const TrainingSessionClient = dynamic(
  () => import('./TrainingSessionClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#1E1B4B] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium text-sm">Loading live training session...</p>
        </div>
      </div>
    )
  }
)

export default function TrainingScenarioRoutePage({ params }: { params: { scenarioId: string } }) {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const mode = searchParams.get('mode')

  // If sessionId or mode=session is explicitly passed, open live session room. Otherwise show the Training Briefing page!
  if (sessionId || mode === 'session') {
    return <TrainingSessionClient scenarioId={params.scenarioId} />
  }

  return <BriefingPage params={params} />
}
