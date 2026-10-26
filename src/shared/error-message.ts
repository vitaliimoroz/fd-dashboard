/** Readable message for a caught value; `fallback` is used when it is not an `Error`. */
export function errorMessage(error: unknown, fallback = String(error)): string {
  return error instanceof Error ? error.message : fallback;
}
