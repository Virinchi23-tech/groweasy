"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// On CommonJS builds, __dirname is globally available.
const currentDir = typeof __dirname !== 'undefined' ? __dirname : '.';
dotenv_1.default.config({ path: path_1.default.resolve(currentDir, '../../../.env') });
async function main() {
    console.log('Seeding database...');
    // Create Roles
    const adminRole = await index_1.prisma.role.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: { name: 'ADMIN' },
    });
    const userRole = await index_1.prisma.role.upsert({
        where: { name: 'USER' },
        update: {},
        create: { name: 'USER' },
    });
    console.log('Roles seeded:', adminRole.name, userRole.name);
    // Create Default Admin User
    const adminEmail = 'admin@groweasy.com';
    const adminPasswordHash = await bcryptjs_1.default.hash('admin123', 10);
    const adminUser = await index_1.prisma.user.upsert({
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
    const userPasswordHash = await bcryptjs_1.default.hash('user123', 10);
    const regularUser = await index_1.prisma.user.upsert({
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
    await index_1.prisma.$disconnect();
});
