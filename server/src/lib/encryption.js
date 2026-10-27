const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const LEGACY_ALGORITHM = "aes-256-cbc";

function getKey() {
  const hex = process.env.ENCRYPTION_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw Object.assign(
      new Error(
        "ENCRYPTION_KEY must be exactly 64 hex characters. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      ),
      { status: 500 },
    );
  }
  return Buffer.from(hex, "hex");
}

// Output format: iv:authTag:ciphertext (all hex)
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

function decrypt(payload) {
  const parts = payload.split(":");

  // Legacy AES-CBC format: iv:ciphertext
  if (parts.length === 2) {
    const iv = Buffer.from(parts[0], "hex");
    const enc = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, getKey(), iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      "utf8",
    );
  }

  if (parts.length !== 3) throw new Error("Malformed encrypted value");

  const [ivHex, tagHex, encHex] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = { encrypt, decrypt };
