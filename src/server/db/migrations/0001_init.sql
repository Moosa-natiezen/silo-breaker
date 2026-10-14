-- Silo Breaker — initial Neon Database migration
-- Requires: CREATE EXTENSION IF NOT EXISTS vector; (pgvector)

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Better Auth tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Knowledge graph tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "documents" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "url" text,
  "source" varchar(24) NOT NULL DEFAULT 'manual',
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "documents_user_idx" ON "documents" ("user_id");

CREATE TABLE IF NOT EXISTS "chunks" (
  "id" text PRIMARY KEY,
  "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "chunks_user_idx" ON "chunks" ("user_id");
CREATE INDEX IF NOT EXISTS "chunks_embedding_idx"
  ON "chunks" USING hnsw ("embedding" vector_cosine_ops);

CREATE TABLE IF NOT EXISTS "insights" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "current_document_id" text REFERENCES "documents"("id") ON DELETE cascade,
  "related_document_id" text REFERENCES "documents"("id") ON DELETE set null,
  "skill" varchar(64) NOT NULL DEFAULT 'silo-breaker-synthesis',
  "headline" text NOT NULL,
  "body" text NOT NULL,
  "score" double precision NOT NULL DEFAULT 0,
  "status" varchar(16) NOT NULL DEFAULT 'pending',
  "evidence" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "insights_user_idx" ON "insights" ("user_id");
CREATE INDEX IF NOT EXISTS "insights_status_idx" ON "insights" ("status");
