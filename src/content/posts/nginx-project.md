---
title: Nginx 12：把前端、双后端和 HTTPS 装成一个能验收的小站
date: '2026-11-25'
summary: 整合前面学过的配置，完成发布检查、后端故障演练、配置回退和生产迁移清单。
series: Nginx 从入门到实战
order: 12
tags: [Nginx, 综合实战, 发布]
level: 综合练习
prerequisites: [nginx-troubleshooting]
goals:
  - 用同一入口提供 HTTPS 页面、静态资源和双节点 API。
  - 通过可检查的响应证明路由、缓存头、限流和故障转移生效。
  - 区分本机实验、生产部署和双机高可用的边界。
---

单项配置能运行，不代表放在一起就没有冲突。静态资源的 location 会不会抢走接口？HTML 的缓存头会不会覆盖安全头？后端挂掉时首页还能不能打开？综合练习就是把这些问题一起验收。

这一课回到 Docker 实验目录，不依赖上一课的两台虚拟机。准备好第一课生成的证书，确认两个后端都在运行。

## 最终请求链路长这样

```text
浏览器
 ├─ HTTP :8088 ──308──→ HTTPS :8443
 └─ HTTPS :8443
       ↓ Nginx
       ├─ /assets/...  → 静态文件；缺失返回 404
       ├─ /orders/42  → index.html → 前端路由
       ├─ /healthz    → 本地入口健康检查
       └─ /api/...    → 限流 → upstream → backend-a / backend-b
```

实验页面是一个无需构建的前端，能显示当前路径并调用接口。它模拟 React 构建产物的部署方式，不需要把 React 开发服务器放进生产链路。真实项目将构建后的 HTML、JS、CSS 发布到对应目录即可。

## 一次加载完整配置

```bash
docker compose start backend-a backend-b gateway
bash lesson.sh 12-project
docker compose exec gateway nginx -t
```

完整配置在 `lessons/12-project.conf`。它组合了两台上游、HTTPS、静态文件、前端回退、限流和安全头，没有把公共接口代理缓存默认套到所有 API 上。需要缓存的业务应按第八课单独挑选与配置。

检查下面几处路径的分工：

```nginx
location /api/ {
    limit_req zone=project_api burst=20 nodelay;
    limit_req_status 429;
    proxy_pass http://course_pool/;
    include /etc/nginx/course/proxy-headers.conf;
    proxy_connect_timeout 1s;
    proxy_read_timeout 5s;
    proxy_next_upstream error timeout http_502 http_503 http_504;
    proxy_next_upstream_tries 2;
}
location ^~ /assets/ {
    try_files $uri =404;
    expires 1h;
    include /etc/nginx/course/security-headers.conf;
}
location = /index.html {
    add_header Cache-Control no-cache;
    include /etc/nginx/course/security-headers.conf;
}
location / {
    try_files $uri $uri/ /index.html;
}
```

这些片段依赖完整文件里的 upstream、限流共享区和 TLS server，不应脱离上下文单独贴成整个 nginx.conf。阅读配置时先找定义在哪里，再找哪些 location 使用它。

## 不只检查首页，逐个验收行为

在实验目录执行：

```bash
curl -I http://localhost:8088/
curl --cacert certs/localhost.crt -I https://localhost:8443/
curl --cacert certs/localhost.crt -i https://localhost:8443/healthz
curl --cacert certs/localhost.crt -i https://localhost:8443/orders/42
curl --cacert certs/localhost.crt -i https://localhost:8443/assets/missing.js
```

| 检查项 | 应看到什么 |
|---|---|
| HTTP 入口 | 308，Location 指向本地 HTTPS |
| HTTPS 首页 | 证书验证通过，返回 200 |
| `/healthz` | 200，正文 `ok` |
| 前端业务路径 | 200，返回前端入口 HTML |
| 不存在的 JS | 404，而不是 HTML |

再检查缓存与安全头：

```bash
curl --cacert certs/localhost.crt -I https://localhost:8443/index.html
curl --cacert certs/localhost.crt -I https://localhost:8443/assets/app.v1.css
```

HTML 应有 `Cache-Control: no-cache`，CSS 应有短时 max-age，两者都应有 `X-Content-Type-Options: nosniff`。这一步专门防止子 location 的 add_header 意外覆盖父层配置。

## 用一次后端故障检验分工

```bash
for i in $(seq 1 8); do
  curl --cacert certs/localhost.crt -sS https://localhost:8443/api/whoami
done
docker compose stop backend-a
curl --cacert certs/localhost.crt -sS https://localhost:8443/api/whoami
curl --cacert certs/localhost.crt -I https://localhost:8443/
docker compose start backend-a
```

正常时能看到 A、B；停止 A 后接口应由 B 响应，首页也正常。静态首页成功不代表 API 一定成功，两者必须分别检查。

再思考一个问题：如果停止的是 gateway，会发生什么？本套 Compose 只有一个入口，它会整体不可用。这正是第十一课需要另一套双机环境解决的问题。双后端容器不能冒充双入口容灾。

## 发布配置，要有可回退的上一版

实验切换脚本做了文件备份、语法检查和 reload，但发布验收还需要真实请求。`nginx -t` 能发现指令和文件错误，不能证明 `/api/` 的斜杠符合你的后端路由，也不能证明数据库里的数据正确。

一次配置发布至少完成下面这个顺序：

1. 保存上一版配置和对应站点产物，记录版本。
2. 在验证环境运行语法检查和接口验收。
3. 部署新文件，检查通过后 reload。
4. 请求首页、关键接口和健康检查，观察错误率、上游耗时。
5. 出现异常，恢复上一版并重新检查、reload、验收。

回退不是“把某一段删掉试试”。前端文件、证书路径、上游地址和配置版本可能互相依赖，必须能回到一套一致的状态。只回退 Nginx 配置而没有旧静态资源，旧页面仍可能坏掉。

## 自动检查怎样使用

博客仓库提供独立检查命令，需要 Node.js 22、Docker 引擎和 OpenSSL：

```bash
# 在博客仓库根目录执行，不是 nginx-labs 目录。
npm ci
npm run nginx:check
```

检查器会复制实验到临时目录，使用独立 Compose 项目和本机 18088、18443 端口，逐个加载 11 份 Nginx 配置，验证路由、代理、双后端切换、TLS、缓存、限流和错误状态，结束后清理自己的容器。它不会改你正在练习的 `runtime/default.conf`。

这套检查不包含第十一课的真实 VIP 切换，也不是吞吐量压测。读者是否理解配置，仍要通过自己修改和解释结果来确认。

## 从本机实验搬到正式服务器，还要改哪些地方

| 实验安排 | 正式环境需要决定的事情 |
|---|---|
| localhost 和 8088/8443 | 实际域名、80/443 入口、DNS 与网络规则 |
| 自签证书 | 可信证书、自动续期、私钥管理与 reload |
| `stable-alpine` 标签 | 经验证的镜像版本或 digest，以及升级策略 |
| Docker DNS 127.0.0.11 | 实际部署环境的服务发现方式 |
| 同机两个后端 | 跨主机故障域、容量和业务状态共享 |
| 本地 stdout 日志 | 采集、轮转、保留时间、错误率与延迟告警 |
| 示例请求频率 | 根据压测、业务配额和真实用户分布确定阈值 |

Nginx 不会自动提供备份、数据库高可用、应用认证、分布式会话或 DDoS 全面防护。知道它的边界，才知道下一步应该补在哪一层。

最后留一个完整练习：增加 `/reports/`，让它转发给 B，保留 `/reports/` 前缀；其余 `/api/` 继续负载均衡。写出三条 curl 验收命令，证明两种路由都按预期工作，再把配置恢复到这课的完整版本。

## 继续阅读

- [Nginx 官方文档目录](https://nginx.org/en/docs/)
- [Nginx 重载与升级控制](https://nginx.org/en/docs/control.html)
- [Docker Compose 生产部署说明](https://docs.docker.com/compose/how-tos/production/)
