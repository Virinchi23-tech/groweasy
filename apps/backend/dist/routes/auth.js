"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("@groweasy/db");
const shared_1 = require("@groweasy/shared");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const generateTokens = (user) => {
    const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_for_groweasy_crm_123456';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'super_secret_jwt_refresh_key_for_groweasy_crm_789012';
    const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role.name, name: user.name }, jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, jwtRefreshSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });
    return { accessToken, refreshToken };
};
router.post('/register', async (req, res) => {
    try {
        const parse = shared_1.RegisterSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: 'Validation failed', details: parse.error.format() });
        }
        const { email, password, name, role } = parse.data;
        // Check if user already exists
        const existing = await db_1.prisma.user.findFirst({ where: { email, deletedAt: null } });
        if (existing) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        // Hash password
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        // Find role
        const dbRole = await db_1.prisma.role.findFirst({ where: { name: role } });
        if (!dbRole) {
            return res.status(400).json({ error: `Invalid role: ${role}` });
        }
        // Create User
        const user = await db_1.prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                roleId: dbRole.id,
            },
            include: {
                role: true,
            },
        });
        logger_1.authLogger.info(`User registered: ${user.email}`);
        const { accessToken, refreshToken } = generateTokens(user);
        // Save refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
        await db_1.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt,
            },
        });
        return res.status(201).json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role.name,
            },
        });
    }
    catch (err) {
        logger_1.authLogger.error('Registration failed', { error: err.message });
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const parse = shared_1.LoginSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: 'Validation failed', details: parse.error.format() });
        }
        const { email, password } = parse.data;
        // Find User
        const user = await db_1.prisma.user.findFirst({
            where: { email, deletedAt: null },
            include: { role: true },
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Verify Password
        const isValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        logger_1.authLogger.info(`User logged in: ${user.email}`);
        const { accessToken, refreshToken } = generateTokens(user);
        // Save refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
        await db_1.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt,
            },
        });
        return res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role.name,
            },
        });
    }
    catch (err) {
        logger_1.authLogger.error('Login failed', { error: err.message });
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }
    try {
        const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'super_secret_jwt_refresh_key_for_groweasy_crm_789012';
        // Verify refresh token
        const decoded = jsonwebtoken_1.default.verify(refreshToken, jwtRefreshSecret);
        // Check refresh token in database
        const dbToken = await db_1.prisma.refreshToken.findFirst({
            where: {
                token: refreshToken,
                userId: decoded.userId,
                expiresAt: { gt: new Date() },
            },
            include: {
                user: {
                    include: { role: true },
                },
            },
        });
        if (!dbToken || dbToken.user.deletedAt !== null) {
            return res.status(403).json({ error: 'Invalid or expired refresh token' });
        }
        // Revoke old refresh token
        await db_1.prisma.refreshToken.delete({ where: { id: dbToken.id } });
        // Generate new tokens
        const tokens = generateTokens(dbToken.user);
        // Save new refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await db_1.prisma.refreshToken.create({
            data: {
                token: tokens.refreshToken,
                userId: dbToken.user.id,
                expiresAt,
            },
        });
        logger_1.authLogger.info(`Token refreshed for: ${dbToken.user.email}`);
        return res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    }
    catch (err) {
        logger_1.authLogger.error('Token refresh failed', { error: err.message });
        return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }
});
router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        try {
            await db_1.prisma.refreshToken.deleteMany({
                where: { token: refreshToken },
            });
            logger_1.authLogger.info('User logged out.');
        }
        catch (err) {
            // Ignored
        }
    }
    return res.json({ success: true, message: 'Logged out successfully' });
});
exports.default = router;
