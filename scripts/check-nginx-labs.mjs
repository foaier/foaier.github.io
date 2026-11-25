import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";

// Run isolated copies so checks never change a reader's active lesson or containers.
const source = fileURLToPath(new URL("../examples/nginx-labs/", import.meta.url));
const root = mkdtempSync(path.join(tmpdir(), "foaier-nginx-check-"));
const project = `foaier-nginx-check-${process.pid}`;
const env = { ...process.env, NGINX_HTTP_PORT: "18088", NGINX_HTTPS_PORT: "18443" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let checks = 0;
function command(program, args, options = {}) {
  const result = spawnSync(program, args, { cwd: root, env, encoding: "utf8", timeout: 180000, ...options });
  if (result.status !== 0) throw new Error(`${program} ${args.join(" ")}\n${result.error?.message || ""}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const compose = (...args) => command("docker", ["compose", "-p", project, ...args]);
async function request(url = "/", options = {}) {
  const secure = options.secure;
  return new Promise((resolve, reject) => {
    const req = (secure ? https : http).request({ hostname: "localhost", port: secure ? 18443 : 18088,
      path: url, method: options.method || "GET", headers: options.headers || {},
      ...(secure ? { ca: readFileSync(path.join(root, "certs/localhost.crt")) } : {}) }, (res) => {
      let body = "";
      res.setEncoding("utf8"); res.on("data", (part) => { body += part; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.setTimeout(8000, () => req.destroy(new Error("request timed out")));
    req.on("error", reject); req.end(options.body);
  });
}
async function select(name) {
  copyFileSync(path.join(root, "lessons", `${name}.conf`), path.join(root, "runtime/default.conf"));
  compose("exec", "-T", "gateway", "nginx", "-t");
  compose("exec", "-T", "gateway", "nginx", "-s", "reload");
  await sleep(600);
}
async function check(name, fn) { await fn(); console.log(`PASS ${name}`); checks++; }

try {
  cpSync(source, root, { recursive: true, filter: (file) => !["runtime", "certs"].includes(path.relative(source, file).split(path.sep)[0]) });
  mkdirSync(path.join(root, "runtime"), { recursive: true }); mkdirSync(path.join(root, "certs"), { recursive: true });
  copyFileSync(path.join(root, "lessons/01-start.conf"), path.join(root, "runtime/default.conf"));
  const openssl = process.env.NGINX_OPENSSL || (process.platform === "win32" ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl");
  command(openssl, ["req", "-x509", "-nodes", "-newkey", "rsa:2048", "-days", "1", "-keyout", "certs/localhost.key", "-out", "certs/localhost.crt", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"]);
  compose("up", "-d", "--wait", "--wait-timeout", "60");
  console.log(compose("exec", "-T", "gateway", "nginx", "-v"));
  for (let attempt = 0; attempt < 30; attempt++) {
    try { if ((await request()).status === 200) break; } catch { /* Startup can take a moment. */ }
    await sleep(500);
  }
  await check("static page, assets and real 404", async () => {
    assert.equal((await request()).status, 200);
    assert.match((await request("/assets/app.v1.css")).headers["content-type"], /text\/css/);
    assert.equal((await request("/missing")).status, 404);
  });
  await select("02-config");
  await check("virtual hosts and default host", async () => {
    assert.equal((await request()).status, 404);
    assert.equal((await request("/", { headers: { Host: "course.local" } })).status, 200);
    assert.match((await request("/", { headers: { Host: "admin.local" } })).body, /admin virtual host/);
  });
  await select("03-location");
  await check("exact, prefix, regex, alias, SPA and redirect", async () => {
    assert.equal((await request("/healthz")).body, "ok\n");
    assert.match((await request("/files/guide.txt")).body, /alias/);
    assert.match((await request("/other.txt")).body, /regex location/);
    assert.equal((await request("/app/orders/42")).status, 200);
    assert.equal((await request("/assets/missing.js")).status, 404);
    assert.equal((await request("/old")).status, 302);
  });
  await select("04-proxy");
  await check("proxy URI replacement and trusted forwarding headers", async () => {
    const body = JSON.parse((await request("/api/whoami?x=1", { headers: { "X-Forwarded-For": "spoofed" } })).body);
    assert.equal(body.path, "/whoami"); assert.equal(body.query, "?x=1");
    assert.notEqual(body.forwardedFor, "spoofed"); assert.ok(body.requestId);
    assert.equal(JSON.parse((await request("/keep/whoami")).body).path, "/keep/whoami");
  });
  await select("05-balance");
  await check("two upstreams and failover when one stops", async () => {
    const nodes = new Set();
    for (let i = 0; i < 10; i++) nodes.add(JSON.parse((await request("/api/whoami")).body).node);
    assert.equal(nodes.size, 2);
    compose("stop", "backend-a");
    try { for (let i = 0; i < 5; i++) assert.equal(JSON.parse((await request("/api/whoami")).body).node, "backend-b"); }
    finally { compose("start", "backend-a"); await sleep(1000); }
  });
  await select("06-static");
  await check("browser cache headers, conditional 304 and gzip", async () => {
    const css = await request("/assets/app.v1.css"); assert.match(css.headers["cache-control"], /max-age=3600/);
    assert.equal((await request("/assets/app.v1.css", { headers: { "If-None-Match": css.headers.etag } })).status, 304);
    assert.equal((await request("/assets/app.v1.css", { headers: { "Accept-Encoding": "gzip" } })).headers["content-encoding"], "gzip");
    assert.equal((await request("/index.html")).headers["cache-control"], "no-cache");
  });
  await select("07-https");
  await check("TLS certificate validation and HTTP redirect", async () => {
    assert.equal((await request()).status, 308);
    assert.equal((await request("/", { secure: true })).status, 200);
    assert.equal(JSON.parse((await request("/api/whoami", { secure: true })).body).forwardedProto, "https");
  });
  await select("08-cache");
  await check("MISS to HIT; cookies and credentials bypass cached responses", async () => {
    const uri = `/cached/time?run=${Date.now()}`;
    const first = await request(uri), second = await request(uri);
    assert.equal(first.headers["x-cache"], "MISS"); assert.equal(second.headers["x-cache"], "HIT"); assert.equal(first.body, second.body);
    for (const headers of [{ Cookie: "demo=1" }, { Authorization: "Bearer demo" }]) assert.equal((await request(uri, { headers })).headers["x-cache"], "BYPASS");
    assert.equal((await request("/api/private/profile")).headers["cache-control"], "private, no-store");
  });
  await select("09-security");
  await check("rate limit, denied paths and upload limit", async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, () => request("/api/whoami")));
    assert.ok(responses.some((r) => r.status === 429)); assert.ok(responses.some((r) => r.status === 200));
    assert.equal((await request("/.env")).status, 403);
    assert.equal((await request("/api/upload", { method: "POST", headers: { "Content-Length": "1048577" } })).status, 413);
  });
  await select("10-debug");
  await check("404, 403, 502, 504 and correlated access log", async () => {
    for (const [uri, code] of [["/missing", 404], ["/forbidden/", 403], ["/bad/", 502], ["/slow/?ms=3000", 504]]) assert.equal((await request(uri)).status, code);
    assert.match(compose("logs", "--no-color", "gateway"), /upstream_time/);
  });
  await select("12-project");
  await check("integrated site: HTTPS, API, SPA, missing assets and inherited security headers", async () => {
    for (const uri of ["/", "/orders/42", "/api/whoami", "/healthz"]) assert.equal((await request(uri, { secure: true })).status, 200);
    assert.equal((await request("/assets/missing.js", { secure: true })).status, 404);
    for (const uri of ["/index.html", "/assets/app.v1.css"]) assert.equal((await request(uri, { secure: true })).headers["x-content-type-options"], "nosniff");
  });
  console.log(`${checks} live Nginx checks passed; ${readdirSync(path.join(root, "lessons")).length} complete configurations loaded. Keepalived failover requires two Linux VMs and is not covered here.`);
} finally {
  try { compose("down", "--volumes", "--remove-orphans"); } catch (error) { console.error(error.message); }
  rmSync(root, { recursive: true, force: true });
}
