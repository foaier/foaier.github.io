import http from "node:http";

const node = process.env.NODE_NAME || "backend";
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://backend");
  const body = { node, path: url.pathname, query: url.search, method: req.method,
    host: req.headers.host, forwardedFor: req.headers["x-forwarded-for"] || "",
    forwardedProto: req.headers["x-forwarded-proto"] || "", requestId: req.headers["x-request-id"] || "",
    time: new Date().toISOString() };
  const reply = () => {
    if (res.destroyed) return;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (url.pathname === "/private/profile") {
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Set-Cookie", "demo=local; Path=/; HttpOnly; SameSite=Lax");
    }
    res.end(JSON.stringify(body) + "\n");
  };
  if (url.pathname === "/slow") {
    const ms = Math.min(10000, Math.max(0, Number(url.searchParams.get("ms")) || 3000));
    const timer = setTimeout(reply, ms);
    res.on("close", () => clearTimeout(timer));
  } else {
    // Consume request bodies without storing them; the service only reports routing metadata.
    req.resume(); reply();
  }
});
server.listen(3000, "0.0.0.0", () => console.log(`${node} listening on :3000`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
