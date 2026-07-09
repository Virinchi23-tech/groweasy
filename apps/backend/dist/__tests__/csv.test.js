"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const shared_1 = require("@groweasy/shared");
describe('CSV CRM Lead Validation Schema Tests', () => {
    test('Valid Lead passes validation', () => {
        const lead = {
            created_at: new Date().toISOString(),
            name: 'Jane Doe',
            email: 'jane@groweasy.com',
            country_code: '91',
            mobile_without_country_code: '9876543210',
            company: 'GrowEasy Inc',
            city: 'Bangalore',
            state: 'Karnataka',
            country: 'India',
            lead_owner: 'System Agent',
            crm_status: 'GOOD_LEAD_FOLLOW_UP',
            crm_note: 'Secondary phone: 1234567890',
            data_source: 'leads_on_demand',
            possession_time: 'Immediate',
            description: 'Interested in properties',
        };
        const result = shared_1.LeadValidationSchema.safeParse(lead);
        expect(result.success).toBe(true);
    });
    test('Skip rule checks: failed when email AND mobile are missing', () => {
        const noEmailNoMobile = {
            created_at: new Date().toISOString(),
            name: 'Jane Doe',
            email: '',
            mobile_without_country_code: '',
            crm_status: 'GOOD_LEAD_FOLLOW_UP',
        };
        const result = shared_1.LeadValidationSchema.safeParse(noEmailNoMobile);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.errors[0]?.message).toContain('Record skipped');
        }
    });
    test('Passes with only email OR only mobile phone', () => {
        const onlyEmail = {
            created_at: new Date().toISOString(),
            name: 'Jane Doe',
            email: 'jane@groweasy.com',
            mobile_without_country_code: '',
            crm_status: 'GOOD_LEAD_FOLLOW_UP',
        };
        expect(shared_1.LeadValidationSchema.safeParse(onlyEmail).success).toBe(true);
        const onlyMobile = {
            created_at: new Date().toISOString(),
            name: 'Jane Doe',
            email: '',
            mobile_without_country_code: '9876543210',
            crm_status: 'GOOD_LEAD_FOLLOW_UP',
        };
        expect(shared_1.LeadValidationSchema.safeParse(onlyMobile).success).toBe(true);
    });
    test('CRM Status checking constraints', () => {
        const invalidStatus = {
            created_at: new Date().toISOString(),
            name: 'Jane Doe',
            email: 'jane@groweasy.com',
            crm_status: 'INVALID_STATUS_VALUE',
        };
        const result = shared_1.LeadValidationSchema.safeParse(invalidStatus);
        expect(result.success).toBe(false);
    });
    test('Data Source checking constraints', () => {
        const invalidSource = {
            created_at: new Date().toISOString(),
            name: 'Jane Doe',
            email: 'jane@groweasy.com',
            crm_status: 'GOOD_LEAD_FOLLOW_UP',
            data_source: 'invalid_data_source_name',
        };
        expect(shared_1.LeadValidationSchema.safeParse(invalidSource).success).toBe(false);
        const validSource = {
            created_at: new Date().toISOString(),
            name: 'Jane Doe',
            email: 'jane@groweasy.com',
            crm_status: 'GOOD_LEAD_FOLLOW_UP',
            data_source: 'eden_park',
        };
        expect(shared_1.LeadValidationSchema.safeParse(validSource).success).toBe(true);
    });
});
// 
