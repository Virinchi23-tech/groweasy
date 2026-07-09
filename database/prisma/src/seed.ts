import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// On CommonJS builds, __dirname is globally available.
const currentDir = typeof __dirname !== 'undefined' ? __dirname : '.';
dotenv.config({ path: path.resolve(currentDir, '../../../.env') });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db',
    },
  },
});


async function main() {
  console.log('Seeding database...');

  // Create Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: { name: 'USER' },
  });

  console.log('Roles seeded:', adminRole.name, userRole.name);

  // Create Default Admin User
  const adminEmail = 'admin@groweasy.com';
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'GrowEasy Admin',
      passwordHash: adminPasswordHash,
      roleId: adminRole.id,
    },
  });

  console.log('Default Admin seeded:', adminUser.email);

  // Create Default Regular User
  const userEmail = 'user@groweasy.com';
  const userPasswordHash = await bcrypt.hash('user123', 10);

  const regularUser = await prisma.user.upsert({
    where: { email: userEmail },
    update: {},
    create: {
      email: userEmail,
      name: 'GrowEasy User',
      passwordHash: userPasswordHash,
      roleId: userRole.id,
    },
  });

  console.log('Default User seeded:', regularUser.email);

  console.log('Database seeding completed.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
