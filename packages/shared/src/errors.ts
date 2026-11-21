import { z } from 'zod';

export const ERROR_CODES = [
  'NO_RESULTS',
  'RATE_LIMITED',
  'PROVIDER_DOWN',
  'BAD_QUERY',
  'UNAUTHENTICATED',
  'NOT_FOUND',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({ code: ErrorCodeSchema, message: z.string() });
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  NO_RESULTS: 404,
  RATE_LIMITED: 429,
  PROVIDER_DOWN: 502,
  BAD_QUERY: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
};
