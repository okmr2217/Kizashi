import type { Env } from "../env";
import { publishScheduledDraftsJob } from "./publishScheduledDrafts";
import { reconcileParentCompletionJob } from "./reconcileParentCompletion";
import { refreshExpiringTokensJob } from "./refreshExpiringTokens";
import { fetchEngagementSnapshotsJob } from "./fetchEngagementSnapshots";

export const CRON_PUBLISH_SCHEDULED_DRAFTS = "*/1 * * * *";
export const CRON_RECONCILE_PARENT_COMPLETION = "*/5 * * * *";
export const CRON_REFRESH_EXPIRING_TOKENS = "0 */6 * * *";
export const CRON_FETCH_ENGAGEMENT_SNAPSHOTS = "*/15 * * * *";

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  switch (event.cron) {
    case CRON_PUBLISH_SCHEDULED_DRAFTS:
      ctx.waitUntil(publishScheduledDraftsJob(env));
      break;
    case CRON_RECONCILE_PARENT_COMPLETION:
      ctx.waitUntil(reconcileParentCompletionJob(env));
      break;
    case CRON_REFRESH_EXPIRING_TOKENS:
      ctx.waitUntil(refreshExpiringTokensJob(env));
      break;
    case CRON_FETCH_ENGAGEMENT_SNAPSHOTS:
      ctx.waitUntil(fetchEngagementSnapshotsJob(env));
      break;
    default:
      console.error(`unknown cron trigger: ${event.cron}`);
  }
}
