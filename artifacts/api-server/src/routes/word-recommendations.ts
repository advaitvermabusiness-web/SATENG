import { getAuth } from "@clerk/express";
import { and, count, desc, eq, max } from "drizzle-orm";
import { db, wordRecommendationTable } from "@workspace/db";
import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();

const DISCOVERY_FIELDS = [
  "Economics",
  "Science",
  "Politics & Society",
  "Literature & Arts",
  "Psychology",
  "Personality & Human Behavior",
  "Medicine & Healthcare",
  "Technology",
  "Everyday Communication",
  "SAT Vocabulary",
  "Expert Vocabulary",
] as const;

const UNSAFE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const WORD_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NOTIFICATION_THRESHOLDS = new Set([5, 10, 25, 50, 100]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const expected = new Set(keys);
  return Object.keys(value).length === keys.length &&
    Object.keys(value).every(key => expected.has(key));
}

function text(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim().replace(/\s+/g, " ");
  return normalized &&
    normalized.length <= maximum &&
    !UNSAFE_CONTROL_CHARACTERS.test(normalized)
    ? normalized
    : null;
}

function authenticatedUserId(req: Request) {
  return getAuth(req).userId ?? null;
}

router.get("/discover/recommendations", async (req, res, next): Promise<void> => {
  try {
    const userId = authenticatedUserId(req);
    const summaries = await db
      .select({
        wordKey: wordRecommendationTable.wordKey,
        word: wordRecommendationTable.word,
        field: wordRecommendationTable.field,
        count: count(),
        updatedAt: max(wordRecommendationTable.updatedAt),
      })
      .from(wordRecommendationTable)
      .groupBy(
        wordRecommendationTable.wordKey,
        wordRecommendationTable.word,
        wordRecommendationTable.field,
      )
      .orderBy(desc(count()))
      .limit(200);

    const recommendedByMe = userId
      ? new Set(
          (
            await db
              .select({ wordKey: wordRecommendationTable.wordKey })
              .from(wordRecommendationTable)
              .where(eq(wordRecommendationTable.userId, userId))
          ).map(item => item.wordKey),
        )
      : new Set<string>();

    res.set("Cache-Control", "no-store").json({
      recommendations: summaries.map(item => ({
        wordKey: item.wordKey,
        word: item.word,
        field: item.field,
        count: Number(item.count),
        recommendedByMe: recommendedByMe.has(item.wordKey),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/discover/recommendations", async (req, res, next): Promise<void> => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to recommend a word." });
      return;
    }
    if (
      !isRecord(req.body) ||
      !hasExactlyKeys(req.body, ["wordKey", "word", "field", "source"])
    ) {
      res.status(400).json({ error: "The recommendation request is malformed." });
      return;
    }

    const wordKey = text(req.body.wordKey, 120);
    const word = text(req.body.word, 80);
    const field = text(req.body.field, 80);
    const source = text(req.body.source, 20);
    if (
      !wordKey ||
      !WORD_KEY_PATTERN.test(wordKey) ||
      !word ||
      !field ||
      !DISCOVERY_FIELDS.includes(field as (typeof DISCOVERY_FIELDS)[number]) ||
      (source !== "library" && source !== "search")
    ) {
      res.status(400).json({ error: "Choose a valid word and discovery field." });
      return;
    }

    const updatedAt = new Date();
    await db
      .insert(wordRecommendationTable)
      .values({ userId, wordKey, word, field, source, updatedAt })
      .onConflictDoUpdate({
        target: [wordRecommendationTable.userId, wordRecommendationTable.wordKey],
        set: { word, field, source, updatedAt },
      });

    const [aggregate] = await db
      .select({ count: count() })
      .from(wordRecommendationTable)
      .where(and(
        eq(wordRecommendationTable.wordKey, wordKey),
        eq(wordRecommendationTable.field, field),
      ));
    const recommendationCount = Number(aggregate?.count ?? 1);

    if (NOTIFICATION_THRESHOLDS.has(recommendationCount)) {
      req.log.info(
        { wordKey, word, field, recommendationCount },
        "Word recommendation reached a developer-review threshold",
      );
    }

    res.set("Cache-Control", "no-store").json({
      recommendation: {
        wordKey,
        word,
        field,
        count: recommendationCount,
        recommendedByMe: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;