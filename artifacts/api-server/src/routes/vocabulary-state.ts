import { getAuth } from "@clerk/express";
import { db, vocabularyUserStateTable, type VocabularyStateData } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();
const MAX_PROGRESS_ITEMS = 500;
const MAX_SESSION_ITEMS = 100;
const MAX_BOOKMARKS = 500;
const MAX_DISCOVERY_ITEMS = 500;
const MAX_STATE_BYTES = 60 * 1024;
const SAT_PHASES = ["preview", "invent", "trace", "postmortem", "morphology", "intern"] as const;
const LEVELS = ["Foundational", "Advanced", "Challenge"] as const;
const UNSAFE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowedKeys = new Set(keys);
  return Object.keys(value).every(key => allowedKeys.has(key));
}

function hasKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.normalize("NFC").trim();
  return result &&
    result.length <= maxLength &&
    !UNSAFE_CONTROL_CHARACTERS.test(result)
    ? result
    : null;
}

function dateText(value: unknown): string | null {
  const result = text(value, 80);
  return result && Number.isFinite(Date.parse(result)) ? result : null;
}

function integer(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

function normalizeSettings(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const allowedKeys = [
    "level",
    "dailyGoal",
    "reminderEnabled",
    "satMode",
    "expertMode",
    "hasCompletedOnboarding",
    "paywallSeen",
    "quickWordsSeen",
    "satRecallPoints",
    "focusProfile",
    "confidenceLevel",
    "targetTiming",
  ];
  if (
    !hasOnlyKeys(value, allowedKeys) ||
    !hasKeys(value, ["level", "dailyGoal", "reminderEnabled"])
  ) return null;

  const level = LEVELS.includes(value.level as (typeof LEVELS)[number])
    ? value.level
    : null;
  const dailyGoal = integer(value.dailyGoal, 1, 100);
  if (
    !level ||
    dailyGoal === null ||
    typeof value.reminderEnabled !== "boolean"
  ) return null;

  const settings: Record<string, unknown> = {
    level,
    dailyGoal,
    reminderEnabled: value.reminderEnabled,
  };

  if ("satMode" in value) {
    if (typeof value.satMode !== "boolean") return null;
    settings.satMode = value.satMode;
  }
  if ("expertMode" in value) {
    if (typeof value.expertMode !== "boolean") return null;
    settings.expertMode = value.expertMode;
  }
  if ("hasCompletedOnboarding" in value) {
    if (typeof value.hasCompletedOnboarding !== "boolean") return null;
    settings.hasCompletedOnboarding = value.hasCompletedOnboarding;
  }
  if ("paywallSeen" in value) {
    if (typeof value.paywallSeen !== "boolean") return null;
    settings.paywallSeen = value.paywallSeen;
  }
  if ("quickWordsSeen" in value) {
    const quickWordsSeen = integer(value.quickWordsSeen, 0, 1_000_000);
    if (quickWordsSeen === null) return null;
    settings.quickWordsSeen = quickWordsSeen;
  }
  if ("satRecallPoints" in value) {
    const satRecallPoints = integer(value.satRecallPoints, 0, 1_000_000);
    if (satRecallPoints === null) return null;
    settings.satRecallPoints = satRecallPoints;
  }
  if ("focusProfile" in value) {
    if (!["Quick", "Standard", "Deep", null].includes(value.focusProfile as string | null)) {
      return null;
    }
    settings.focusProfile = value.focusProfile;
  }
  if ("confidenceLevel" in value) {
    const confidenceLevel = text(value.confidenceLevel, 80);
    if (!confidenceLevel) return null;
    settings.confidenceLevel = confidenceLevel;
  }
  if ("targetTiming" in value) {
    const targetTiming = text(value.targetTiming, 80);
    if (!targetTiming) return null;
    settings.targetTiming = targetTiming;
  }

  return settings;
}

function normalizeProgress(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || value.length > MAX_PROGRESS_ITEMS) return null;
  const items: unknown[] = [];

  for (const item of value) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, [
        "wordId",
        "status",
        "confidence",
        "correctCount",
        "seenCount",
        "lastSeen",
        "nextReview",
        "reviewIntervalDays",
      ]) ||
      !hasKeys(item, [
        "wordId",
        "status",
        "confidence",
        "correctCount",
        "seenCount",
        "lastSeen",
      ])
    ) return null;
    const wordId = text(item.wordId, 120);
    const status = ["new", "learning", "mastered"].includes(item.status as string)
      ? item.status
      : null;
    const confidence = integer(item.confidence, 0, 5);
    const correctCount = integer(item.correctCount, 0, 1_000_000);
    const seenCount = integer(item.seenCount, 0, 1_000_000);
    const lastSeen = dateText(item.lastSeen);
    if (!wordId || !status || confidence === null || correctCount === null || seenCount === null || !lastSeen) {
      return null;
    }

    const normalized: Record<string, unknown> = {
      wordId,
      status,
      confidence,
      correctCount,
      seenCount,
      lastSeen,
    };
    if ("nextReview" in item) {
      const nextReview = dateText(item.nextReview);
      if (!nextReview) return null;
      normalized.nextReview = nextReview;
    }
    if ("reviewIntervalDays" in item) {
      const reviewIntervalDays = integer(item.reviewIntervalDays, 0, 100_000);
      if (reviewIntervalDays === null) return null;
      normalized.reviewIntervalDays = reviewIntervalDays;
    }
    items.push(normalized);
  }

  return items;
}

function normalizePhaseCompletion(value: unknown): Record<string, boolean> | null {
  if (!isRecord(value) || !hasOnlyKeys(value, SAT_PHASES)) return null;

  let blocked = false;
  const result: Record<string, boolean> = {};
  for (const phase of SAT_PHASES) {
    if (!(phase in value)) {
      blocked = true;
      result[phase] = false;
      continue;
    }
    if (typeof value[phase] !== "boolean") return null;
    const requested = value[phase];
    if (blocked && requested) return null;
    result[phase] = requested;
    if (!requested) blocked = true;
  }
  return result;
}

function normalizeSessions(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || value.length > MAX_SESSION_ITEMS) return null;
  const items: unknown[] = [];

  for (const item of value) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, [
        "id",
        "date",
        "wordsReviewed",
        "quizScore",
        "duration",
        "kind",
        "mode",
        "level",
        "bankId",
        "questionCount",
        "wordIds",
        "phaseCompletion",
      ]) ||
      !hasKeys(item, ["id", "date", "wordsReviewed", "quizScore", "duration"])
    ) return null;
    const id = text(item.id, 160);
    const date = dateText(item.date);
    const wordsReviewed = integer(item.wordsReviewed, 0, 1_000);
    const quizScore = integer(item.quizScore, 0, 1_000);
    const duration = integer(item.duration, 0, 1_000_000);
    if (!id || !date || wordsReviewed === null || quizScore === null || duration === null) {
      return null;
    }

    const normalized: Record<string, unknown> = {
      id,
      date,
      wordsReviewed,
      quizScore,
      duration,
    };
    if ("kind" in item) {
      if (item.kind !== "lesson" && item.kind !== "quiz") return null;
      normalized.kind = item.kind;
    }
    if ("mode" in item) {
      if (item.mode !== "sat" && item.mode !== "everyday") return null;
      normalized.mode = item.mode;
    }
    if ("level" in item) {
      if (!LEVELS.includes(item.level as (typeof LEVELS)[number])) return null;
      normalized.level = item.level;
    }
    if ("bankId" in item) {
      const bankId = text(item.bankId, 80);
      if (!bankId) return null;
      normalized.bankId = bankId;
    }
    if ("questionCount" in item) {
      const questionCount = integer(item.questionCount, 0, 1_000);
      if (questionCount === null) return null;
      normalized.questionCount = questionCount;
    }
    if ("wordIds" in item) {
      if (!Array.isArray(item.wordIds) || item.wordIds.length > MAX_PROGRESS_ITEMS) return null;
      const wordIds = item.wordIds.map(wordId => text(wordId, 120));
      if (wordIds.some(wordId => !wordId)) return null;
      normalized.wordIds = [...new Set(wordIds as string[])];
    }
    if ("phaseCompletion" in item) {
      const phaseCompletion = normalizePhaseCompletion(item.phaseCompletion);
      if (!phaseCompletion) return null;
      normalized.phaseCompletion = phaseCompletion;
    }
    items.push(normalized);
  }

  return items;
}

function normalizeBookmarks(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_BOOKMARKS) return null;
  const bookmarks = value.map(item => text(item, 120));
  if (bookmarks.some(item => !item)) return null;
  return [...new Set(bookmarks as string[])];
}

function normalizeDiscoveryHistory(value: unknown): unknown[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_DISCOVERY_ITEMS) return null;
  const items: unknown[] = [];

  for (const item of value) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, [
        "wordId",
        "firstSeen",
        "lastSeen",
        "seenCount",
        "confidence",
        "nextReview",
        "note",
      ]) ||
      !hasKeys(item, [
        "wordId",
        "firstSeen",
        "lastSeen",
        "seenCount",
        "confidence",
        "nextReview",
      ])
    ) return null;
    const wordId = text(item.wordId, 120);
    const firstSeen = dateText(item.firstSeen);
    const lastSeen = dateText(item.lastSeen);
    const seenCount = integer(item.seenCount, 0, 1_000_000);
    const confidence = integer(item.confidence, 0, 5);
    const nextReview = dateText(item.nextReview);
    if (!wordId || !firstSeen || !lastSeen || seenCount === null || confidence === null || !nextReview) {
      return null;
    }

    const normalized: Record<string, unknown> = {
      wordId,
      firstSeen,
      lastSeen,
      seenCount,
      confidence,
      nextReview,
    };
    if ("note" in item) {
      const note = text(item.note, 300);
      if (!note) return null;
      normalized.note = note;
    }
    items.push(normalized);
  }

  return items;
}

function normalizeVocabularyState(value: unknown): VocabularyStateData | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "settings",
      "progress",
      "sessions",
      "bookmarks",
      "discoveryHistory",
    ]) ||
    !hasKeys(value, ["settings", "progress", "sessions", "bookmarks"])
  ) return null;

  const settings = normalizeSettings(value.settings);
  const progress = normalizeProgress(value.progress);
  const sessions = normalizeSessions(value.sessions);
  const bookmarks = normalizeBookmarks(value.bookmarks);
  const discoveryHistory = normalizeDiscoveryHistory(value.discoveryHistory);
  if (!settings || !progress || !sessions || !bookmarks || !discoveryHistory) return null;

  const normalized: VocabularyStateData = {
    settings,
    progress,
    sessions,
    bookmarks,
    discoveryHistory,
  };

  if (Buffer.byteLength(JSON.stringify(normalized), "utf8") > MAX_STATE_BYTES) {
    return null;
  }
  return normalized;
}

function authenticatedUserId(req: Request): string | null {
  return getAuth(req).userId ?? null;
}

router.get("/me/vocabulary-state", async (req, res, next): Promise<void> => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [record] = await db
      .select({
        state: vocabularyUserStateTable.state,
        updatedAt: vocabularyUserStateTable.updatedAt,
      })
      .from(vocabularyUserStateTable)
      .where(eq(vocabularyUserStateTable.userId, userId))
      .limit(1);

    const state = record ? normalizeVocabularyState(record.state) : null;
    if (record && !state) {
      req.log.error("Stored vocabulary state failed validation");
      res.status(500).json({ error: "Saved vocabulary state could not be loaded safely." });
      return;
    }
    res
      .set("Cache-Control", "no-store")
      .json(record ? { state, updatedAt: record.updatedAt } : { state: null, updatedAt: null });
  } catch (error) {
    next(error);
  }
});

router.put("/me/vocabulary-state", async (req, res, next): Promise<void> => {
  try {
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (
      !isRecord(req.body) ||
      !hasOnlyKeys(req.body, ["state"]) ||
      !hasKeys(req.body, ["state"])
    ) {
      res.status(400).json({ error: "The vocabulary state request is malformed." });
      return;
    }

    const state = normalizeVocabularyState(req.body.state);
    if (!state) {
      res.status(400).json({ error: "Invalid or oversized vocabulary state." });
      return;
    }

    const updatedAt = new Date();
    await db
      .insert(vocabularyUserStateTable)
      .values({ userId, state, updatedAt })
      .onConflictDoUpdate({
        target: vocabularyUserStateTable.userId,
        set: { state, updatedAt },
      });

    res
      .set("Cache-Control", "no-store")
      .json({ saved: true, updatedAt: updatedAt.toISOString() });
  } catch (error) {
    next(error);
  }
});

export default router;