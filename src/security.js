import helmet from "helmet";

export function escapeHTML(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>'"]/g, (tag) => {
    const chars = {
      &: "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };
    return chars[tag] || tag;
  });
}

export function requireLoginMiddleware(req, res, next) {
  const publicPaths = ["/login", "/botcheck", "/favicon.ico", "/js/", "/css/"];
  const isPublic = publicPaths.some(p => req.path.startsWith(p));
  
  if (isPublic || req.path.startsWith("/api/bot") || req.path.startsWith("/api/auth")) {
    return next();
  }

  next();
}

export function securityHeaders(req, res, next) {
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
}
