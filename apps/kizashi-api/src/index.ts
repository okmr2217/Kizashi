import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import authRoutes from "./routes/auth";
import threadsAccountsRoutes from "./routes/threadsAccounts";
import groupsRoutes from "./routes/groups";
import projectsRoutes from "./routes/projects";
import draftsRoutes from "./routes/drafts";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const middleware = cors({
    origin: c.env.FRONTEND_ORIGIN,
    credentials: true,
  });
  return middleware(c, next);
});

app.get("/", (c) => c.text("kizashi-api: ok"));

app.route("/auth", authRoutes);
app.route("/threads-accounts", threadsAccountsRoutes);
app.route("/groups", groupsRoutes);
app.route("/projects", projectsRoutes);
app.route("/drafts", draftsRoutes);

export default app;
