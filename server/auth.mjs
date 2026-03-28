import crypto from "node:crypto";

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function getSecret() {
  return process.env.JWT_SECRET || "thekedar-dev-secret-change-in-production";
}

export function createToken(contractorId) {
  const payload = Buffer.from(
    JSON.stringify({ id: contractorId, iat: Date.now() }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const dot = String(token).lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

export function getContractors() {
  if (process.env.CONTRACTORS_JSON) {
    try {
      const list = JSON.parse(process.env.CONTRACTORS_JSON);
      return list.map((c) => ({
        id: c.id,
        username: c.username,
        passwordHash: c.passwordHash || hashPassword(c.password || ""),
        pin: c.pin || "",
        label: c.label || c.id,
      }));
    } catch {
      return [];
    }
  }

  const contractors = [];
  for (let i = 1; i <= 10; i++) {
    const username = process.env[`C${i}_USERNAME`];
    const password = process.env[`C${i}_PASSWORD`];
    if (!username || !password) break;
    const id = process.env[`C${i}_ID`] || `contractor${i}`;
    const pin = process.env[`C${i}_PIN`] || "";
    const label = process.env[`C${i}_LABEL`] || id;
    contractors.push({ id, username, passwordHash: hashPassword(password), pin, label });
  }
  return contractors;
}

export function authenticate(username, password) {
  const contractors = getContractors();
  const hash = hashPassword(password);
  const found = contractors.find(
    (c) => c.username === username && c.passwordHash === hash,
  );
  if (!found) return null;
  return { id: found.id, token: createToken(found.id), label: found.label };
}

export function authenticateByPin(pin) {
  if (!pin || String(pin).length !== 4) return null;
  const contractors = getContractors();
  const found = contractors.find((c) => c.pin && c.pin === String(pin));
  if (!found) return null;
  return { id: found.id, token: createToken(found.id), label: found.label };
}

export function verifyRequest(req) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return verifyToken(token);
}
