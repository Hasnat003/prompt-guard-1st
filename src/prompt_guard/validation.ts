/**
 * Input Validation Module
 * Fulfills Part 5 of the Master Project Blueprint:
 * - Validate type, empty input, length limits and malformed requests
 * - Handle unsupported content safely
 */

export interface ValidationResult {
  isValid: boolean;
  errorCode?: 'EMPTY_INPUT' | 'EXCEEDS_LENGTH_LIMIT' | 'INVALID_TYPE' | 'CONTAINS_NULL_BYTES';
  errorMessage?: string;
}

export function validateInput(input: unknown, maxLength: number = 8000): ValidationResult {
  if (input === null || input === undefined) {
    return {
      isValid: false,
      errorCode: 'EMPTY_INPUT',
      errorMessage: 'Prompt input cannot be null or undefined.',
    };
  }

  if (typeof input !== 'string') {
    return {
      isValid: false,
      errorCode: 'INVALID_TYPE',
      errorMessage: `Expected input to be a string, received ${typeof input}.`,
    };
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      errorCode: 'EMPTY_INPUT',
      errorMessage: 'Prompt cannot be empty or solely whitespace.',
    };
  }

  if (input.includes('\0')) {
    return {
      isValid: false,
      errorCode: 'CONTAINS_NULL_BYTES',
      errorMessage: 'Prompt contains dangerous null byte characters (0x00).',
    };
  }

  if (input.length > maxLength) {
    return {
      isValid: false,
      errorCode: 'EXCEEDS_LENGTH_LIMIT',
      errorMessage: `Prompt length (${input.length} characters) exceeds the maximum configured limit of ${maxLength}.`,
    };
  }

  return { isValid: true };
}
