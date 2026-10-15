import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema for the Neon Postgres deployment target.
 * Includes Better Auth's tables plus the Silo Breaker knowledge-graph tables.
 * Vector embeddings use pgvector (1536 dims — matches Nebius Qwen/Qwen3-Embedding-8B).
 */

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Knowledge graph tables
// ---------------------------------------------------------------------------

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url"),
    source: varchar("source", { length: 24 }).notNull().default("manual"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("documents_user_idx").on(t.userId)],
);

export const chunks = pgTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("chunks_user_idx").on(t.userId),
    index("chunks_embedding_idx")
      .using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const insights = pgTable(
  "insights",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    currentDocumentId: text("current_document_id").references(
      () => documents.id,
      { onDelete: "cascade" },
    ),
    relatedDocumentId: text("related_document_id").references(
      () => documents.id,
      { onDelete: "set null" },
    ),
    skill: varchar("skill", { length: 64 }).notNull().default("silo-breaker-synthesis"),
    headline: text("headline").notNull(),
    body: text("body").notNull(),
    score: doublePrecision("score").notNull().default(0),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    evidence: jsonb("evidence").$type<unknown[]>().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("insights_user_idx").on(t.userId),
    index("insights_status_idx").on(t.status),
  ],
);

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type ChunkRow = typeof chunks.$inferSelect;
export type InsightRow = typeof insights.$inferSelect;
