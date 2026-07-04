import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, X, ArrowLeft } from 'lucide-react'

function getScenarioDisplayLabel(scenario: { name?: string; contact_title?: string; contact_company?: string }): string {
  // The name field from getTeamAssignments is already computed as "title - company"
  // but keep this as a fallback utility
  return scenario.name || 'Unknown Training'
}

export default function TrainingAnalyticsDrawer({ assignments }: { assignments: any[] }) {
  const router = useRouter()
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)

  // Group assignments by Scenario
  const scenariosMap: Record<string, { id: string, name: string, assignments: any[], activeCount: number }> = {}
  
  assignments.forEach((a: any) => {
    const scenarioId = a.scenario_id
    if (!scenarioId) return;

    if (!scenariosMap[scenarioId]) {
      scenariosMap[scenarioId] = {
        id: scenarioId,
        // scenario_name is already computed as "designation - company" in getTeamAssignments
        name: a.scenario_name || 'Unknown Training',
        assignments: [],
        activeCount: 0
      }
    }

    scenariosMap[scenarioId].assignments.push(a)
    if (a.status !== 'Completed') {
      scenariosMap[scenarioId].activeCount++
    }
  })

  const scenariosArray = Object.values(scenariosMap)
  const selectedScenario = selectedScenarioId ? scenariosMap[selectedScenarioId] : null;

  return (
    <>
      {/* Training list table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm mt-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-6 py-4 font-semibold text-[#64748B] text-xs">Persona</th>
                <th className="px-6 py-4 font-semibold text-[#64748B] text-xs text-center">Assigned</th>
                <th className="px-6 py-4 font-semibold text-[#64748B] text-xs text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-[#64748B] text-xs text-center">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {scenariosArray.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[#64748B]">
                    No training assignments found.
                  </td>
                </tr>
              ) : (
                scenariosArray.map((scenario) => {
                  const isActive = scenario.activeCount > 0;
                  const completedCount = scenario.assignments.filter(a => a.status === 'Completed').length;

                  return (
                    <tr key={scenario.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-6 py-5 font-semibold text-[#1A2A3A]">{scenario.name}</td>
                      <td className="px-6 py-5 text-center font-medium text-[#1A2A3A]">{scenario.assignments.length}</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-[#64748B]'}`}>
                          {isActive ? `Active · ${completedCount} done` : `All done`}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button 
                          onClick={() => setSelectedScenarioId(scenario.id)}
                          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" /> Review
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Slide-Over Drawer */}
      {selectedScenarioId && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedScenarioId(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-[600px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedScenarioId(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-[#64748B]"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-[#1A2A3A]">
                    {selectedScenario?.name} — {selectedScenario?.assignments.length} rep{selectedScenario?.assignments.length !== 1 ? 's' : ''}
                  </h2>
                  <p className="text-sm text-[#64748B]">Due {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedScenarioId(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-[#64748B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body — only reps progress, no skill gaps */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
              <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-2">
                {selectedScenario?.assignments.map((a, i) => {
                  const isCompleted = a.status === 'Completed'
                  const isOverdue = a.status === 'Overdue'
                  const isPending = a.status === 'Pending'
                  
                  return (
                    <div 
                      key={i} 
                      onClick={() => {
                        router.push(`/reps/${a.rep_id}?persona=${encodeURIComponent(selectedScenario?.name || '')}`)
                      }}
                      className={`flex items-center justify-between border-b border-[#E2E8F0] p-4 last:border-0 cursor-pointer hover:bg-[#F8FAFC] transition-colors`}
                    >
                      {/* Rep Info */}
                      <div className="flex items-center gap-4 w-1/3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          isCompleted ? 'bg-[#EBF8FF] text-[#2C5282]' :
                          isOverdue ? 'bg-[#FFF5F5] text-red-600' :
                          isPending ? 'bg-[#F1F5F9] text-[#64748B]' :
                          'bg-[#FEF3C7] text-yellow-700'
                        }`}>
                          {(a.rep_name || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-[#1A2A3A] truncate">{a.rep_name}</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="flex-1 px-6">
                        <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isCompleted ? 'bg-green-500 w-full' : isOverdue ? 'bg-red-500 w-[20%]' : isPending ? 'bg-gray-300 w-0' : 'bg-blue-500 w-[50%]'}`}
                          ></div>
                        </div>
                      </div>

                      {/* Status + Score */}
                      <div className="flex items-center gap-4 w-1/3 justify-end">
                        {isCompleted && (
                          <span className="text-sm font-medium text-[#64748B]">Score: {a.score || 0}%</span>
                        )}
                        <span className={`px-3 py-1 rounded-md text-xs font-semibold ${
                          isCompleted ? 'bg-green-100 text-green-700' : 
                          isOverdue ? 'bg-red-100 text-red-700' : 
                          isPending ? 'bg-gray-100 text-gray-600' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {a.status === 'Pending' ? 'Not started' : a.status === 'In Progress' ? 'In progress' : isOverdue ? 'Missed' : a.status}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {(!selectedScenario?.assignments || selectedScenario.assignments.length === 0) && (
                  <div className="p-8 text-center text-sm text-[#64748B]">No reps assigned yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
