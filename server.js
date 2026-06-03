import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initDB } from "./src/db.js";
import apiRouter from "./src/routes.js";
import "dotenv/config";
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// セキュリティおよび防御系ミドルウェアの適用
app.use(securityHeaders);
app.use(blockCheckMiddleware);
app.use(rateLimitMiddleware);
app.use(accessGateMiddleware);
app.use(requireLoginMiddleware);

app.get("/botcheck", (req, res) => res.render("botcheck"));
app.post("/api/bot/verify-js", handleVerifyJS);
app.post("/api/bot/fingerprint", handleFingerprint);
app.get("/api/bot/token", handleToken);

app.use("/api", apiRouter);

// ルートをホームとログインに完全切り分け
app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));
app.get("/profile", (req, res) => res.render("profile"));
app.get("/notifications", (req, res) => res.render("notifications"));

app.use((req, res) => {
  res.status(404).render("404");
});

initDB().then(() => {
  app.listen(port, () => console.log(`Server: http://localhost:${port}`));
}).catch(console.error);
