'use client'

import { useState, useEffect } from 'react'
import { DraggableCard } from './DraggableCard'

// ─── Types ─────────────────────────────────────────────────────────────────
export interface HudPayload {
  customer_sentiment: number
  rep_tone_type: 'good' | 'warn'
  coaching_hint: string
  sentiment_trend: string[]
  emotion: string
  emotion_action: string
  objection: { detected: boolean; type: string; hint: string; full_suggestion: string }
  buying_signal: { detected: boolean; phrase: string; recommendation: string }
  risk_signal: { detected: boolean; type: string; follow_up: string }
  competitor: { detected: boolean; name: string; battle_card: { strengths: string[]; differentiators: string[]; comparison: string } | null }
  product_recommendation: string[]
  meddicc: { metrics: boolean; economic_buyer: boolean; decision_criteria: boolean; champion: boolean; prompt: string }
  compliance_alert: { detected: boolean; claim: string; correction: string }
  cross_sell: string[]
}

export type TrainingMode = 'exam' | 'coach' | 'learning'

interface HudOverlayProps {
  payload: HudPayload | null
  mode: TrainingMode
  /** Frontend-computed */
  talkRatio: { repPct: number; customerPct: number; isWarning: boolean }
  pace: { wpm: number; label: string; labelText: string; color: string }
  isSilent: boolean
  hasVoiceData: boolean
}

// ─── Shared styles ──────────────────────────────────────────────────────────
const CARD_BASE = 'bg-[#0F172A]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white p-4 w-[300px] text-sm'
const WARN_BADGE = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider'
const SECTION_LABEL = 'text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mb-1'

// ─── Sentiment Score Ring ───────────────────────────────────────────────────
function SentimentRing({ value }: { value: number }) {
  const color = value >= 70 ? '#10B981' : value >= 40 ? '#F59E0B' : '#EF4444'
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="4" />
        <circle
          cx="28" cy="28" r="24" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${(value / 100) * 150.8} 150.8`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <span className="text-sm font-black" style={{ color }}>{value}%</span>
    </div>
  )
}

// ─── Individual HUD Cards ───────────────────────────────────────────────────

function SentimentCard({ payload, mode, onClose }: { payload: HudPayload; mode: TrainingMode; onClose: () => void }) {
  const canShowTrend = mode !== 'exam'
  return (
    <DraggableCard defaultX={16} defaultY={80} onClose={onClose} className={CARD_BASE}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span className={SECTION_LABEL}>Live AI Coach</span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <SentimentRing value={payload.customer_sentiment} />
        <div className="flex-1">
          <p className={SECTION_LABEL}>Customer Sentiment</p>
          {canShowTrend && payload.sentiment_trend?.length > 0 && (
            <div className="flex gap-0.5 mt-1">
              {payload.sentiment_trend.map((e, i) => <span key={i} className="text-sm">{e}</span>)}
            </div>
          )}
        </div>
        <div className="text-center">
          <p className={SECTION_LABEL}>Rep Tone</p>
          <span className={`text-xs font-black ${payload.rep_tone_type === 'good' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {payload.rep_tone_type === 'good' ? '✅ Good' : '⚠️ Warn'}
          </span>
        </div>
      </div>

      <div className={`rounded-xl p-2.5 border text-xs leading-relaxed font-medium ${
        payload.rep_tone_type === 'good'
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
      }`}>
        {payload.coaching_hint}
      </div>
    </DraggableCard>
  )
}

function EmotionCard({ payload, mode, onClose }: { payload: HudPayload; mode: TrainingMode; onClose: () => void }) {
  if (mode === 'exam') return null
  const emotionEmoji: Record<string, string> = {
    excited: '🤩', confused: '😕', frustrated: '😤', hesitant: '😬', skeptical: '🤨', neutral: '😐'
  }
  const emotionColor: Record<string, string> = {
    excited: 'text-yellow-300', confused: 'text-blue-300', frustrated: 'text-red-400',
    hesitant: 'text-amber-400', skeptical: 'text-purple-400', neutral: 'text-gray-400'
  }
  const e = payload.emotion || 'neutral'
  return (
    <DraggableCard defaultX={16} defaultY={340} onClose={onClose} className={`${CARD_BASE} w-[260px]`}>
      <p className={SECTION_LABEL}>Customer Emotion</p>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-3xl">{emotionEmoji[e] || '😐'}</span>
        <div>
          <p className={`text-sm font-black capitalize ${emotionColor[e] || 'text-gray-400'}`}>{e}</p>
          {mode === 'learning' && payload.emotion_action && (
            <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed">{payload.emotion_action}</p>
          )}
        </div>
      </div>
    </DraggableCard>
  )
}

function TalkRatioCard({ ratio, mode, onClose }: { ratio: { repPct: number; customerPct: number; isWarning: boolean }; mode: TrainingMode; onClose: () => void }) {
  if (mode === 'exam') return null
  return (
    <DraggableCard defaultX={16} defaultY={460} onClose={onClose} className={`${CARD_BASE} w-[260px]`}>
      <p className={SECTION_LABEL}>Talk-to-Listen Ratio</p>
      <div className="mt-2 space-y-1.5">
        <div>
          <div className="flex justify-between text-[10px] text-white/50 mb-0.5">
            <span>Rep</span><span className={ratio.repPct > 70 ? 'text-red-400 font-black' : 'text-white/70'}>{ratio.repPct}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${ratio.repPct > 70 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${ratio.repPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-white/50 mb-0.5">
            <span>Customer</span><span className="text-white/70">{ratio.customerPct}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${ratio.customerPct}%` }} />
          </div>
        </div>
      </div>
      {ratio.isWarning && (
        <div className="mt-2.5 text-[10px] bg-red-500/10 border border-red-500/20 rounded-xl px-2.5 py-1.5 text-red-300 flex items-start gap-1.5">
          <span>⚠️</span>
          <span>Customer isn't speaking enough. Pause and ask an open-ended question.</span>
        </div>
      )}
    </DraggableCard>
  )
}

function SpeakingPaceCard({ pace, hasVoiceData, onClose }: {
  pace: { wpm: number; label: string; labelText: string; color: string }
  hasVoiceData: boolean
  onClose: () => void
}) {
  if (!hasVoiceData) return null
  return (
    <DraggableCard defaultX={340} defaultY={80} onClose={onClose} className={`${CARD_BASE} w-[220px]`}>
      <p className={SECTION_LABEL}>Speaking Pace</p>
      <div className="flex items-center gap-3 mt-2">
        <div className="text-2xl font-black">{pace.wpm > 0 ? pace.wpm : '—'}</div>
        <div>
          <p className="text-[9px] text-white/40">WPM</p>
          <p className={`text-xs font-black ${pace.color}`}>{pace.labelText}</p>
        </div>
      </div>
      {pace.label === 'too_fast' && (
        <p className="text-[10px] text-amber-300/80 mt-1.5 leading-relaxed">Slow down slightly to improve comprehension.</p>
      )}
      {pace.label === 'too_slow' && (
        <p className="text-[10px] text-blue-300/80 mt-1.5 leading-relaxed">Pick up the pace — customer may disengage.</p>
      )}
    </DraggableCard>
  )
}

function SilenceCard({ onClose }: { onClose: () => void }) {
  return (
    <DraggableCard defaultX={typeof window !== 'undefined' ? window.innerWidth / 2 - 150 : 400} defaultY={20} onClose={onClose} className="bg-amber-500/90 backdrop-blur-xl border border-amber-400/30 rounded-2xl shadow-2xl text-white p-3 w-[300px] text-sm animate-bounce-once">
      <div className="flex items-start gap-2">
        <span className="text-xl">🔕</span>
        <div>
          <p className="font-black text-sm">Silence Detected</p>
          <p className="text-[11px] text-white/80 mt-0.5">Ask another discovery question to re-engage the customer.</p>
        </div>
      </div>
    </DraggableCard>
  )
}

function ObjectionCard({ objection, mode, onClose }: {
  objection: HudPayload['objection']
  mode: TrainingMode
  onClose: () => void
}) {
  if (!objection.detected || mode === 'exam') return null
  return (
    <DraggableCard defaultX={340} defaultY={180} onClose={onClose} className={`${CARD_BASE} w-[300px]`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🛡️</span>
        <p className={SECTION_LABEL}>Objection Detected</p>
        <span className="ml-auto text-[9px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full font-black">{objection.type}</span>
      </div>
      <p className="text-[11px] text-amber-300 font-semibold leading-relaxed">{objection.hint}</p>
      {mode === 'learning' && objection.full_suggestion && (
        <div className="mt-2 bg-white/5 rounded-xl p-2.5 text-[10px] text-white/70 leading-relaxed whitespace-pre-line">
          {objection.full_suggestion}
        </div>
      )}
    </DraggableCard>
  )
}

function BuyingSignalCard({ signal, mode, onClose }: {
  signal: HudPayload['buying_signal']
  mode: TrainingMode
  onClose: () => void
}) {
  if (!signal.detected || mode === 'exam') return null
  return (
    <DraggableCard defaultX={340} defaultY={400} onClose={onClose} className="bg-emerald-900/90 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-2xl text-white p-4 w-[300px] text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg animate-pulse">🔥</span>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">Strong Buying Signal</p>
      </div>
      {signal.phrase && (
        <p className="text-[11px] text-emerald-300 italic mb-2">"{signal.phrase}"</p>
      )}
      {mode === 'learning' && signal.recommendation && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-[10px] text-emerald-200 leading-relaxed">
          <span className="font-black">Recommended: </span>{signal.recommendation}
        </div>
      )}
    </DraggableCard>
  )
}

function RiskSignalCard({ risk, mode, onClose }: {
  risk: HudPayload['risk_signal']
  mode: TrainingMode
  onClose: () => void
}) {
  if (!risk.detected || mode === 'exam') return null
  const typeColor: Record<string, string> = {
    budget: 'text-red-400', timeline: 'text-amber-400', authority: 'text-purple-400', competition: 'text-orange-400'
  }
  return (
    <DraggableCard defaultX={660} defaultY={80} onClose={onClose} className={`${CARD_BASE} w-[280px]`}>
      <div className="flex items-center gap-2 mb-2">
        <span>⚠️</span>
        <p className={SECTION_LABEL}>Risk Signal Detected</p>
        <span className={`ml-auto text-[9px] font-black capitalize ${typeColor[risk.type] || 'text-white/60'}`}>{risk.type}</span>
      </div>
      {mode === 'learning' && risk.follow_up && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-[10px] text-red-300 leading-relaxed">
          <span className="font-black">Ask: </span>{risk.follow_up}
        </div>
      )}
    </DraggableCard>
  )
}

function CompetitorCard({ competitor, mode, onClose }: {
  competitor: HudPayload['competitor']
  mode: TrainingMode
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (!competitor.detected || mode === 'exam') return null
  const bc = competitor.battle_card
  return (
    <DraggableCard defaultX={660} defaultY={200} onClose={onClose} className={`${CARD_BASE} w-[320px]`}>
      <div className="flex items-center gap-2 mb-2">
        <span>⚔️</span>
        <p className={SECTION_LABEL}>Competitor Mentioned</p>
        <span className="ml-auto text-[10px] font-black text-orange-300 bg-orange-500/10 px-2 py-0.5 rounded-full">{competitor.name}</span>
      </div>
      {mode === 'learning' && bc && (
        <>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
            className="text-[10px] font-black text-blue-400 hover:text-blue-300 transition-colors"
          >
            {expanded ? '▲ Hide Battle Card' : '▼ Show Battle Card'}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-[9px] font-black uppercase text-emerald-400/60 mb-1">Our Strengths</p>
                <ul className="space-y-0.5">
                  {bc.strengths.map((s, i) => (
                    <li key={i} className="text-[10px] text-white/70 flex items-start gap-1.5"><span className="text-emerald-400 mt-0.5">✓</span>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-blue-400/60 mb-1">Key Differentiators</p>
                <ul className="space-y-0.5">
                  {bc.differentiators.map((d, i) => (
                    <li key={i} className="text-[10px] text-white/70 flex items-start gap-1.5"><span className="text-blue-400 mt-0.5">›</span>{d}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-white/5 rounded-xl p-2 text-[10px] text-white/50 italic leading-relaxed">{bc.comparison}</div>
            </div>
          )}
        </>
      )}
    </DraggableCard>
  )
}

function ProductRecommendationCard({ products, mode, onClose }: {
  products: string[]
  mode: TrainingMode
  onClose: () => void
}) {
  if (mode !== 'learning' || !products?.length) return null
  return (
    <DraggableCard defaultX={660} defaultY={480} onClose={onClose} className={`${CARD_BASE} w-[260px]`}>
      <div className="flex items-center gap-2 mb-2">
        <span>💡</span>
        <p className={SECTION_LABEL}>Product Recommendation</p>
      </div>
      <ul className="space-y-1.5">
        {products.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-[11px] text-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            {p}
          </li>
        ))}
      </ul>
    </DraggableCard>
  )
}

function MeddiccCard({ meddicc, mode, onClose }: {
  meddicc: HudPayload['meddicc']
  mode: TrainingMode
  onClose: () => void
}) {
  if (mode === 'exam') return null
  const fields = [
    { key: 'metrics', label: 'Metrics' },
    { key: 'economic_buyer', label: 'Economic Buyer' },
    { key: 'decision_criteria', label: 'Decision Criteria' },
    { key: 'champion', label: 'Champion' },
  ] as const
  const missingFields = fields.filter(f => !meddicc[f.key])
  if (missingFields.length === 0) return null

  return (
    <DraggableCard defaultX={typeof window !== 'undefined' ? window.innerWidth - 340 : 1000} defaultY={80} onClose={onClose} className={`${CARD_BASE} w-[280px]`}>
      <div className="flex items-center gap-2 mb-3">
        <span>📊</span>
        <p className={SECTION_LABEL}>MEDDICC Tracker</p>
      </div>
      {mode === 'learning' ? (
        <div className="grid grid-cols-2 gap-1.5">
          {fields.map(f => (
            <div key={f.key} className={`flex items-center gap-1.5 text-[10px] font-semibold rounded-lg px-2 py-1.5 ${
              meddicc[f.key] ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-400'
            }`}>
              <span>{meddicc[f.key] ? '✓' : '❌'}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-amber-300">
          Missing: {missingFields.map(f => f.label).join(', ')}
        </div>
      )}
      {meddicc.prompt && (
        <p className="mt-2 text-[10px] text-blue-300/70 leading-relaxed">{meddicc.prompt}</p>
      )}
    </DraggableCard>
  )
}

function ComplianceCard({ alert, mode, onClose }: {
  alert: HudPayload['compliance_alert']
  mode: TrainingMode
  onClose: () => void
}) {
  if (!alert.detected || mode === 'exam') return null
  return (
    <DraggableCard defaultX={typeof window !== 'undefined' ? window.innerWidth / 2 - 160 : 500} defaultY={20} onClose={onClose} className="bg-red-900/90 backdrop-blur-xl border border-red-500/40 rounded-2xl shadow-2xl text-white p-4 w-[320px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🚨</span>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">Compliance Alert</p>
      </div>
      {alert.claim && (
        <p className="text-[11px] text-red-300 italic mb-2">Flagged: "{alert.claim}"</p>
      )}
      {mode === 'learning' && alert.correction && (
        <div className="bg-white/5 border border-red-500/20 rounded-xl p-2.5 text-[10px] text-white/70 leading-relaxed">
          <span className="font-black text-white/90">Try instead: </span>{alert.correction}
        </div>
      )}
    </DraggableCard>
  )
}

function CrossSellCard({ items, mode, onClose }: {
  items: string[]
  mode: TrainingMode
  onClose: () => void
}) {
  if (mode !== 'learning' || !items?.length) return null
  return (
    <DraggableCard defaultX={typeof window !== 'undefined' ? window.innerWidth - 290 : 1000} defaultY={400} onClose={onClose} className={`${CARD_BASE} w-[260px]`}>
      <div className="flex items-center gap-2 mb-2">
        <span>🚀</span>
        <p className={SECTION_LABEL}>Upsell Opportunity</p>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-[11px] text-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </DraggableCard>
  )
}

// ─── Master HUD Overlay ─────────────────────────────────────────────────────
export default function HudOverlay({ payload, mode, talkRatio, pace, isSilent, hasVoiceData }: HudOverlayProps) {
  // Per-card dismiss state — resets when a new payload arrives
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Reset dismissals when a new payload comes in for signal cards
    setDismissed(prev => ({
      ...prev,
      silence: false, // silence card resets on every payload
    }))
  }, [payload])

  const dismiss = (key: string) => setDismissed(prev => ({ ...prev, [key]: true }))

  if (!payload) return null

  return (
    <>
      {/* Sentiment + Coaching Hint — always visible */}
      {!dismissed.sentiment && (
        <SentimentCard payload={payload} mode={mode} onClose={() => dismiss('sentiment')} />
      )}

      {/* Emotion Detection — Coach + Learning */}
      {!dismissed.emotion && (
        <EmotionCard payload={payload} mode={mode} onClose={() => dismiss('emotion')} />
      )}

      {/* Talk-to-Listen — Coach + Learning */}
      {!dismissed.talkRatio && (
        <TalkRatioCard ratio={talkRatio} mode={mode} onClose={() => dismiss('talkRatio')} />
      )}

      {/* Speaking Pace — voice turns only */}
      {!dismissed.pace && (
        <SpeakingPaceCard pace={pace} hasVoiceData={hasVoiceData} onClose={() => dismiss('pace')} />
      )}

      {/* Silence — all modes */}
      {isSilent && !dismissed.silence && (
        <SilenceCard onClose={() => dismiss('silence')} />
      )}

      {/* Objection — Coach hint / Learning full */}
      {!dismissed.objection && (
        <ObjectionCard objection={payload.objection} mode={mode} onClose={() => dismiss('objection')} />
      )}

      {/* Buying Signal — Coach detect / Learning rec */}
      {!dismissed.buying && (
        <BuyingSignalCard signal={payload.buying_signal} mode={mode} onClose={() => dismiss('buying')} />
      )}

      {/* Risk Signal — Coach detect / Learning follow-up */}
      {!dismissed.risk && (
        <RiskSignalCard risk={payload.risk_signal} mode={mode} onClose={() => dismiss('risk')} />
      )}

      {/* Competitor Battle Card */}
      {!dismissed.competitor && (
        <CompetitorCard competitor={payload.competitor} mode={mode} onClose={() => dismiss('competitor')} />
      )}

      {/* Product Recommendation — Learning only */}
      {!dismissed.product && (
        <ProductRecommendationCard products={payload.product_recommendation} mode={mode} onClose={() => dismiss('product')} />
      )}

      {/* MEDDICC Tracker */}
      {!dismissed.meddicc && (
        <MeddiccCard meddicc={payload.meddicc} mode={mode} onClose={() => dismiss('meddicc')} />
      )}

      {/* Compliance Alert */}
      {!dismissed.compliance && (
        <ComplianceCard alert={payload.compliance_alert} mode={mode} onClose={() => dismiss('compliance')} />
      )}

      {/* Cross-sell / Upsell — Learning only */}
      {!dismissed.crossSell && (
        <CrossSellCard items={payload.cross_sell} mode={mode} onClose={() => dismiss('crossSell')} />
      )}
    </>
  )
}
