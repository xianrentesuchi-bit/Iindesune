import crypto from "crypto";

// 状態管理用のインメモリデータストア
const requestLogs = new Map();
const verifiedIPs = new Set();
const blockedIPs = new Set();

// IPアドレスを抽出するヘルパー関数
function getClientIP(req) {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
}

// ミドルウェア 1: ブロック済みIPの検証
function blockCheckMiddleware(req, res, next) {
  const ip = getClientIP(req);

  if (blockedIPs.has(ip)) {
    return res.status(403).render("botblock");
  }

  next}

// ミドルウェア 2: レートリミッター（1分間に100リクエスト以上でブロック）
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

// ミドルウェア 3: 一般画面へのアクセス制限（JS検証済みかチェック）
// 静的ファイルやAPI、認証画面自体を除外して適用します
function accessGateMiddleware(req, res, next) {
  const ip = getClientIP(req);
  const path = req.path;

  // ルーティング除外リスト（Botチェック画面や認証APIなどは素通りさせる）
  if (
    path === "/botcheck" || 
    path.startsWith("/api/bot") || 
    path.startsWith("/css/") || 
    path.startsWith("/js/")
  ) {
    return next();
  }

  // まだ検証が完了していない場合はBotチェック画面へ強制誘導
  if (!verifiedIPs.has(ip)) {
    return res.redirect("/botcheck");
  }

  next();
}

// APIハンドラー群
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
