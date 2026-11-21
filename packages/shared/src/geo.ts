import { z } from 'zod';

export const GeoSuggestQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  kind: z.literal('airport').default('airport'),
});
export type GeoSuggestQuery = z.infer<typeof GeoSuggestQuerySchema>;

export const GeoSuggestionSchema = z.object({
  code: z.string().regex(/^[A-Z]{3}$/),
  name: z.string().min(1),
  city: z.string().min(1),
});
export type GeoSuggestion = z.infer<typeof GeoSuggestionSchema>;

export const GeoSuggestResponseSchema = z.object({
  suggestions: z.array(GeoSuggestionSchema),
});
export type GeoSuggestResponse = z.infer<typeof GeoSuggestResponseSchema>;
