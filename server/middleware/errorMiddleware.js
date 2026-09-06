/**
 * Centralized API Error Handling Middleware
 */
export function errorHandler(err, req, res, next) {
  console.error('[API Error]:', err)

  const status = err.status || err.statusCode || 500

  if (status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Upload payload is too large. Image files exceeded the maximum allowed limit.',
    })
  }

  return res.status(status).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
  })
}

export default errorHandler
