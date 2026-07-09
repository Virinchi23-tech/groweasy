"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("@groweasy/db");
const auth_1 = require("../middleware/auth");
const shared_1 = require("@groweasy/shared");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// GET /leads
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const importId = req.query.importId;
        const crmStatus = req.query.crmStatus;
        const dataSource = req.query.dataSource;
        const search = req.query.search;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
        const where = {
            deletedAt: null,
        };
        if (importId)
            where.importId = importId;
        if (crmStatus)
            where.crmStatus = crmStatus;
        if (dataSource)
            where.dataSource = dataSource;
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { mobileWithoutCountryCode: { contains: search } },
                { company: { contains: search } },
            ];
        }
        const [leads, total] = await db_1.prisma.$transaction([
            db_1.prisma.lead.findMany({
                where,
                orderBy: { [sortBy]: sortOrder },
                skip,
                take: limit,
            }),
            db_1.prisma.lead.count({ where }),
        ]);
        return res.json({
            leads,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// POST /leads (manual creation)
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const parse = shared_1.LeadValidationSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: 'Validation failed', details: parse.error.format() });
        }
        const data = parse.data;
        // Check duplicate by email or phone
        const duplicateConditions = [];
        if (data.email)
            duplicateConditions.push({ email: data.email });
        if (data.mobile_without_country_code)
            duplicateConditions.push({ mobileWithoutCountryCode: data.mobile_without_country_code });
        if (duplicateConditions.length > 0) {
            const existing = await db_1.prisma.lead.findFirst({
                where: { OR: duplicateConditions, deletedAt: null },
            });
            if (existing) {
                return res.status(400).json({ error: 'Lead with this email or mobile phone number already exists' });
            }
        }
        const lead = await db_1.prisma.lead.create({
            data: {
                name: data.name,
                email: data.email || '',
                countryCode: data.country_code,
                mobileWithoutCountryCode: data.mobile_without_country_code,
                company: data.company,
                city: data.city,
                state: data.state,
                country: data.country,
                leadOwner: data.lead_owner,
                crmStatus: data.crm_status,
                crmNote: data.crm_note,
                dataSource: data.data_source,
                possessionTime: data.possession_time,
                description: data.description,
            },
        });
        // Create Audit Log
        await db_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'CREATE',
                targetTable: 'Lead',
                targetId: lead.id,
                details: JSON.stringify(data),
            },
        });
        logger_1.dbLogger.info(`Lead manually created: ${lead.id} by ${req.user.email}`);
        return res.status(201).json(lead);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// PUT /leads/:id
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const leadId = req.params.id;
        const existing = await db_1.prisma.lead.findFirst({
            where: { id: leadId, deletedAt: null },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        const parse = shared_1.LeadValidationSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: 'Validation failed', details: parse.error.format() });
        }
        const data = parse.data;
        // Check duplicate by email or phone if changed
        const duplicateConditions = [];
        if (data.email && data.email !== existing.email) {
            duplicateConditions.push({ email: data.email });
        }
        if (data.mobile_without_country_code && data.mobile_without_country_code !== existing.mobileWithoutCountryCode) {
            duplicateConditions.push({ mobileWithoutCountryCode: data.mobile_without_country_code });
        }
        if (duplicateConditions.length > 0) {
            const conflict = await db_1.prisma.lead.findFirst({
                where: { OR: duplicateConditions, deletedAt: null, NOT: { id: leadId } },
            });
            if (conflict) {
                return res.status(400).json({ error: 'Lead with this email or mobile phone number already exists' });
            }
        }
        // Capture changes for LeadHistory
        const updates = {
            name: data.name,
            email: data.email || '',
            countryCode: data.country_code,
            mobileWithoutCountryCode: data.mobile_without_country_code,
            company: data.company,
            city: data.city,
            state: data.state,
            country: data.country,
            leadOwner: data.lead_owner,
            crmStatus: data.crm_status,
            crmNote: data.crm_note,
            dataSource: data.data_source,
            possessionTime: data.possession_time,
            description: data.description,
            updatedAt: new Date(),
        };
        const changesList = [];
        const fieldsToTrack = [
            { key: 'name', dbKey: 'name' },
            { key: 'email', dbKey: 'email' },
            { key: 'countryCode', dbKey: 'country_code' },
            { key: 'mobileWithoutCountryCode', dbKey: 'mobile_without_country_code' },
            { key: 'company', dbKey: 'company' },
            { key: 'city', dbKey: 'city' },
            { key: 'state', dbKey: 'state' },
            { key: 'country', dbKey: 'country' },
            { key: 'leadOwner', dbKey: 'lead_owner' },
            { key: 'crmStatus', dbKey: 'crm_status' },
            { key: 'crmNote', dbKey: 'crm_note' },
            { key: 'dataSource', dbKey: 'data_source' },
            { key: 'possessionTime', dbKey: 'possession_time' },
            { key: 'description', dbKey: 'description' },
        ];
        fieldsToTrack.forEach(({ key, dbKey }) => {
            const oldVal = existing[key];
            const newVal = data[dbKey];
            if (String(oldVal || '') !== String(newVal || '')) {
                changesList.push({
                    field: key,
                    oldVal: oldVal ? String(oldVal) : null,
                    newVal: newVal ? String(newVal) : null,
                });
            }
        });
        const updatedLead = await db_1.prisma.lead.update({
            where: { id: leadId },
            data: updates,
        });
        // Create history entries
        for (const change of changesList) {
            await db_1.prisma.leadHistory.create({
                data: {
                    leadId,
                    fieldName: change.field,
                    oldValue: change.oldVal,
                    newValue: change.newVal,
                    changedBy: req.user.name,
                },
            });
        }
        // Create Audit Log
        await db_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'UPDATE',
                targetTable: 'Lead',
                targetId: leadId,
                details: JSON.stringify(changesList),
            },
        });
        logger_1.dbLogger.info(`Lead updated: ${leadId} by ${req.user.email}`);
        return res.json(updatedLead);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// DELETE /leads/:id (soft delete)
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const leadId = req.params.id;
        const existing = await db_1.prisma.lead.findFirst({
            where: { id: leadId, deletedAt: null },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        await db_1.prisma.lead.update({
            where: { id: leadId },
            data: { deletedAt: new Date() },
        });
        // Create Audit Log
        await db_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'DELETE',
                targetTable: 'Lead',
                targetId: leadId,
            },
        });
        logger_1.dbLogger.info(`Lead soft-deleted: ${leadId} by ${req.user.email}`);
        return res.json({ success: true, message: 'Lead deleted successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
exports.default = router;
