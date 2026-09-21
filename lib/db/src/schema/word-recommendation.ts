import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const wordRecommendationTable = pgTable(
  "word_recommendation",
  {
    userId: text("user_id").notNull(),
    wordKey: text("word_key").notNull(),
    word: text("word").notNull(),
    field: text("field").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    primaryKey({ columns: [table.userId, table.wordKey] }),
    index("word_recommendation_word_key_idx").on(table.wordKey),
    index("word_recommendation_updated_at_idx").on(table.updatedAt),
  ],
);

export const insertWordRecommendationSchema = createInsertSchema(wordRecommendationTable)
  .omit({ createdAt: true, updatedAt: true });

export type InsertWordRecommendation = z.infer<typeof insertWordRecommendationSchema>;
export type WordRecommendation = typeof wordRecommendationTable.$inferSelect;