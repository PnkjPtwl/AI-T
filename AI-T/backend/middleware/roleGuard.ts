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

export const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' })
  }
  next()
}

export const managerOrAdmin = (req, res, next) => {
  if (req.user.role !== 'manager' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Managers or Admins only.' })
  }
  next()
}