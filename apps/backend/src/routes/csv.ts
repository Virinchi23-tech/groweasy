import { Router, Response } from 'express';
import multer from 'multer';
import * as csv from 'fast-csv';
import fs from 'fs';
import path from 'path';
import { prisma } from '@groweasy/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { csvLogger, errorLogger } from '../utils/logger';
import { sseManager } from '../services/queue';

const router = Router();

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

const parseCSVFile = (filePath: string): Promise<{ headers: string[]; rows: any[] }> => {
  return new Promise((resolve, reject) => {
    const rows: any[] = [];
    let headers: string[] = [];

    fs.createReadStream(filePath)
      .pipe(csv.parse({ headers: true }))
      .on('headers', (h) => {
        headers = h;
      })
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        resolve({ headers, rows });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

// Upload CSV API
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const filePath = req.file.path;
    const fileSize = req.file.size;
    const originalName = req.file.originalname;

    csvLogger.info(`Parsing uploaded CSV: ${originalName} (${fileSize} bytes)`);

    const { headers, rows } = await parseCSVFile(filePath);

    // Create Import job record
    const importJob = await prisma.import.create({
      data: {
        fileName: originalName,
        userId: req.user!.id,
        totalRows: rows.length,
        status: 'PENDING',
      },
    });

    // Create CSVFile log
    await prisma.cSVFile.create({
      data: {
        importId: importJob.id,
        filePath,
        fileSize,
        headers: JSON.stringify(headers),
      },
    });

    await prisma.importLog.create({
      data: {
        importId: importJob.id,
        level: 'INFO',
        message: `CSV file uploaded and parsed successfully. Row count: ${rows.length}`,
      },
    });

    // Return the response with preview data (first 10 rows)
    const previewRows = rows.slice(0, 10);

    return res.status(201).json({
      importId: importJob.id,
      fileName: originalName,
      totalRows: rows.length,
      headers,
      preview: previewRows,
    });
  } catch (err: any) {
    errorLogger.error('CSV upload/parse failed', { error: err.message });
    return res.status(500).json({ error: `Failed to parse CSV file: ${err.message}` });
  }
});

// Confirm Import API
router.post('/confirm', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  const { importId } = req.body;

  if (!importId) {
    return res.status(400).json({ error: 'importId is required' });
  }

  try {
    const importJob = await prisma.import.findUnique({
      where: { id: importId },
      include: { csvFiles: true },
    });

    if (!importJob) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    if (importJob.status !== 'PENDING') {
      return res.status(400).json({ error: `Import job is already in status: ${importJob.status}` });
    }

    const csvFile = importJob.csvFiles[0];
    if (!csvFile || !fs.existsSync(csvFile.filePath)) {
      return res.status(404).json({ error: 'Parsed CSV file was not found on server' });
    }

    // Parse the entire CSV again to queue it
    const { rows } = await parseCSVFile(csvFile.filePath);

    // Queue batches of 100
    const batchSize = 100;
    const totalBatches = Math.ceil(rows.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const batchPayload = rows.slice(start, start + batchSize);

      await prisma.processingQueue.create({
        data: {
          importId,
          batchIndex: i,
          status: 'PENDING',
          payload: JSON.stringify(batchPayload),
        },
      });
    }

    // Update import status
    await prisma.import.update({
      where: { id: importId },
      data: { status: 'PROCESSING', updatedAt: new Date() },
    });

    await prisma.importLog.create({
      data: {
        importId,
        level: 'INFO',
        message: `Import confirmed by user. Created ${totalBatches} processing batches in background queue.`,
      },
    });

    csvLogger.info(`Import ${importId} confirmed. Queued ${totalBatches} batches.`);

    return res.json({
      success: true,
      message: 'Processing started in background queue',
      totalBatches,
    });
  } catch (err: any) {
    errorLogger.error('Confirm import failed', { error: err.message });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// CSV Status JSON API
router.get('/status/:id', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const importJob = await prisma.import.findUnique({
      where: { id: req.params.id },
      include: {
        csvFiles: true,
        _count: {
          select: { queueItems: true },
        },
      },
    });

    if (!importJob) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    const completedQueue = await prisma.processingQueue.count({
      where: { importId: req.params.id, status: 'COMPLETED' },
    });

    const failedQueue = await prisma.processingQueue.count({
      where: { importId: req.params.id, status: 'FAILED' },
    });

    const processingQueue = await prisma.processingQueue.count({
      where: { importId: req.params.id, status: 'PROCESSING' },
    });

    let headers: string[] = [];
    let previewRows: any[] = [];
    const csvFile = importJob.csvFiles[0];
    if (csvFile && fs.existsSync(csvFile.filePath)) {
      try {
        headers = JSON.parse(csvFile.headers);
      } catch (e) {
        headers = [];
      }
      try {
        const { rows } = await parseCSVFile(csvFile.filePath);
        previewRows = rows.slice(0, 10);
      } catch (e) {
        previewRows = [];
      }
    }

    return res.json({
      id: importJob.id,
      importId: importJob.id,
      fileName: importJob.fileName,
      status: importJob.status,
      totalRows: importJob.totalRows,
      processedRows: importJob.processedRows,
      successfulRows: importJob.successfulRows,
      failedRows: importJob.failedRows,
      skippedRows: importJob.skippedRows,
      duplicateRows: importJob.duplicateRows,
      errorMessage: importJob.errorMessage,
      progress: importJob.totalRows > 0 ? Math.round((importJob.processedRows / importJob.totalRows) * 100) : 0,
      headers,
      preview: previewRows,
      batches: {
        total: importJob._count.queueItems,
        completed: completedQueue,
        failed: failedQueue,
        processing: processingQueue,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// SSE Streaming Status API
router.get('/status/:id/stream', (req: any, res: Response) => {
  const importId = req.params.id;

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write('retry: 10000\n\n');

  csvLogger.info(`Client connected to SSE progress stream for Import ${importId}`);
  sseManager.add(importId, res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECT', importId })}\n\n`);

  req.on('close', () => {
    csvLogger.info(`Client disconnected from SSE progress stream for Import ${importId}`);
    sseManager.remove(importId, res);
  });
});

// CSV Import History
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const imports = await prisma.import.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    });
    return res.json(imports);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// CSV Import Result Summary
router.get('/result/:id', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const importJob = await prisma.import.findUnique({
      where: { id: req.params.id },
      include: {
        logs: { orderBy: { createdAt: 'asc' } },
        failedImports: { take: 100 }, // Limit preview of error logs to first 100
        duplicateLeads: {
          take: 100,
          include: { lead: { select: { name: true, email: true, mobileWithoutCountryCode: true } } },
        },
      },
    });

    if (!importJob) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    return res.json(importJob);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Download Error CSV API
router.get('/download-errors/:id', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const failedRows = await prisma.failedImport.findMany({
      where: { importId: req.params.id },
      orderBy: { rowIndex: 'asc' },
    });

    if (failedRows.length === 0) {
      return res.status(404).json({ error: 'No errors found for this import' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=import_errors_${req.params.id}.csv`);

    const csvStream = csv.format({ headers: true });
    csvStream.pipe(res);

    failedRows.forEach((failed) => {
      const raw = JSON.parse(failed.rawRow);
      csvStream.write({
        RowIndex: failed.rowIndex,
        ErrorMessage: failed.errorMessage,
        ...raw,
      });
    });

    csvStream.end();
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Download Processed Result CSV API
router.get('/download-result/:id', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { importId: req.params.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found for this import' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=imported_leads_${req.params.id}.csv`);

    const csvStream = csv.format({ headers: true });
    csvStream.pipe(res);

    leads.forEach((lead) => {
      csvStream.write({
        id: lead.id,
        created_at: lead.createdAt.toISOString(),
        name: lead.name,
        email: lead.email,
        country_code: lead.countryCode,
        mobile_without_country_code: lead.mobileWithoutCountryCode,
        company: lead.company,
        city: lead.city,
        state: lead.state,
        country: lead.country,
        lead_owner: lead.leadOwner,
        crm_status: lead.crmStatus,
        crm_note: lead.crmNote,
        data_source: lead.dataSource,
        possession_time: lead.possessionTime,
        description: lead.description,
      });
    });

    csvStream.end();
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
