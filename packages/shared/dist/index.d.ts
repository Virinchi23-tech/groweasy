import { z } from 'zod';
export declare const CRM_STATUSES: readonly ["GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE"];
export declare const DATA_SOURCES: readonly ["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots"];
export type CRMStatus = typeof CRM_STATUSES[number];
export type DataSource = typeof DATA_SOURCES[number];
export declare const RawRowSchema: z.ZodRecord<z.ZodString, z.ZodOptional<z.ZodNullable<z.ZodString>>>;
export declare const LeadValidationSchema: z.ZodEffects<z.ZodObject<{
    created_at: z.ZodEffects<z.ZodString, string, string>;
    name: z.ZodDefault<z.ZodString>;
    email: z.ZodOptional<z.ZodUnion<[z.ZodNullable<z.ZodString>, z.ZodLiteral<"">]>>;
    country_code: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    mobile_without_country_code: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    company: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    city: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    state: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    country: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    lead_owner: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    crm_status: z.ZodEnum<["GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE"]>;
    crm_note: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    data_source: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodEnum<["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots", ""]>>>, "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots" | null | undefined, "" | "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots" | null | undefined>;
    possession_time: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    description: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    name: string;
    country_code: string | null;
    mobile_without_country_code: string | null;
    company: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    lead_owner: string | null;
    crm_status: "GOOD_LEAD_FOLLOW_UP" | "DID_NOT_CONNECT" | "BAD_LEAD" | "SALE_DONE";
    crm_note: string | null;
    possession_time: string | null;
    description: string | null;
    email?: string | null | undefined;
    data_source?: "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots" | null | undefined;
}, {
    created_at: string;
    crm_status: "GOOD_LEAD_FOLLOW_UP" | "DID_NOT_CONNECT" | "BAD_LEAD" | "SALE_DONE";
    name?: string | undefined;
    email?: string | null | undefined;
    country_code?: string | null | undefined;
    mobile_without_country_code?: string | null | undefined;
    company?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    country?: string | null | undefined;
    lead_owner?: string | null | undefined;
    crm_note?: string | null | undefined;
    data_source?: "" | "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots" | null | undefined;
    possession_time?: string | null | undefined;
    description?: string | null | undefined;
}>, {
    created_at: string;
    name: string;
    country_code: string | null;
    mobile_without_country_code: string | null;
    company: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    lead_owner: string | null;
    crm_status: "GOOD_LEAD_FOLLOW_UP" | "DID_NOT_CONNECT" | "BAD_LEAD" | "SALE_DONE";
    crm_note: string | null;
    possession_time: string | null;
    description: string | null;
    email?: string | null | undefined;
    data_source?: "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots" | null | undefined;
}, {
    created_at: string;
    crm_status: "GOOD_LEAD_FOLLOW_UP" | "DID_NOT_CONNECT" | "BAD_LEAD" | "SALE_DONE";
    name?: string | undefined;
    email?: string | null | undefined;
    country_code?: string | null | undefined;
    mobile_without_country_code?: string | null | undefined;
    company?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    country?: string | null | undefined;
    lead_owner?: string | null | undefined;
    crm_note?: string | null | undefined;
    data_source?: "" | "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots" | null | undefined;
    possession_time?: string | null | undefined;
    description?: string | null | undefined;
}>;
export type ValidatedLead = z.infer<typeof LeadValidationSchema>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["ADMIN", "USER"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "USER";
}, {
    name: string;
    email: string;
    password: string;
    role?: "ADMIN" | "USER" | undefined;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
