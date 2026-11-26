export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public status = 0,
  ) {
    super(message)
  }
  /** True when the request never reached the server (offline, timeout, DNS…). */
  get isNetwork() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT'
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message)
    return new AppError('UNKNOWN', msg || 'Something went wrong. Please try again.')
  }
  return new AppError('UNKNOWN', 'Something went wrong. Please try again.')
}

export function errorMessage(err: unknown) {
  const e = toAppError(err)
  if (e.isNetwork) return 'Connection problem — please check your internet and try again.'
  return e.message
}
