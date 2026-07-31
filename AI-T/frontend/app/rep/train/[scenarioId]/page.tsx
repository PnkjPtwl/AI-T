'use client'

import dynamic from 'next/dynamic'

const TrainingSessionClient = dynamic(
  () => import('./TrainingSessionClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Loading training session...</p>
        </div>
      </div>
    )
  }
)

export default function TrainingSessionPage({ params }: { params: { scenarioId: string } }) {
  return <TrainingSessionClient scenarioId={params.scenarioId} />
}
