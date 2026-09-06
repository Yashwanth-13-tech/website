import appDb from '../config/database.js'

/**
 * Middleware to verify admin bearer session token
 */
export async function verifyAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return res.status(401).json({
        success: false,
        valid: false,
        message: 'Unauthorized. Admin session token required.',
      })
    }

    const session = await appDb.getSession(token)
    if (!session) {
      return res.status(401).json({
        success: false,
        valid: false,
        message: 'Unauthorized. Invalid or expired admin token.',
      })
    }

    req.adminSession = session
    req.adminUser = session.user
    next()
  } catch (err) {
    console.error('[Auth Middleware Error]:', err)
    return res.status(500).json({
      success: false,
      message: 'Authentication verification error.',
    })
  }
}

export default verifyAdminAuth
