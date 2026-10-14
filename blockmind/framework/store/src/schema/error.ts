import { BlockMindError, ErrorCode } from '@blockmind/global/exceptions';

export class SchemaValidateError extends BlockMindError {
  constructor(flavour: string, message: string) {
    super(
      ErrorCode.SchemaValidateError,
      `Invalid schema for ${flavour}: ${message}`
    );
  }
}
