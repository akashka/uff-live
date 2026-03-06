// In-memory OTP store for password reset - use Redis in production for multi-instance deployments
export const resetStore = new Map<string, { otp: string; expires: number }>();
