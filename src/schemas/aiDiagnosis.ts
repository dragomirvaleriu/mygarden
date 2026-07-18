import { z } from 'zod';

// Shape returned to the AILensScanner UI. confidence is a 0–100 percentage.
export const AiDiagnosisResponseSchema = z.object({
  type: z.enum(['disease', 'pest', 'healthy', 'unknown']),
  diagnostic: z.string().describe("Common (and, where relevant, scientific) name of the plant issue, pest, or disease, in Romanian"),
  confidence: z.number().min(0).max(100).describe("Confidence score between 0 and 100"),
  actiune_urgenta: z.string().describe("Concise, actionable treatment recommendation in Romanian, including products and dosage where relevant"),
});

export type AiDiagnosisResponse = z.infer<typeof AiDiagnosisResponseSchema>;

// The client sends the captured photo as base64 (no data: prefix) plus its MIME type.
export const AiDiagnosisRequestSchema = z.object({
  imageBase64: z.string().min(1).describe("Base64-encoded image data (without the data: URI prefix)"),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).describe("MIME type of the image"),
});

export type AiDiagnosisRequest = z.infer<typeof AiDiagnosisRequestSchema>;
