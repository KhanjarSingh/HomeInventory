CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"family_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_household_members" UNIQUE("household_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(32) DEFAULT 'editor' NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"kind" varchar(64) DEFAULT 'room' NOT NULL,
	"description" text,
	"notes" text,
	"icon" varchar(64),
	"color" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"path" text NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_locations_household_id" UNIQUE("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"icon" varchar(64),
	"color" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_categories_household_name" UNIQUE("household_id","name"),
	CONSTRAINT "uq_categories_household_id" UNIQUE("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"color" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_tags_household_name" UNIQUE("household_id","name"),
	CONSTRAINT "uq_tags_household_id" UNIQUE("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"color" varchar(32),
	"icon" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_collections_household_name" UNIQUE("household_id","name"),
	CONSTRAINT "uq_collections_household_id" UNIQUE("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_collection_items" UNIQUE("collection_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "item_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid,
	"container_item_id" uuid,
	"quantity" numeric(12, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_placement_quantity_positive" CHECK ("item_placements"."quantity" > 0),
	CONSTRAINT "chk_placement_not_self" CHECK ("item_placements"."container_item_id" IS NULL OR "item_placements"."item_id" != "item_placements"."container_item_id"),
	CONSTRAINT "chk_placement_target_xor" CHECK (("item_placements"."location_id" IS NOT NULL AND "item_placements"."container_item_id" IS NULL) OR ("item_placements"."location_id" IS NULL AND "item_placements"."container_item_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "item_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_item_tags" UNIQUE("item_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"description" text,
	"category_id" uuid,
	"subcategory" varchar(128),
	"brand" varchar(128),
	"model" varchar(128),
	"variant" varchar(128),
	"serial_number" varchar(128),
	"sku" varchar(128),
	"barcode" varchar(128),
	"qr_identifier" varchar(128),
	"color" varchar(64),
	"size" varchar(64),
	"material" varchar(128),
	"dimensions" jsonb,
	"weight" jsonb,
	"condition" varchar(32) DEFAULT 'good' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"total_quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit" varchar(32) DEFAULT 'pcs' NOT NULL,
	"low_stock_threshold" numeric(12, 2),
	"is_consumable" boolean DEFAULT false NOT NULL,
	"is_container" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"completeness_score" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_qr_identifier_unique" UNIQUE("qr_identifier"),
	CONSTRAINT "uq_items_household_id" UNIQUE("household_id","id"),
	CONSTRAINT "uq_items_id_is_container" UNIQUE("id","is_container"),
	CONSTRAINT "chk_items_total_quantity_non_negative" CHECK ("items"."total_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "item_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"cloudinary_public_id" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"secure_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"format" varchar(32) NOT NULL,
	"bytes" integer NOT NULL,
	"kind" varchar(32) DEFAULT 'primary' NOT NULL,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"taken_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"type" varchar(32) DEFAULT 'purchase' NOT NULL,
	"source" varchar(128),
	"date" date DEFAULT 'now()' NOT NULL,
	"order_reference" varchar(128),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"previous_quantity" numeric(12, 2) NOT NULL,
	"new_quantity" numeric(12, 2) NOT NULL,
	"delta" numeric(12, 2) NOT NULL,
	"reason" varchar(64) NOT NULL,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"from_location_id" uuid,
	"from_container_item_id" uuid,
	"to_location_id" uuid,
	"to_container_item_id" uuid,
	"reason" varchar(64) DEFAULT 'reorganize' NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"borrower_name" varchar(128) NOT NULL,
	"borrower_contact" varchar(128),
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"lent_at" date DEFAULT 'now()' NOT NULL,
	"due_at" date,
	"returned_at" date,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"item_id" uuid,
	"title" varchar(255) NOT NULL,
	"due_date" date NOT NULL,
	"type" varchar(32) DEFAULT 'custom' NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"changes" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid,
	"filename" varchar(255) NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"invalid_rows" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"errors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"code" varchar(128) NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" uuid NOT NULL,
	"label_title" varchar(255),
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_labels_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "fk_collection_items_household_collection" FOREIGN KEY ("household_id","collection_id") REFERENCES "public"."collections"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "fk_collection_items_household_item" FOREIGN KEY ("household_id","item_id") REFERENCES "public"."items"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_placements" ADD CONSTRAINT "fk_placements_household_item" FOREIGN KEY ("household_id","item_id") REFERENCES "public"."items"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_placements" ADD CONSTRAINT "fk_placements_household_location" FOREIGN KEY ("household_id","location_id") REFERENCES "public"."locations"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_placements" ADD CONSTRAINT "fk_placements_household_container" FOREIGN KEY ("household_id","container_item_id") REFERENCES "public"."items"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tags" ADD CONSTRAINT "fk_item_tags_household_item" FOREIGN KEY ("household_id","item_id") REFERENCES "public"."items"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tags" ADD CONSTRAINT "fk_item_tags_household_tag" FOREIGN KEY ("household_id","tag_id") REFERENCES "public"."tags"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_images" ADD CONSTRAINT "item_images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_images" ADD CONSTRAINT "fk_item_images_household_item" FOREIGN KEY ("household_id","item_id") REFERENCES "public"."items"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "fk_price_history_household_item" FOREIGN KEY ("household_id","item_id") REFERENCES "public"."items"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "fk_adjustments_household_item" FOREIGN KEY ("household_id","item_id") REFERENCES "public"."items"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_from_container_item_id_items_id_fk" FOREIGN KEY ("from_container_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_to_container_item_id_items_id_fk" FOREIGN KEY ("to_container_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "fk_movements_household_item" FOREIGN KEY ("household_id","item_id") REFERENCES "public"."items"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "fk_loans_household_item" FOREIGN KEY ("household_id","item_id") REFERENCES "public"."items"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_labels" ADD CONSTRAINT "qr_labels_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_household_members_user" ON "household_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_household_members_household" ON "household_members" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_invitations_token" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_invitations_email" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_locations_household_path" ON "locations" USING btree ("household_id","path");--> statement-breakpoint
CREATE INDEX "idx_locations_household_parent" ON "locations" USING btree ("household_id","parent_id");--> statement-breakpoint
CREATE INDEX "idx_locations_household_active" ON "locations" USING btree ("household_id","deleted_at","is_archived");--> statement-breakpoint
CREATE INDEX "idx_categories_household" ON "categories" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_tags_household" ON "tags" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_collections_household" ON "collections" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_collection_items_collection" ON "collection_items" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_collection_items_item" ON "collection_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_placements_item" ON "item_placements" USING btree ("household_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_placements_location" ON "item_placements" USING btree ("household_id","location_id");--> statement-breakpoint
CREATE INDEX "idx_placements_container" ON "item_placements" USING btree ("household_id","container_item_id");--> statement-breakpoint
CREATE INDEX "idx_item_tags_item" ON "item_tags" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_item_tags_tag" ON "item_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_items_household_active" ON "items" USING btree ("household_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_items_household_category" ON "items" USING btree ("household_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_items_household_status" ON "items" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "idx_items_name" ON "items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_item_images_item" ON "item_images" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_item_images_primary" ON "item_images" USING btree ("item_id","is_primary");--> statement-breakpoint
CREATE INDEX "idx_price_history_item" ON "price_history" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_price_history_date" ON "price_history" USING btree ("item_id","date");--> statement-breakpoint
CREATE INDEX "idx_adjustments_household" ON "inventory_adjustments" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_adjustments_item" ON "inventory_adjustments" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_movements_household" ON "movements" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_movements_item" ON "movements" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_loans_household_status" ON "loans" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "idx_loans_item" ON "loans" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_reminders_household_due" ON "reminders" USING btree ("household_id","due_date","is_dismissed");--> statement-breakpoint
CREATE INDEX "idx_audit_log_household" ON "audit_log" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_household" ON "import_jobs" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_qr_labels_code" ON "qr_labels" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_qr_labels_entity" ON "qr_labels" USING btree ("household_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_items_name_trgm" ON "items" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_items_search_vector" ON "items" USING gin (
  to_tsvector('english', coalesce("name",'') || ' ' || coalesce("description",'') || ' ' || coalesce("brand",'') || ' ' || coalesce("model",'') || ' ' || coalesce("variant",'') || ' ' || coalesce("sku",''))
);