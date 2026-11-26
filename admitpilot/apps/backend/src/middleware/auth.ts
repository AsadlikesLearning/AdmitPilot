import '../config/env.js';
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

// JWT_SECRET must be provided via environment variable - no fallback allowed
const JWT_SECRET_ENV = process.env.JWT_SECRET;

if (!JWT_SECRET_ENV) {
  throw new Error('JWT_SECRET environment variable is required for production. Set a strong secret key.');
}

// Validate secret strength in development
if (process.env.NODE_ENV !== 'production' && JWT_SECRET_ENV.length < 32) {
  console.warn('[AdmitPilot] WARNING: JWT_SECRET is less than 32 characters. This may not be secure for production.');
}

export const JWT_SECRET = JWT_SECRET_ENV;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ error: 'Authorization header missing' });
    return;
  }

  // Check for Bearer token format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ error: 'Invalid authorization header format. Expected: Bearer <token>' });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { organization_id?: string };

    if (!decoded.sub) {
      res.status(401).json({ error: 'Invalid token payload: missing user ID' });
      return;
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email || '',
      organizationId: decoded.organization_id,
    };

    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
