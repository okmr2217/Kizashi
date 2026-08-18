import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, AppVariables } from "./types";
import { requireUser } from "./middleware/auth";
import { groupsRoute } from "./routes/groups";
import { projectsRoute } from "./routes/projects";
import { draftsRoute } from "./routes/drafts";
import { threadsAccountsRoute } from "./routes/threads-accounts";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", cors());
app.use("*", requireUser);

app.get("/", (c) => c.json({ name: "kizashi-api", status: "ok" }));

app.route("/groups", groupsRoute);
app.route("/projects", projectsRoute);
app.route("/drafts", draftsRoute);
app.route("/threads-accounts", threadsAccountsRoute);

export default app;
