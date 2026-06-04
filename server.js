import express from "express";
import path from "path";
import fs from "fs";
import https from "https";
import { fileURLToPath } from "url";
import { initDB, db } from "./src/db.js";
import apiRouter from "./src/routes.js";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import helmet from "helmet";
import { 
  blockCheckMiddleware, 
  rateLimitMiddleware, 
  accessGateMiddleware,
  handleVerifyJS,
  handleFingerprint,
  handleToken
} from "./src/bot.js";
import { securityHeaders, requireLoginMiddleware } from "./src/security.js";

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://abs.twimg.com"],
    },
  },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

app.use(securityHeaders);
// ボットチェック用のミドルウェアを無効化
// app.use(blockCheckMiddleware);
// app.use(rateLimitMiddleware);
// app.use(accessGateMiddleware);
app.use(requireLoginMiddleware);

app.get("/botcheck", (req, res) => res.render("botcheck"));
app.post("/api/bot/verify-js", handleVerifyJS);
app.post("/api/bot/fingerprint", handleFingerprint);
app.get("/api/bot/token", handleToken);

app.use("/api", apiRouter);

app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));
app.get("/profile", (req, res) => res.render("profile"));
app.get("/notifications", (req, res) => res.render("notifications"));

app.use((req, res) => {
  res.status(404).render("404");
});

cron.schedule('0 2 * * *', async () => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)){
      fs.mkdirSync(backupDir);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    const result = await db.execute("SELECT * FROM tweets");
    fs.writeFileSync(backupFile, JSON.stringify(result.rows));
  } catch (err) {
    console.error(err);
  }
});

initDB().then(() => {
  const keyPath = path.join(__dirname, "certs", "server.key");
  const certPath = path.join(__dirname, "certs", "server.crt");

  // `certs/server.key` と `certs/server.crt` が両方存在するか確認
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    // ローカル環境（証明書あり）: HTTPSで起動
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    https.createServer(httpsOptions, app).listen(port, () => {
      console.log(`Server: https://localhost:${port}`);
    });
  } else {
    // 本番環境（証明書なし）: RenderインフラがSSL化を代行するため、HTTPで起動
    app.listen(port, () => {
      console.log(`Server: http://localhost:${port} (HTTP mode for production)`);
    });
  }
}).catch(console.error);
