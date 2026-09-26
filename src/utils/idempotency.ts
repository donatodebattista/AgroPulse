/**
 * Utilidades para generación de IDs idempotentes (RF-14, RNF-10).
 * Genera identificadores UUID v4 universales compatibles con PostgreSQL `uuid`.
 */

export function generateClientRequestId(): string {
  // 1. Si el runtime soporta crypto.randomUUID (Hermes moderno / Web)
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  // 2. Generador estándar RFC-4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
