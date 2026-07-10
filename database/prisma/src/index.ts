import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

export * from '@prisma/client';

let prisma: PrismaClient;

import path from 'path';

let dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const dbToken = process.env.DATABASE_AUTH_TOKEN;

if (dbUrl.startsWith('file:')) {
  const relativePath = dbUrl.substring(5);
  const currentDir = typeof __dirname !== 'undefined' ? __dirname : '.';
  const dbDir = path.resolve(currentDir, '..'); // database/prisma
  const absoluteDbPath = path.resolve(dbDir, relativePath);
  dbUrl = `file:${absoluteDbPath}`;
}

if (process.env.NODE_ENV === 'test' || !dbUrl.startsWith('libsql://')) {
  // Standard SQLite client for testing or local development
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });
} else {
  // Turso LibSQL client
  const libsql = createClient({
    url: dbUrl,
    authToken: dbToken,
  });

  const adapter = new PrismaLibSQL(libsql);
  prisma = new PrismaClient({ adapter });
}

export { prisma };
export default prisma;
