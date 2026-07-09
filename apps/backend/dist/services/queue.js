"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueWorker = exports.sseManager = void 0;
const db_1 = require("@groweasy/db");
const logger_1 = require("../utils/logger");
const ai_1 = require("./ai");
const shared_1 = require("@groweasy/shared");
// SSE Connections Manager
class SSEManager {
    connections = new Map();
    add(importId, res) {
        if (!this.connections.has(importId)) {
            this.connections.set(importId, []);
        }
        this.connections.get(importId).push(res);
    }
    remove(importId, res) {
        const list = this.connections.get(importId);
        if (list) {
            this.connections.set(importId, list.filter(c => c !== res));
        }
    }
    send(importId, data) {
        const list = this.connections.get(importId);
        if (list) {
            list.forEach(res => {
                try {
                    res.write(`data: ${JSON.stringify(data)}\n\n`);
                }
                catch (err) {
                    // connection already closed
                }
            });
        }
    }
}
exports.sseManager = new SSEManager();
class QueueWorker {
    static isRunning = false;
    static timer = null;
    static start() {
        if (this.timer)
            return;
        logger_1.csvLogger.info('Queue Worker service started.');
        this.timer = setInterval(() => this.processNextBatch(), 3000);
    }
    static stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            logger_1.csvLogger.info('Queue Worker service stopped.');
        }
    }
    static async processNextBatch() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        try {
            // Find next pending batch in queue
            const queueItem = await db_1.prisma.processingQueue.findFirst({
                where: { status: 'PENDING' },
                orderBy: { createdAt: 'asc' },
                include: { import: { include: { csvFiles: true } } },
            });
            if (!queueItem) {
                this.isRunning = false;
                return;
            }
            await this.processQueueItem(queueItem);
        }
        catch (err) {
            logger_1.errorLogger.error('Queue Worker execution error', { error: err.message });
        }
        finally {
            this.isRunning = false;
        }
    }
    static async processQueueItem(queueItem) {
        const importId = queueItem.importId;
        const batchIndex = queueItem.batchIndex;
        logger_1.csvLogger.info(`Processing Batch ${batchIndex} for Import Job ${importId}`);
        try {
            // Mark as PROCESSING
            await db_1.prisma.processingQueue.update({
                where: { id: queueItem.id },
                data: { status: 'PROCESSING', updatedAt: new Date() },
            });
            // Update Import status if it was PENDING
            const importJob = await db_1.prisma.import.findUnique({ where: { id: importId } });
            if (importJob && importJob.status === 'PENDING') {
                await db_1.prisma.import.update({
                    where: { id: importId },
                    data: { status: 'PROCESSING', updatedAt: new Date() },
                });
            }
            // Stream initial progress update
            exports.sseManager.send(importId, {
                type: 'PROGRESS',
                status: 'PROCESSING',
                batchIndex,
                message: `Processing batch ${batchIndex + 1}...`,
            });
            // Parse payload
            const rawRecords = JSON.parse(queueItem.payload);
            const csvFile = queueItem.import.csvFiles[0];
            const headers = csvFile ? JSON.parse(csvFile.headers) : [];
            // Perform AI column mapping
            const mappingResult = await (0, ai_1.mapRecordsWithAI)(rawRecords, headers);
            if (!mappingResult.success) {
                throw new Error(mappingResult.error || 'AI Column mapping service failed');
            }
            let successCount = 0;
            let failedCount = 0;
            let skippedCount = 0;
            let duplicateCount = 0;
            for (let i = 0; i < rawRecords.length; i++) {
                const rawRow = rawRecords[i];
                const mappedRow = mappingResult.records[i];
                // Check skip rule explicitly if AI didn't do it
                const hasEmail = mappedRow?.email && String(mappedRow.email).trim().length > 0;
                const hasMobile = mappedRow?.mobile_without_country_code && String(mappedRow.mobile_without_country_code).trim().length > 0;
                if (!mappedRow || (!hasEmail && !hasMobile)) {
                    skippedCount++;
                    await db_1.prisma.failedImport.create({
                        data: {
                            importId,
                            rowIndex: batchIndex * 100 + i + 1,
                            rawRow: JSON.stringify(rawRow),
                            errorMessage: 'Skipped: No email AND no mobile phone number available in lead record',
                        },
                    });
                    continue;
                }
                // Validate mapped row schema
                const validation = shared_1.LeadValidationSchema.safeParse(mappedRow);
                if (!validation.success) {
                    failedCount++;
                    const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                    await db_1.prisma.failedImport.create({
                        data: {
                            importId,
                            rowIndex: batchIndex * 100 + i + 1,
                            rawRow: JSON.stringify(rawRow),
                            errorMessage: `Validation failed: ${errors}`,
                        },
                    });
                    continue;
                }
                const validData = validation.data;
                // Check for duplicates in current database (by Email or Mobile)
                const duplicateConditions = [];
                if (validData.email) {
                    duplicateConditions.push({ email: validData.email });
                }
                if (validData.mobile_without_country_code) {
                    duplicateConditions.push({ mobileWithoutCountryCode: validData.mobile_without_country_code });
                }
                let existingLead = null;
                if (duplicateConditions.length > 0) {
                    existingLead = await db_1.prisma.lead.findFirst({
                        where: {
                            OR: duplicateConditions,
                            deletedAt: null,
                        },
                    });
                }
                if (existingLead) {
                    duplicateCount++;
                    await db_1.prisma.duplicateLead.create({
                        data: {
                            importId,
                            leadId: existingLead.id,
                            rowIndex: batchIndex * 100 + i + 1,
                            rawRow: JSON.stringify(rawRow),
                        },
                    });
                    continue;
                }
                // Insert lead record
                await db_1.prisma.lead.create({
                    data: {
                        importId,
                        name: validData.name,
                        email: validData.email || '',
                        countryCode: validData.country_code,
                        mobileWithoutCountryCode: validData.mobile_without_country_code,
                        company: validData.company,
                        city: validData.city,
                        state: validData.state,
                        country: validData.country,
                        leadOwner: validData.lead_owner,
                        crmStatus: validData.crm_status,
                        crmNote: validData.crm_note,
                        dataSource: validData.data_source,
                        possessionTime: validData.possession_time,
                        description: validData.description,
                        rawData: JSON.stringify(rawRow),
                    },
                });
                successCount++;
            }
            // Update Processing Queue Item as COMPLETED
            await db_1.prisma.processingQueue.update({
                where: { id: queueItem.id },
                data: { status: 'COMPLETED', updatedAt: new Date() },
            });
            // Update Import statistics atomically
            await db_1.prisma.import.update({
                where: { id: importId },
                data: {
                    processedRows: { increment: rawRecords.length },
                    successfulRows: { increment: successCount },
                    failedRows: { increment: failedCount },
                    skippedRows: { increment: skippedCount },
                    duplicateRows: { increment: duplicateCount },
                    updatedAt: new Date(),
                },
            });
            // Check if all queue items for this import are finished
            const remainingItems = await db_1.prisma.processingQueue.count({
                where: { importId, status: { in: ['PENDING', 'PROCESSING'] } },
            });
            const updatedJob = await db_1.prisma.import.findUnique({
                where: { id: importId },
            });
            if (remainingItems === 0 && updatedJob) {
                // Complete the Import Job
                await db_1.prisma.import.update({
                    where: { id: importId },
                    data: { status: 'COMPLETED', updatedAt: new Date() },
                });
                await db_1.prisma.importLog.create({
                    data: {
                        importId,
                        level: 'INFO',
                        message: `Import job completed. Processed: ${updatedJob.processedRows}, Success: ${updatedJob.successfulRows}, Duplicates: ${updatedJob.duplicateRows}, Failed: ${updatedJob.failedRows}, Skipped: ${updatedJob.skippedRows}`,
                    },
                });
                // Notify client via SSE
                exports.sseManager.send(importId, {
                    type: 'COMPLETE',
                    status: 'COMPLETED',
                    summary: {
                        total: updatedJob.totalRows,
                        processed: updatedJob.processedRows,
                        successful: updatedJob.successfulRows,
                        failed: updatedJob.failedRows,
                        skipped: updatedJob.skippedRows,
                        duplicate: updatedJob.duplicateRows,
                    },
                });
            }
            else if (updatedJob) {
                // Stream intermediate stats update
                exports.sseManager.send(importId, {
                    type: 'PROGRESS',
                    status: 'PROCESSING',
                    processed: updatedJob.processedRows,
                    total: updatedJob.totalRows,
                });
            }
        }
        catch (err) {
            logger_1.csvLogger.error(`Error in processing batch ${batchIndex} for Import ${importId}`, { error: err.message });
            const attempts = queueItem.attempts + 1;
            const status = attempts >= 3 ? 'FAILED' : 'PENDING'; // Retry up to 3 times
            await db_1.prisma.processingQueue.update({
                where: { id: queueItem.id },
                data: {
                    status,
                    attempts,
                    errorMessage: err.message,
                    updatedAt: new Date(),
                },
            });
            if (status === 'FAILED') {
                await db_1.prisma.importLog.create({
                    data: {
                        importId,
                        level: 'ERROR',
                        message: `Batch ${batchIndex} failed permanently after 3 attempts: ${err.message}`,
                    },
                });
            }
            // Send error update via SSE
            exports.sseManager.send(importId, {
                type: 'ERROR',
                batchIndex,
                errorMessage: err.message,
            });
            // Update Import table if permanently failed
            const remainingItems = await db_1.prisma.processingQueue.count({
                where: { importId, status: { in: ['PENDING', 'PROCESSING'] } },
            });
            if (remainingItems === 0) {
                const failedBatches = await db_1.prisma.processingQueue.count({
                    where: { importId, status: 'FAILED' },
                });
                await db_1.prisma.import.update({
                    where: { id: importId },
                    data: {
                        status: failedBatches > 0 ? 'FAILED' : 'COMPLETED',
                        errorMessage: failedBatches > 0 ? 'Some batches failed to process' : null,
                        updatedAt: new Date(),
                    },
                });
            }
        }
    }
}
exports.QueueWorker = QueueWorker;
