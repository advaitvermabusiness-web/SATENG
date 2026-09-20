import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type VocabularyStateData = {
  settings: Record<string, unknown>;
  progress: unknown[];
  sessions: unknown[];
  bookmarks: string[];
  discoveryHistory?: unknown[];
};

export const vocabularyUserStateTable = pgTable("vocabulary_user_state", {
  userId: text("user_id").primaryKey(),
  state: jsonb("state").$type<VocabularyStateData>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});