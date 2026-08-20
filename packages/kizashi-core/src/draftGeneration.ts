import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { generateId } from "./ids";
import { createDraft, type DraftDb } from "./drafts";

const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";

export const DRAFT_GENERATION_JOB_STATUSES = ["processing", "completed", "failed"] as const;
export type DraftGenerationJobStatus = (typeof DRAFT_GENERATION_JOB_STATUSES)[number];

export interface DraftGenerationJob {
  id: string;
  user_id: string;
  group_id: string | null;
  project_id: string | null;
  prompt: string;
  status: DraftGenerationJobStatus;
  progress_message: string | null;
  draft_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const generateDraftInputSchema = z.object({
  group_id: z.string().min(1).nullish(),
  project_id: z.string().min(1).nullish(),
  prompt: z.string().min(1, "prompt is required"),
});

export type GenerateDraftInput = z.infer<typeof generateDraftInputSchema>;

/**
 * Draft生成ジョブをprocessing状態で作成する。
 * 実際の生成処理（runDraftGeneration）はルート側で ctx.waitUntil() 経由で起動する想定。
 */
export async function createDraftGenerationJob(
  db: DraftDb,
  userId: string,
  input: GenerateDraftInput
): Promise<DraftGenerationJob> {
  const id = generateId("gjob");
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO draft_generation_jobs (
        id, user_id, group_id, project_id, prompt,
        status, progress_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      input.group_id ?? null,
      input.project_id ?? null,
      input.prompt,
      "生成ジョブを開始しました",
      now,
      now
    )
    .run();

  const job = await getDraftGenerationJob(db, userId, id);
  if (!job) {
    throw new Error("failed to load created draft generation job");
  }
  return job;
}

export async function getDraftGenerationJob(
  db: DraftDb,
  userId: string,
  jobId: string
): Promise<DraftGenerationJob | null> {
  return db
    .prepare(`SELECT * FROM draft_generation_jobs WHERE id = ? AND user_id = ?`)
    .bind(jobId, userId)
    .first<DraftGenerationJob>();
}

async function updateJobProgress(db: DraftDb, jobId: string, progressMessage: string): Promise<void> {
  await db
    .prepare(`UPDATE draft_generation_jobs SET progress_message = ?, updated_at = ? WHERE id = ?`)
    .bind(progressMessage, new Date().toISOString(), jobId)
    .run();
}

async function completeJob(db: DraftDb, jobId: string, draftId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE draft_generation_jobs SET status = 'completed', draft_id = ?, progress_message = ?, updated_at = ? WHERE id = ?`
    )
    .bind(draftId, "完了しました", new Date().toISOString(), jobId)
    .run();
}

async function failJob(db: DraftDb, jobId: string, errorMessage: string): Promise<void> {
  await db
    .prepare(
      `UPDATE draft_generation_jobs SET status = 'failed', error_message = ?, progress_message = ?, updated_at = ? WHERE id = ?`
    )
    .bind(errorMessage, "生成に失敗しました", new Date().toISOString(), jobId)
    .run();
}

interface RatingExamples {
  good: string[];
  bad: string[];
}

async function fetchRatingExamples(db: DraftDb, userId: string, groupId: string | null): Promise<RatingExamples> {
  if (!groupId) return { good: [], bad: [] };

  const good = await db
    .prepare(
      `SELECT content FROM drafts WHERE user_id = ? AND group_id = ? AND rating BETWEEN 4 AND 5
       ORDER BY created_at DESC LIMIT 5`
    )
    .bind(userId, groupId)
    .all<{ content: string }>();
  const bad = await db
    .prepare(
      `SELECT content FROM drafts WHERE user_id = ? AND group_id = ? AND rating BETWEEN 1 AND 2
       ORDER BY created_at DESC LIMIT 5`
    )
    .bind(userId, groupId)
    .all<{ content: string }>();

  return {
    good: good.results.map((r) => r.content),
    bad: bad.results.map((r) => r.content),
  };
}

interface ReferenceFile {
  title: string;
  content_markdown: string;
}

async function fetchReferenceFiles(db: DraftDb, projectId: string | null): Promise<ReferenceFile[]> {
  if (!projectId) return [];

  const { results } = await db
    .prepare(`SELECT title, content_markdown FROM project_files WHERE project_id = ? ORDER BY created_at DESC`)
    .bind(projectId)
    .all<ReferenceFile>();
  return results;
}

interface GroupEngagementStats {
  draftCount: number;
  avgRating: number | null;
  avgViews: number | null;
  avgLikes: number | null;
  avgReplies: number | null;
  avgReposts: number | null;
  avgQuotes: number | null;
}

async function fetchGroupStats(db: DraftDb, userId: string, groupId: string | null): Promise<GroupEngagementStats | null> {
  if (!groupId) return null;

  const row = await db
    .prepare(
      `SELECT COUNT(DISTINCT d.id) as draft_count,
              AVG(d.rating) as avg_rating,
              AVG(s.views) as avg_views,
              AVG(s.likes) as avg_likes,
              AVG(s.replies) as avg_replies,
              AVG(s.reposts) as avg_reposts,
              AVG(s.quotes) as avg_quotes
       FROM drafts d
       LEFT JOIN draft_engagement_snapshots s
         ON s.draft_id = d.id AND s.snapshot_stage = '7d' AND s.fetch_failed = 0
       WHERE d.user_id = ? AND d.group_id = ?`
    )
    .bind(userId, groupId)
    .first<{
      draft_count: number;
      avg_rating: number | null;
      avg_views: number | null;
      avg_likes: number | null;
      avg_replies: number | null;
      avg_reposts: number | null;
      avg_quotes: number | null;
    }>();

  if (!row || row.draft_count === 0) return null;

  return {
    draftCount: row.draft_count,
    avgRating: row.avg_rating,
    avgViews: row.avg_views,
    avgLikes: row.avg_likes,
    avgReplies: row.avg_replies,
    avgReposts: row.avg_reposts,
    avgQuotes: row.avg_quotes,
  };
}

interface GenerateDraftContentParams {
  apiKey: string;
  model?: string;
  prompt: string;
  examples: RatingExamples;
  referenceFiles: ReferenceFile[];
  groupStats: GroupEngagementStats | null;
}

function formatAvg(value: number | null): string {
  return value === null ? "データなし" : value.toFixed(1);
}

function buildUserMessage(params: GenerateDraftContentParams): string {
  const sections: string[] = [];

  if (params.examples.good.length > 0) {
    sections.push(
      `## 良い例（同グループで過去に高評価だったDraft）\n${params.examples.good
        .map((c, i) => `${i + 1}. ${c}`)
        .join("\n")}`
    );
  }
  if (params.examples.bad.length > 0) {
    sections.push(
      `## 避けるべき例（同グループで過去に低評価だったDraft）\n${params.examples.bad
        .map((c, i) => `${i + 1}. ${c}`)
        .join("\n")}`
    );
  }
  if (params.referenceFiles.length > 0) {
    sections.push(
      `## 参照ファイル\n${params.referenceFiles.map((f) => `### ${f.title}\n${f.content_markdown}`).join("\n\n")}`
    );
  }
  if (params.groupStats) {
    const s = params.groupStats;
    sections.push(
      `## グループの実績サマリー（投稿から7日後の確定値の平均、対象${s.draftCount}件）\n` +
        `平均評価: ${s.avgRating === null ? "データなし" : s.avgRating.toFixed(2)} / ` +
        `平均インプレッション: ${formatAvg(s.avgViews)} / ` +
        `平均いいね: ${formatAvg(s.avgLikes)} / ` +
        `平均リプライ: ${formatAvg(s.avgReplies)} / ` +
        `平均リポスト: ${formatAvg(s.avgReposts)} / ` +
        `平均引用: ${formatAvg(s.avgQuotes)}`
    );
  }

  sections.push(`## 指示\n${params.prompt}`);
  return sections.join("\n\n");
}

const AI_MEMO_SEPARATOR = "---AI_MEMO---";

export interface GeneratedDraftContent {
  content: string;
  aiMemo: string | null;
}

export async function generateDraftContent(params: GenerateDraftContentParams): Promise<GeneratedDraftContent> {
  const client = new Anthropic({ apiKey: params.apiKey });

  const response = await client.messages.create({
    model: params.model || DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 2048,
    system:
      "あなたはThreadsアカウント運用担当者向けの投稿文生成アシスタントです。" +
      "与えられた良い例・避けるべき例・参照ファイル・実績サマリーを踏まえ、指示に沿ったThreads投稿本文を1件だけ生成してください。" +
      "出力は投稿本文のみとし、前置き・説明・引用符・Markdownのコードブロックは一切含めないでください。" +
      `続けて、生成理由・狙い・参考にした過去Draft等をユーザー向けに書き残したい場合は、本文の直後に区切り行 "${AI_MEMO_SEPARATOR}" を1行だけ置き、` +
      "その後にメモを書いてください（不要なら区切り行・メモとも書かないでください）。",
    messages: [{ role: "user", content: buildUserMessage(params) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`LLM refused to generate content (category: ${response.stop_details?.category ?? "unknown"})`);
  }

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  if (!textBlock) {
    throw new Error("LLM did not return text content");
  }

  const [rawContent, rawAiMemo] = textBlock.text.split(AI_MEMO_SEPARATOR);
  const content = rawContent.trim();
  if (!content) {
    throw new Error("LLM returned empty content");
  }
  const aiMemo = rawAiMemo?.trim() || null;
  return { content, aiMemo };
}

export interface DraftGenerationDeps {
  db: DraftDb;
  anthropicApiKey: string;
  anthropicModel?: string;
}

/**
 * Draft生成ジョブのオーケストレーション。
 * POST /drafts/generate のハンドラから ctx.waitUntil() 経由で呼び出され、
 * レスポンス返却後もWorkerインスタンス内で実行が継続される。
 * 各ステップごとに draft_generation_jobs.progress_message を更新し、ポーリング側に進捗を返す。
 */
export async function runDraftGeneration(
  deps: DraftGenerationDeps,
  jobId: string,
  userId: string,
  input: GenerateDraftInput
): Promise<void> {
  const { db, anthropicApiKey, anthropicModel } = deps;

  try {
    await updateJobProgress(db, jobId, "参考Draftを検索中");
    const examples = await fetchRatingExamples(db, userId, input.group_id ?? null);

    await updateJobProgress(db, jobId, "参照ファイルを読み込み中");
    const referenceFiles = await fetchReferenceFiles(db, input.project_id ?? null);

    await updateJobProgress(db, jobId, "実績サマリーを集計中");
    const groupStats = await fetchGroupStats(db, userId, input.group_id ?? null);

    await updateJobProgress(db, jobId, "AIが生成中");
    const { content, aiMemo } = await generateDraftContent({
      apiKey: anthropicApiKey,
      model: anthropicModel,
      prompt: input.prompt,
      examples,
      referenceFiles,
      groupStats,
    });

    const draft = await createDraft(db, userId, {
      group_id: input.group_id ?? null,
      project_id: input.project_id ?? null,
      content,
      ai_memo: aiMemo,
    });

    await completeJob(db, jobId, draft.id);
  } catch (err) {
    await failJob(db, jobId, err instanceof Error ? err.message : String(err));
  }
}
