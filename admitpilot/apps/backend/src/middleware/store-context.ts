import { Request, Response, NextFunction } from 'express';
import { InMemoryStore } from '../db/store.js';
import { AuthRequest } from './auth.js';

export interface StoreContextRequest extends AuthRequest {
  store: InMemoryStore;
}

/**
 * Middleware that sets the store context from the authenticated user's organization_id
 */
export function setStoreContext(req: StoreContextRequest, res: Response, next: NextFunction): void {
  const organizationId = req.user?.organizationId;
  
  if (organizationId) {
    req.store.setContext({ organizationId });
    next();
  } else {
    res.status(403).json({ 
      error: 'Organization ID required in JWT token for multi-tenant isolation',
      hint: 'The JWT token must include organization_id to determine tenant context'
    });
  }
}
