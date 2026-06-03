import crypto from "crypto";

const requestLogs = new Map();
const verifiedIPs = new Set();
const blockedIPs = new Set();

function getClientIP(req) {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
}

function blockCheckMiddleware(req, res, next) {
  const ip = getClientIP(req);

  if (blockedIPs.has(ip)) {
    return res.status(403).render("botblock");
  }

  next();
}

function rateLimitMiddleware(req, res, next) {
  const ip = getClientIP(req);
  const now = Date.now();

  if (!requestLogs.has(ip)) {
    requestLogs.set(ip, []);
  }

  const logs = requestLogs.get(ip);

  while (logs.length && now - logs[0] > 60000) {
    logs.shift();
  }

  logs.push(now);

  if (logs.length > 100) {
    blockedIPs.add(ip);
    return res.status(429).render("botblock");
  }

  next();
}

function accessGateMiddleware(req, res, next) {
  const ip = getClientIP(req);
  const path = req.path;

  if (
    path === "/botcheck" || 
    path.startsWith("/api/bot") || 
    path.startsWith("/css/") || 
    path.startsWith("/js/") ||
    path.includes(".")
  ) {
    return next();
  }

  if (!verifiedIPs.has(ip)) {
    return res.redirect("/botcheck");
  }

  next();
}

function handleVerifyJS(req, res) {
  const ip = getClientIP(req);
  verifiedIPs.add(ip);
  res.json({ ok: true });
}

function handleFingerprint(req, res) {
  const { fp } = req.body;

  if (!fp) {
    return res.status(400).json({ error: "No fingerprint" });
  }

  res.json({ accepted: true });
}

function handleToken(req, res) {
  const ip = getClientIP(req);
  const token = crypto
    .createHash("sha256")
    .update(ip + Date.now())
    .digest("hex");

  res.json({ token });
}

export {
  blockCheckMiddleware,
  rateLimitMiddleware,
  accessGateMiddleware,
  handleVerifyJS,
  handleFingerprint,
  handleToken,
  blockedIPs
};
