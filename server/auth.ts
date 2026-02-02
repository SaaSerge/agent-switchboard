import bcrypt from "bcryptjs";
import crypto from "crypto";

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

export const generateApiKey = () => {
  return "sk_agent_" + crypto.randomBytes(16).toString("hex");
};

export const hashApiKey = (key: string) => {
  // Fast hash for API keys is fine, or use bcrypt. 
  // Bcrypt is safer but slower on every request. 
  // Given low traffic local tool, bcrypt is fine.
  // Actually, let's use sha256 for speed if we wanted, but let's stick to bcrypt for uniformity.
  // Wait, validating API key on every request with bcrypt is slow (CPU intensive).
  // Let's use SHA256 for API keys.
  return crypto.createHash("sha256").update(key).digest("hex");
};

export const validateApiKey = (key: string, hash: string) => {
  const computed = hashApiKey(key);
  return computed === hash;
};
