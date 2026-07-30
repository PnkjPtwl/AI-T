export const managerOnly = (req, res, next) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied. Managers only.' })
  }
  next()
}

export const repOnly = (req, res, next) => {
  if (req.user.role !== 'rep') {
    return res.status(403).json({ error: 'Access denied. Reps only.' })
  }
  next()
}