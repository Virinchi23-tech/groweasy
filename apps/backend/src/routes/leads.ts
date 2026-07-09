import { Router } from 'express';
import { prisma } from '@groweasy/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { LeadValidationSchema } from '@groweasy/shared';
import { dbLogger } from '../utils/logger';

const router = Router();

// GET /leads
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const importId = req.query.importId as string;
    const crmStatus = req.query.crmStatus as string;
    const dataSource = req.query.dataSource as string;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const where: any = {
      deletedAt: null,
    };

    if (importId) where.importId = importId;
    if (crmStatus) where.crmStatus = crmStatus;
    if (dataSource) where.dataSource = dataSource;

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { mobileWithoutCountryCode: { contains: search } },
        { company: { contains: search } },
      ];
    }

    const [leads, total] = await prisma.$transaction([
      prisma.lead.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
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
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /leads (manual creation)
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const parse = LeadValidationSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.format() });
    }

    const data = parse.data;

    // Check duplicate by email or phone
    const duplicateConditions: any[] = [];
    if (data.email) duplicateConditions.push({ email: data.email });
    if (data.mobile_without_country_code) duplicateConditions.push({ mobileWithoutCountryCode: data.mobile_without_country_code });

    if (duplicateConditions.length > 0) {
      const existing = await prisma.lead.findFirst({
        where: { OR: duplicateConditions, deletedAt: null },
      });
      if (existing) {
        return res.status(400).json({ error: 'Lead with this email or mobile phone number already exists' });
      }
    }

    const lead = await prisma.lead.create({
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
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE',
        targetTable: 'Lead',
        targetId: lead.id,
        details: JSON.stringify(data),
      },
    });

    dbLogger.info(`Lead manually created: ${lead.id} by ${req.user!.email}`);

    return res.status(201).json(lead);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /leads/:id
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const leadId = req.params.id;

    const existing = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const parse = LeadValidationSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Validation failed', details: parse.error.format() });
    }

    const data = parse.data;

    // Check duplicate by email or phone if changed
    const duplicateConditions: any[] = [];
    if (data.email && data.email !== existing.email) {
      duplicateConditions.push({ email: data.email });
    }
    if (data.mobile_without_country_code && data.mobile_without_country_code !== existing.mobileWithoutCountryCode) {
      duplicateConditions.push({ mobileWithoutCountryCode: data.mobile_without_country_code });
    }

    if (duplicateConditions.length > 0) {
      const conflict = await prisma.lead.findFirst({
        where: { OR: duplicateConditions, deletedAt: null, NOT: { id: leadId } },
      });
      if (conflict) {
        return res.status(400).json({ error: 'Lead with this email or mobile phone number already exists' });
      }
    }

    // Capture changes for LeadHistory
    const updates: any = {
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

    const changesList: { field: string; oldVal: string | null; newVal: string | null }[] = [];
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
      const oldVal = (existing as any)[key];
      const newVal = (data as any)[dbKey];

      if (String(oldVal || '') !== String(newVal || '')) {
        changesList.push({
          field: key,
          oldVal: oldVal ? String(oldVal) : null,
          newVal: newVal ? String(newVal) : null,
        });
      }
    });

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updates,
    });

    // Create history entries
    for (const change of changesList) {
      await prisma.leadHistory.create({
        data: {
          leadId,
          fieldName: change.field,
          oldValue: change.oldVal,
          newValue: change.newVal,
          changedBy: req.user!.name,
        },
      });
    }

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE',
        targetTable: 'Lead',
        targetId: leadId,
        details: JSON.stringify(changesList),
      },
    });

    dbLogger.info(`Lead updated: ${leadId} by ${req.user!.email}`);

    return res.json(updatedLead);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /leads/:id (soft delete)
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const leadId = req.params.id;

    const existing = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { deletedAt: new Date() },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE',
        targetTable: 'Lead',
        targetId: leadId,
      },
    });

    dbLogger.info(`Lead soft-deleted: ${leadId} by ${req.user!.email}`);

    return res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
