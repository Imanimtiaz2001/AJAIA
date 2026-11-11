import { z } from 'zod';
import { Errors } from './errors';

/** Parses untrusted input or throws a 400 with field-level details. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw Errors.validation(
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}

/** Route ids are UUIDs; anything else cannot exist, so it is a 404 rather than a 400. */
export function parseId(value: unknown, what = 'Document'): string {
  const result = z.uuid().safeParse(value);
  if (!result.success) throw Errors.notFound(what);
  return result.data;
}

export const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
