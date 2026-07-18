import { z } from 'zod';

// Schema pentru facturi (Invoices)
export const invoiceSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  clientId: z.string().min(1, "Client ID is required"),
  billingMonth: z.string().min(1, "Billing month is required"),
  amount: z.number().positive("Amount must be a positive number"),
  status: z.enum(['paid', 'pending', 'overdue', 'unpaid', 'partially_paid']),
}).passthrough();

// Schema pentru programări / vizite (Visits)
export const visitSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  clientId: z.string().min(1, "Client ID is required"),
  propertyId: z.string().nullable().optional(),
  // Data trebuie să fie un string valid în format YYYY-MM-DD
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").refine((val) => {
    const timestamp = Date.parse(val);
    return !isNaN(timestamp);
  }, "Must be a valid date"),
  tipLucrare: z.string().min(1, "Work type is required"),
  detalii: z.string().nullable().optional(),
  status: z.enum(['Programat', 'Activ', 'Finalizat', 'Anulat']),
  // Câmpuri editabile pentru ora de start/end pe vizite trecute (permit și string gol, null sau lipsa valorii)
  oraInceput: z.union([
    z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM format"),
    z.literal(""),
    z.null()
  ]).optional(),
  oraSfarsit: z.union([
    z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM format"),
    z.literal(""),
    z.null()
  ]).optional(),
}).passthrough();

// Tipuri derivate pentru TypeScript
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type VisitInput = z.infer<typeof visitSchema>;
