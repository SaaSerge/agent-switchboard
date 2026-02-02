import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateApiKey(): string {
  const random = crypto.randomBytes(32).toString("hex");
  return `sk_agent_${random}`;
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export function validateApiKey(apiKey: string, storedHash: string): boolean {
  const hash = hashApiKey(apiKey);
  return hash === storedHash;
}
