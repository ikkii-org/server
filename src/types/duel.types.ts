import { pgEnum } from "drizzle-orm/pg-core";

export type DuelStatus =
  | "OPEN"
  | "ACTIVE"
  | "DISPUTED"
  | "SETTLED"
  | "CANCELLED";

export const duelStatusEnum = pgEnum("duel_status", [
  "OPEN",
  "ACTIVE",
  "DISPUTED",
  "SETTLED",
  "CANCELLED",
]);
