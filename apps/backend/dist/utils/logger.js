"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbLogger = exports.csvLogger = exports.aiLogger = exports.authLogger = exports.errorLogger = exports.apiLogger = exports.createCategoryLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp, stack }) => {
    return `[${timestamp}] ${level}: ${stack || message}`;
}));
const logsDir = path_1.default.resolve('logs');
const createCategoryLogger = (category) => {
    return winston_1.default.createLogger({
        level: 'info',
        format: logFormat,
        defaultMeta: { category },
        transports: [
            new winston_1.default.transports.File({
                filename: path_1.default.join(logsDir, 'errors.log'),
                level: 'error'
            }),
            new winston_1.default.transports.File({
                filename: path_1.default.join(logsDir, `${category.toLowerCase()}.log`)
            }),
            new winston_1.default.transports.Console({
                format: consoleFormat
            })
        ]
    });
};
exports.createCategoryLogger = createCategoryLogger;
exports.apiLogger = (0, exports.createCategoryLogger)('API');
exports.errorLogger = (0, exports.createCategoryLogger)('Errors');
exports.authLogger = (0, exports.createCategoryLogger)('Authentication');
exports.aiLogger = (0, exports.createCategoryLogger)('AI_Requests');
exports.csvLogger = (0, exports.createCategoryLogger)('CSV_Imports');
exports.dbLogger = (0, exports.createCategoryLogger)('Database');
exports.default = {
    api: exports.apiLogger,
    errors: exports.errorLogger,
    auth: exports.authLogger,
    ai: exports.aiLogger,
    csv: exports.csvLogger,
    db: exports.dbLogger,
};
