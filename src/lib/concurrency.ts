// Concurrencia acotada para los crones: varias personas a la vez sin saturar la base ni los proveedores.

/** Corre `fn` sobre cada elemento con como máximo `limit` a la vez (mínimo 1). El orden de término no está garantizado. */
export async function forEachLimit<T>(items: T[], limit: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; await fn(items[i]); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
}
