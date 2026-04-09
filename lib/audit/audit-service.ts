import { AuditLog, AuditAction } from '../types/core';

/**
 * Servicio de Auditoría modular para PropSys.
 * Registra acciones operativas de forma ineditable (simulado).
 */
export class AuditService {
  private static instance: AuditService;
  private logs: AuditLog[] = [];

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Registra una nueva entrada en el log de auditoría.
   */
  public logAction(params: {
    userId: string;
    clientId?: string | null;
    action: AuditAction;
    entity: string;
    entityId: string;
    oldData?: unknown;
    newData?: unknown;
    metadata?: Record<string, unknown>;
  }): void {
    const newLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId: params.userId,
      clientId: params.clientId || null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      payload: {
        oldData: params.oldData,
        newData: params.newData,
        metadata: params.metadata,
      },
    };

    // En un sistema real, esto iría a una base de datos ineditable
    this.logs.push(newLog);
    
    // Logging en consola para desarrollo/auditoría rápida
    console.log(`[AUDIT] ${newLog.action} on ${newLog.entity} (${newLog.entityId}) by User ${newLog.userId}`);
  }

  public getLogsByClient(clientId: string): AuditLog[] {
    return this.logs.filter(log => log.clientId === clientId);
  }

  public getAllLogs(): AuditLog[] {
    return [...this.logs];
  }
}

export const auditService = AuditService.getInstance();
