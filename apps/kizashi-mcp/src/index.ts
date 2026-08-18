export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response("kizashi-mcp: ok", { status: 200 });
  },
};
