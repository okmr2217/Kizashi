import type { Context } from "hono";
import type { ZodError } from "zod";

export function zodErrorResponse(c: Context, error: ZodError) {
  return c.json(
    { error: "validation_error", details: error.flatten() },
    400
  );
}

export function notFound(c: Context, resource: string) {
  return c.json({ error: "not_found", message: `${resource} not found` }, 404);
}
