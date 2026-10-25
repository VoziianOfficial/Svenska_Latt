// deno-lint-ignore no-explicit-any
export function withSupabase(_options: unknown, handler: (req: Request, ctx: any) => Promise<Response>) {
  return handler;
}
