import winston from 'winston';
import path from 'path';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `[${timestamp}] ${level}: ${stack || message}`;
  })
);

const logsDir = path.resolve('logs');

export const createCategoryLogger = (category: string) => {
  return winston.createLogger({
    level: 'info',
    format: logFormat,
    defaultMeta: { category },
    transports: [
      new winston.transports.File({ 
        filename: path.join(logsDir, 'errors.log'), 
        level: 'error' 
      }),
      new winston.transports.File({ 
        filename: path.join(logsDir, `${category.toLowerCase()}.log`) 
      }),
      new winston.transports.Console({
        format: consoleFormat
      })
    ]
  });
};

export const apiLogger = createCategoryLogger('API');
export const errorLogger = createCategoryLogger('Errors');
export const authLogger = createCategoryLogger('Authentication');
export const aiLogger = createCategoryLogger('AI_Requests');
export const csvLogger = createCategoryLogger('CSV_Imports');
export const dbLogger = createCategoryLogger('Database');

export default {
  api: apiLogger,
  errors: errorLogger,
  auth: authLogger,
  ai: aiLogger,
  csv: csvLogger,
  db: dbLogger,
};
