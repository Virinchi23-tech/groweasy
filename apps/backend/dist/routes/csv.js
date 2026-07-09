"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const csv = __importStar(require("fast-csv"));
const fs_1 = __importDefault(require("fs"));
const db_1 = require("@groweasy/db");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const queue_1 = require("../services/queue");
const router = (0, express_1.Router)();
// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const upload = (0, multer_1.default)({ dest: uploadDir });
const parseCSVFile = (filePath) => {
    return new Promise((resolve, reject) => {
        const rows = [];
        let headers = [];
        fs_1.default.createReadStream(filePath)
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
router.post('/upload', auth_1.authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
        const filePath = req.file.path;
        const fileSize = req.file.size;
        const originalName = req.file.originalname;
        logger_1.csvLogger.info(`Parsing uploaded CSV: ${originalName} (${fileSize} bytes)`);
        const { headers, rows } = await parseCSVFile(filePath);
        // Create Import job record
        const importJob = await db_1.prisma.import.create({
            data: {
                fileName: originalName,
                userId: req.user.id,
                totalRows: rows.length,
                status: 'PENDING',
            },
        });
        // Create CSVFile log
        await db_1.prisma.cSVFile.create({
            data: {
                importId: importJob.id,
                filePath,
                fileSize,
                headers: JSON.stringify(headers),
            },
        });
        await db_1.prisma.importLog.create({
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
    }
    catch (err) {
        logger_1.errorLogger.error('CSV upload/parse failed', { error: err.message });
        return res.status(500).json({ error: `Failed to parse CSV file: ${err.message}` });
    }
});
// Confirm Import API
router.post('/confirm', auth_1.authenticateToken, async (req, res) => {
    const { importId } = req.body;
    if (!importId) {
        return res.status(400).json({ error: 'importId is required' });
    }
    try {
        const importJob = await db_1.prisma.import.findUnique({
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
        if (!csvFile || !fs_1.default.existsSync(csvFile.filePath)) {
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
            await db_1.prisma.processingQueue.create({
                data: {
                    importId,
                    batchIndex: i,
                    status: 'PENDING',
                    payload: JSON.stringify(batchPayload),
                },
            });
        }
        // Update import status
        await db_1.prisma.import.update({
            where: { id: importId },
            data: { status: 'PROCESSING', updatedAt: new Date() },
        });
        await db_1.prisma.importLog.create({
            data: {
                importId,
                level: 'INFO',
                message: `Import confirmed by user. Created ${totalBatches} processing batches in background queue.`,
            },
        });
        logger_1.csvLogger.info(`Import ${importId} confirmed. Queued ${totalBatches} batches.`);
        return res.json({
            success: true,
            message: 'Processing started in background queue',
            totalBatches,
        });
    }
    catch (err) {
        logger_1.errorLogger.error('Confirm import failed', { error: err.message });
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// CSV Status JSON API
router.get('/status/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const importJob = await db_1.prisma.import.findUnique({
            where: { id: req.params.id },
            include: {
                _count: {
                    select: { queueItems: true },
                },
            },
        });
        if (!importJob) {
            return res.status(404).json({ error: 'Import job not found' });
        }
        const completedQueue = await db_1.prisma.processingQueue.count({
            where: { importId: req.params.id, status: 'COMPLETED' },
        });
        const failedQueue = await db_1.prisma.processingQueue.count({
            where: { importId: req.params.id, status: 'FAILED' },
        });
        const processingQueue = await db_1.prisma.processingQueue.count({
            where: { importId: req.params.id, status: 'PROCESSING' },
        });
        return res.json({
            id: importJob.id,
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
            batches: {
                total: importJob._count.queueItems,
                completed: completedQueue,
                failed: failedQueue,
                processing: processingQueue,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// SSE Streaming Status API
router.get('/status/:id/stream', (req, res) => {
    const importId = req.params.id;
    // Set SSE Headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.write('retry: 10000\n\n');
    logger_1.csvLogger.info(`Client connected to SSE progress stream for Import ${importId}`);
    queue_1.sseManager.add(importId, res);
    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'CONNECT', importId })}\n\n`);
    req.on('close', () => {
        logger_1.csvLogger.info(`Client disconnected from SSE progress stream for Import ${importId}`);
        queue_1.sseManager.remove(importId, res);
    });
});
// CSV Import History
router.get('/history', auth_1.authenticateToken, async (req, res) => {
    try {
        const imports = await db_1.prisma.import.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { name: true, email: true } },
            },
        });
        return res.json(imports);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// CSV Import Result Summary
router.get('/result/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const importJob = await db_1.prisma.import.findUnique({
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
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// Download Error CSV API
router.get('/download-errors/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const failedRows = await db_1.prisma.failedImport.findMany({
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
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// Download Processed Result CSV API
router.get('/download-result/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const leads = await db_1.prisma.lead.findMany({
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
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
exports.default = router;
