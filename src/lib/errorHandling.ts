/**
 * Error Handling and Validation Utilities
 * 
 * This module provides comprehensive error handling, validation functions,
 * and utility functions for the invitation system.
 */

// Error Types
export enum InvitationErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  AUTH_CREATION_FAILED = 'AUTH_CREATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_ALREADY_USED = 'TOKEN_ALREADY_USED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class InvitationError extends Error {
  public type: InvitationErrorType;
  public details?: any;
  public userMessage?: string;

  constructor(message: string, type: InvitationErrorType, details?: any, userMessage?: string) {
    super(message);
    this.name = 'InvitationError';
    this.type = type;
    this.details = details;
    this.userMessage = userMessage;
  }
}

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  INVALID_TOKEN: 'Invalid or expired invitation token',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
  USER_ALREADY_EXISTS: 'User with this email already exists',
  INVITATION_EXPIRED: 'This invitation has expired',
  INVITATION_ALREADY_USED: 'This invitation has already been used',
  NETWORK_ERROR: 'Network error. Please check your connection and try again',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again'
};

// Email Validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Password Validation
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Number check
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Determine strength
  if (errors.length === 0) {
    if (password.length >= 12 && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?].*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      strength = 'strong';
    } else if (password.length >= 10) {
      strength = 'medium';
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    strength
  };
}

// Token Validation
export function isValidToken(token: string): boolean {
  // Basic token format validation
  return typeof token === 'string' && token.length >= 32 && /^[a-zA-Z0-9\-_]+$/.test(token);
}

// User Agent Detection
export function getUserAgent(): string {
  if (typeof window !== 'undefined' && window.navigator) {
    return window.navigator.userAgent;
  }
  return 'Unknown';
}

// Handle Invitation Errors with Context
export async function handleInvitationError(
  error: unknown, 
  context: { 
    action: string; 
    userId?: string; 
    invitationId?: string; 
    email?: string; 
    userAgent?: string;
  }
): Promise<InvitationError> {
  let invitationError: InvitationError;
  
  if (error instanceof InvitationError) {
    invitationError = error;
  } else if (error instanceof Error) {
    invitationError = new InvitationError(
      error.message,
      InvitationErrorType.UNKNOWN_ERROR
    );
  } else {
    invitationError = new InvitationError(
      'An unexpected error occurred',
      InvitationErrorType.UNKNOWN_ERROR
    );
  }
  
  // Log error for debugging (in production, you'd send this to a logging service)
  console.error('Invitation Error:', {
    type: invitationError.type,
    message: invitationError.message,
    context,
    timestamp: new Date().toISOString()
  });

  return invitationError;
}

// Retry Utility Function
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        break;
      }

      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}