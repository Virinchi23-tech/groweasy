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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("@libsql/client");
const adapter_libsql_1 = require("@prisma/adapter-libsql");
__exportStar(require("@prisma/client"), exports);
let prisma;
const path_1 = __importDefault(require("path"));
let dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const dbToken = process.env.DATABASE_AUTH_TOKEN;
if (dbUrl.startsWith('file:')) {
    const relativePath = dbUrl.substring(5);
    const currentDir = typeof __dirname !== 'undefined' ? __dirname : '.';
    const dbDir = path_1.default.resolve(currentDir, '..'); // database/prisma
    const absoluteDbPath = path_1.default.resolve(dbDir, relativePath);
    dbUrl = `file:${absoluteDbPath}`;
}
if (process.env.NODE_ENV === 'test' || !dbUrl.startsWith('libsql://')) {
    // Standard SQLite client for testing or local development
    exports.prisma = prisma = new client_1.PrismaClient({
        datasources: {
            db: {
                url: dbUrl,
            },
        },
    });
}
else {
    // Turso LibSQL client
    const libsql = (0, client_2.createClient)({
        url: dbUrl,
        authToken: dbToken,
    });
    const adapter = new adapter_libsql_1.PrismaLibSQL(libsql);
    exports.prisma = prisma = new client_1.PrismaClient({ adapter });
}
exports.default = prisma;
