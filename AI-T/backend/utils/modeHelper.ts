export const getModeLimit = (modeStr?: string): number => {
  if (!modeStr) return 5
  const l = modeStr.toLowerCase().trim()
  if (l.includes('exam')) return 1
  if (l.includes('learning')) return 3
  return 5
}

export const normalizeModeDisplay = (modeStr?: string): string => {
  if (!modeStr) return 'Coach Mode'
  const l = modeStr.toLowerCase().trim()
  if (l.includes('exam')) return 'Exam Mode'
  if (l.includes('learning')) return 'Learning Mode'
  return 'Coach Mode'
}

export const normalizeModeDb = (modeStr?: string): string => {
  if (!modeStr) return 'coach'
  const l = modeStr.toLowerCase().trim()
  if (l.includes('exam')) return 'exam'
  if (l.includes('learning')) return 'learning'
  return 'coach'
}
