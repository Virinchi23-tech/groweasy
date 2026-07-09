"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Compile-safe environment resolution
const currentDir = typeof __dirname !== 'undefined' ? __dirname : '.';
dotenv_1.default.config({ path: path_1.default.resolve(currentDir, '../../../.env') });
const auth_1 = __importDefault(require("./routes/auth"));
const csv_1 = __importDefault(require("./routes/csv"));
const leads_1 = __importDefault(require("./routes/leads"));
const logger_1 = require("./utils/logger");
const queue_1 = require("./services/queue");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Security Middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*', // Allows access from Next.js local and deployed clients
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Rate Limiter
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Limit each IP to 2000 requests per windowMs
    message: { error: 'Too many requests, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);
// Parsers with large limit support for batch uploads
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Request logging middleware
app.use((req, res, next) => {
    logger_1.apiLogger.info(`${req.method} ${req.url}`, {
        ip: req.ip,
    });
    next();
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/csv', csv_1.default);
app.use('/api/leads', leads_1.default);
// Base route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to GrowEasy CRM AI-Powered CSV Importer API' });
});
// Global Error Handler
app.use((err, req, res, next) => {
    logger_1.errorLogger.error('Unhandled request error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
    });
    return res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
    });
});
// Start server & background queue worker
app.listen(PORT, () => {
    logger_1.apiLogger.info(`Backend server running on port ${PORT}`);
    queue_1.QueueWorker.start();
});
// Graceful Shutdown
process.on('SIGTERM', () => {
    logger_1.apiLogger.info('SIGTERM received. Shutting down gracefully...');
    queue_1.QueueWorker.stop();
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.apiLogger.info('SIGINT received. Shutting down gracefully...');
    queue_1.QueueWorker.stop();
    process.exit(0);
});
