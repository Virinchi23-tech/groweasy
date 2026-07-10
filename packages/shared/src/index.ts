import { z } from 'zod';

export const CRM_STATUSES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE'
] as const;

export const DATA_SOURCES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots'
] as const;

export type CRMStatus = typeof CRM_STATUSES[number];
export type DataSource = typeof DATA_SOURCES[number];

// Schema for raw CSV row parsing (all strings initially)
export const RawRowSchema = z.record(z.string().nullable().optional());

// Base lead validation rules applied after AI mapping
export const LeadValidationSchema = z.object({
  created_at: z.preprocess((val) => {
    if (val === undefined || val === null || val === '') {
      return new Date().toISOString();
    }
    return val;
  }, z.string().refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime());
  }, { message: "created_at must be a valid ISO or date string" })),
  name: z.string().min(1, "Name is required").default("Unknown"),
  email: z.string().email("Invalid email format").nullable().or(z.literal("")).optional(),
  country_code: z.string().nullable().optional().default(""),
  mobile_without_country_code: z.string().nullable().optional().default(""),
  company: z.string().nullable().optional().default(""),
  city: z.string().nullable().optional().default(""),
  state: z.string().nullable().optional().default(""),
  country: z.string().nullable().optional().default(""),
  lead_owner: z.string().nullable().optional().default(""),
  crm_status: z.enum(CRM_STATUSES, {
    errorMap: () => ({ message: "Invalid CRM Status. Must be GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, or SALE_DONE" })
  }),
  crm_note: z.string().nullable().optional().default(""),
  data_source: z.enum([...DATA_SOURCES, ""]).nullable().optional().transform(val => val === "" ? null : val),
  possession_time: z.string().nullable().optional().default(""),
  description: z.string().nullable().optional().default("")
}).refine(data => {
  const hasEmail = data.email && data.email.trim().length > 0;
  const hasMobile = data.mobile_without_country_code && data.mobile_without_country_code.trim().length > 0;
  return !!(hasEmail || hasMobile);
}, {
  message: "Record skipped: No email AND no mobile number available",
  path: ["email"] // attached to email
});

export type ValidatedLead = z.infer<typeof LeadValidationSchema>;

// Auth Validation Schemas
export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(['ADMIN', 'USER']).default('USER')
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
