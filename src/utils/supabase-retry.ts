/**
 * Ejecuta una consulta de Supabase con reintento automático si se detecta desfase de reloj (clock skew).
 * Maneja el error PGRST303: "JWT issued at future" esperando a que el tiempo del servidor se sincronice.
 */
export async function withClockSkewRetry<T extends { data: any; error: any }>(
  queryFn: () => PromiseLike<T>,
  maxRetries: number = 2,
  delayMs: number = 1200
): Promise<T> {
  let attempt = 0;

  while (attempt <= maxRetries) {
    const result = await queryFn();

    const isClockSkew =
      result.error &&
      (typeof result.error.message === 'string' &&
        (result.error.message.includes('future') ||
          result.error.message.includes('JWT issued at future') ||
          (result.error as any).code === 'PGRST303'));

    if (isClockSkew && attempt < maxRetries) {
      attempt++;
      console.warn(
        `[Supabase] Desfase de reloj detectado (JWT issued at future). Reintentando en ${delayMs}ms (intento ${attempt}/${maxRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    return result;
  }

  return await queryFn();
}
