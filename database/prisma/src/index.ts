import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

export * from '@prisma/client';

let prisma: PrismaClient;

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const dbToken = process.env.DATABASE_AUTH_TOKEN;

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
