import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authLogger } from '../utils/logger';
import { prisma } from '@groweasy/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    authLogger.warn('Access denied: No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_for_groweasy_crm_123456';
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      email: string;
      role: string;
      name: string;
    };

    // Verify user exists and is not soft deleted
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        deletedAt: null,
      },
      include: {
        role: true,
      },
    });

    if (!user) {
      authLogger.warn('Authentication failed: User not found or deactivated', { userId: decoded.userId });
      return res.status(403).json({ error: 'User does not exist or has been deactivated' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      name: user.name,
    };

    next();
  } catch (err: any) {
    authLogger.error('Token verification error', { error: err.message });
    return res.status(403).json({ error: 'Invalid or expired access token' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      authLogger.warn('Access forbidden: Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });
      return res.status(403).json({ error: 'Access forbidden: Insufficient permissions' });
    }

    next();
  };
};
