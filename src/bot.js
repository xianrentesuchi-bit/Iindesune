import crypto from "crypto";

const requestLogs = new Map();
const verifiedIPs = new Map();
const blockedIPs = new Set();

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const ip =
    req.socket.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown";

  if (ip === "::1") {
    return "127.0.0.1";
  }

  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }

  return ip;
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

  // ボットチェック自体、ボット用API、静的ファイル（拡張子あり）は常に許可
  if (
    path === "/botcheck" ||
    path.startsWith("/api/bot") ||
    path.startsWith("/css/") ||
    path.startsWith("/js/") ||
    path.includes(".")
  ) {
    return next();
  }

  // 認証が必要なルート（すべての画面遷移および認証が必要なAPI）
  const verifiedTime = verifiedIPs.get(ip);
  const now = Date.now();

  // 認証データがない、または3時間を経過している場合はチェックへ強制移動
  if (!verifiedTime || (now - verifiedTime > 3 * 60 * 60 * 1000)) {
    if (verifiedTime) {
      verifiedIPs.delete(ip); // 期限切れの削除
    }

    if (path.startsWith("/api/")) {
      return res.status(403).json({
        error: "JS verification failed"
      });
    }

    return res.redirect("/botcheck");
  }

  next();
}

function handleVerifyJS(req, res) {
  const ip = getClientIP(req);

  verifiedIPs.set(ip, Date.now());

  return res.json({
    ok: true
  });
}

function handleFingerprint(req, res) {
  const { fp } = req.body;

  if (!fp) {
    return res.status(400).json({
      error: "No fingerprint"
    });
  }

  res.json({
    accepted: true
  });
}

function handleToken(req, res) {
  const ip = getClientIP(req);

  const token = crypto
    .createHash("sha256")
    .update(ip + Date.now())
    .digest("hex");

  res.json({
    token
  });
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
