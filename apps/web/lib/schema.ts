import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * 웹 앱이 소유하는 사용자 참여 테이블(Neon). 파이프라인의 PostGIS 테이블(alembic)과 분리하기 위해
 * `app_` 접두어를 쓴다. 업소 식별은 GeoJSON의 첫 출처 키(`sources[0]`, 예: playground:1008196) —
 * 재내보내기 때 바뀌는 순번 id 대신 안정적인 값.
 */
export const users = pgTable("app_users", {
  id: text("id").primaryKey(), // 카카오 회원번호
  name: text("name"),
  image: text("image"),
  role: text("role").notNull().default("user"), // user | admin
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 이용자 제보: 이용 정보 값 제안(info), 폐업(closed), 오류(error). 승인되면 overrides에 반영. */
export const reports = pgTable(
  "app_reports",
  {
    id: serial("id").primaryKey(),
    venueKey: text("venue_key").notNull(),
    venueName: text("venue_name").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(), // info | closed | error
    fields: jsonb("fields").$type<Record<string, string>>().notNull().default({}),
    message: text("message"),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
  },
  (t) => [index("app_reports_venue_idx").on(t.venueKey), index("app_reports_status_idx").on(t.status)],
);

/** 사업자 확인 요청: 승인되면 그 사용자의 해당 업소 제보는 owner 출처로 표시된다. */
export const claims = pgTable(
  "app_claims",
  {
    id: serial("id").primaryKey(),
    venueKey: text("venue_key").notNull(),
    venueName: text("venue_name").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    businessName: text("business_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    proof: text("proof"), // 사업자등록번호 일부, 공식 채널 URL 등 확인 근거
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
  },
  (t) => [index("app_claims_venue_idx").on(t.venueKey), index("app_claims_user_idx").on(t.userId)],
);

/** 승인된 값. 사이트는 이 표만 읽어 공식 사이트·공공 출처 값 위에 덮어쓴다. */
export const venueOverrides = pgTable("app_venue_overrides", {
  venueKey: text("venue_key").primaryKey(),
  attrs: jsonb("attrs").$type<Record<string, string>>().notNull().default({}),
  source: text("source").notNull(), // owner | user
  closed: integer("closed").notNull().default(0), // 1이면 폐업 확인
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
