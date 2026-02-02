import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";

// In Replit, use the project root or a persistent data directory if available.
// For now, a file in the project root is fine.
const dbPath = path.join(process.cwd(), "sqlite.db");

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
