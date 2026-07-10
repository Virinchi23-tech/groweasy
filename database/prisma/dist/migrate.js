"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@libsql/client");
const dotenv_1 = __importDefault(require("dotenv"));
// Load env files
// On CommonJS builds, __dirname is globally available.
const currentDir = typeof __dirname !== 'undefined' ? __dirname : '.';
dotenv_1.default.config({ path: path_1.default.resolve(currentDir, '../../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(currentDir, '../../apps/backend/.env') });
const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const dbToken = process.env.DATABASE_AUTH_TOKEN;
let resolvedUrl = dbUrl;
if (dbUrl.startsWith('file:')) {
    const relativePath = dbUrl.substring(5);
    const dbDir = path_1.default.resolve(currentDir, '..'); // database/prisma
    const absoluteDbPath = path_1.default.resolve(dbDir, relativePath);
    resolvedUrl = `file:${absoluteDbPath}`;
}
async function run() {
    console.log('Migrating database:', resolvedUrl);
    const client = (0, client_1.createClient)({
        url: resolvedUrl,
        authToken: dbToken,
    });
    const sqlPath = path_1.default.resolve(currentDir, '../schema.sql');
    if (!fs_1.default.existsSync(sqlPath)) {
        console.error('SQL schema file not found at:', sqlPath);
        process.exit(1);
    }
    const sql = fs_1.default.readFileSync(sqlPath, 'utf8');
    // Split statements by semicolon
    const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    console.log(`Found ${statements.length} SQL statements to execute.`);
    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        // Skip comments
        if (stmt.startsWith('--') && !stmt.includes('\n')) {
            continue;
        }
        try {
            await client.execute(stmt);
        }
        catch (err) {
            // Gracefully handle existing tables or indexes
            if (err.message?.includes('already exists') ||
                err.message?.includes('duplicate column name')) {
                // Skip
            }
            else {
                console.error(`Error executing statement ${i + 1}:\n${stmt}\n`, err);
                process.exit(1);
            }
        }
    }
    console.log('Database migration completed successfully.');
    client.close();
}
run().catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
});
