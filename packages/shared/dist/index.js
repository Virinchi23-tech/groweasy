"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterSchema = exports.LoginSchema = exports.LeadValidationSchema = exports.RawRowSchema = exports.DATA_SOURCES = exports.CRM_STATUSES = void 0;
const zod_1 = require("zod");
exports.CRM_STATUSES = [
    'GOOD_LEAD_FOLLOW_UP',
    'DID_NOT_CONNECT',
    'BAD_LEAD',
    'SALE_DONE'
];
exports.DATA_SOURCES = [
    'leads_on_demand',
    'meridian_tower',
    'eden_park',
    'varah_swamy',
    'sarjapur_plots'
];
// Schema for raw CSV row parsing (all strings initially)
exports.RawRowSchema = zod_1.z.record(zod_1.z.string().nullable().optional());
// Base lead validation rules applied after AI mapping
exports.LeadValidationSchema = zod_1.z.object({
    created_at: zod_1.z.preprocess((val) => {
        if (val === undefined || val === null || val === '') {
            return new Date().toISOString();
        }
        return val;
    }, zod_1.z.string().refine((val) => {
        const d = new Date(val);
        return !isNaN(d.getTime());
    }, { message: "created_at must be a valid ISO or date string" })),
    name: zod_1.z.string().min(1, "Name is required").default("Unknown"),
    email: zod_1.z.string().email("Invalid email format").nullable().or(zod_1.z.literal("")).optional(),
    country_code: zod_1.z.string().nullable().optional().default(""),
    mobile_without_country_code: zod_1.z.string().nullable().optional().default(""),
    company: zod_1.z.string().nullable().optional().default(""),
    city: zod_1.z.string().nullable().optional().default(""),
    state: zod_1.z.string().nullable().optional().default(""),
    country: zod_1.z.string().nullable().optional().default(""),
    lead_owner: zod_1.z.string().nullable().optional().default(""),
    crm_status: zod_1.z.enum(exports.CRM_STATUSES, {
        errorMap: () => ({ message: "Invalid CRM Status. Must be GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, or SALE_DONE" })
    }),
    crm_note: zod_1.z.string().nullable().optional().default(""),
    data_source: zod_1.z.enum([...exports.DATA_SOURCES, ""]).nullable().optional().transform(val => val === "" ? null : val),
    possession_time: zod_1.z.string().nullable().optional().default(""),
    description: zod_1.z.string().nullable().optional().default("")
}).refine(data => {
    const hasEmail = data.email && data.email.trim().length > 0;
    const hasMobile = data.mobile_without_country_code && data.mobile_without_country_code.trim().length > 0;
    return !!(hasEmail || hasMobile);
}, {
    message: "Record skipped: No email AND no mobile number available",
    path: ["email"] // attached to email
});
// Auth Validation Schemas
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters")
});
exports.RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    name: zod_1.z.string().min(2, "Name must be at least 2 characters"),
    role: zod_1.z.enum(['ADMIN', 'USER']).default('USER')
});
