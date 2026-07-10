import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

// Compile-safe environment resolution
const currentDir = typeof __dirname !== 'undefined' ? __dirname : '.';
dotenv.config({ path: path.resolve(currentDir, '../../../.env') });

import authRoutes from './routes/auth';
import csvRoutes from './routes/csv';
import leadRoutes from './routes/leads';
import { apiLogger, errorLogger } from './utils/logger';
import { QueueWorker } from './services/queue';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: '*', // Allows access from Next.js local and deployed clients
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 2000 requests per windowMs
  message: { error: 'Too many requests, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Parsers with large limit support for batch uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  apiLogger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/csv', csvRoutes);
app.use('/api/leads', leadRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to GrowEasy CRM AI-Powered CSV Importer API' });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  errorLogger.error('Unhandled request error', {
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
  apiLogger.info(`Backend server running on port ${PORT}`);
  QueueWorker.start();
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  apiLogger.info('SIGTERM received. Shutting down gracefully...');
  QueueWorker.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  apiLogger.info('SIGINT received. Shutting down gracefully...');
  QueueWorker.stop();
  process.exit(0);
});
