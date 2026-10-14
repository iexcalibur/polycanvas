import { ErrorCode } from './code.js';

export class BlockMindError extends Error {
  static ErrorCode = ErrorCode;

  code: ErrorCode;

  isFatal: boolean;

  constructor(code: ErrorCode, message: string, options?: { cause: Error }) {
    super(message, options);
    this.name = 'BlockMindError';
    this.code = code;
    this.isFatal = code >= 10000;
  }
}

export function handleError(error: Error) {
  if (!(error instanceof BlockMindError)) {
    throw error;
  }

  if (error.isFatal) {
    throw new Error(
      'A fatal error for BlockMind occurs, please contact the team if you find this.',
      { cause: error }
    );
  }

  console.error(
    "A runtime error for BlockMind occurs, you can ignore this error if it won't break the user experience."
  );
  console.error(error.stack);
}

export * from './code.js';
