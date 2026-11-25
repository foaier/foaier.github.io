# Nginx 实验源码

对应博客 `/nginx/` 的 12 篇教程。主线是一个 Nginx 入口、两个会返回请求信息的 Node.js 后端，不需要数据库或云账号。

## 开始

准备 Docker Engine / Docker Desktop、Docker Compose v2、Bash、curl、unzip 和 OpenSSL。Windows 使用 WSL 2 的 Ubuntu 终端，并在 Docker Desktop 中开启该发行版的集成。

解压后进入 `nginx-labs` 目录：

```bash
bash init.sh
curl -i http://localhost:8088/
```

本机 HTTP 8088、HTTPS 8443 需要空闲。后端端口不对主机发布。`init.sh` 会保留已有运行配置，只在第一次运行时复制第一课，并在 `certs/` 生成有效期 30 天的本地自签证书。证书到期后删除本实验 `certs/localhost.crt` 和 `certs/localhost.key`，重新运行 init 生成；这只适用于教学证书。

## 切换章节

```bash
bash lesson.sh 04-proxy
curl -sS http://localhost:8088/api/whoami
```

脚本复制所选完整配置到 `runtime/default.conf`，执行 `nginx -t`，通过后 reload；失败会恢复上一份文件。`runtime/previous.conf.bak` 不以 `.conf` 结尾，因此不会被 Nginx 的通配 include 误加载。

| 文件 | 练习 |
|---|---|
| `01-start.conf` | 静态网页、CSS 与 404 |
| `02-config.conf` | course.local / admin.local 虚拟主机 |
| `03-location.conf` | 精确、前缀、正则、alias、前端回退 |
| `04-proxy.conf` | `/api/` 去前缀、`/keep/` 保留路径、转发头 |
| `05-balance.conf` | 双节点、权重、DNS 解析、故障重试 |
| `06-static.conf` | 动静分离、浏览器缓存、304、gzip |
| `07-https.conf` | 本地 TLS 证书、HTTP 跳转 |
| `08-cache.conf` | 公共响应缓存、MISS/HIT、认证绕过 |
| `09-security.conf` | 请求限流、连接限制、体积限制、路径保护 |
| `10-debug.conf` | 可复现的 403、404、502、504 |
| `ha/` | 第 11 课独立的两台 Linux VM 主备配置 |
| `12-project.conf` | HTTPS、双后端、静态资源、前端路由的组合 |

配置文件只包含 `http` 内的内容，因为主 `nginx.conf` 已经有 http 块。阅读正文时注意片段的作用域，不要把 lessons 文件再包一层 http。

## 常用命令

```bash
docker compose ps
docker compose logs --tail 30 gateway
docker compose exec gateway nginx -t
docker compose exec gateway nginx -T
docker compose stop
docker compose start
docker compose down
```

HTTPS 实验用下面的方式验证本地证书，而不是跳过验证：

```bash
curl --cacert certs/localhost.crt -I https://localhost:8443/
```

课程默认使用 8088/8443。Compose 允许通过 NGINX_HTTP_PORT 和 NGINX_HTTPS_PORT 改映射，但 07/12 课的 HTTP 跳转固定写了本机 8443；修改端口时也要同步调整跳转地址。

## 实际验证范围

2026-11-25，在 Linux 容器中的 Nginx 1.30.8 上验证了全部 11 份 HTTP 配置，测试涵盖静态文件、location、转发路径、轮询与单节点停止、证书校验、缓存命中/绕过、限流、请求体限制和故障响应。

教学镜像使用 `nginx:stable-alpine`、`node:22-alpine`，标签会随时间更新；要求 Nginx 1.28+。生产应记录经过验证的具体镜像 digest，并用升级流程更新。主配置固定两个 worker 便于练习，不是所有生产环境的性能建议。

仓库根目录运行 `npm run nginx:check` 可重跑隔离的真实 HTTP 检查。需要 Node.js 22、Docker 和 OpenSSL，临时使用本机 18088、18443；检查结束会清理其独立项目。Windows 默认寻找 Git for Windows 自带的 OpenSSL，也可用 `NGINX_OPENSSL` 指定可执行文件。

第 11 课的 VIP 漂移、网络分区与整机故障需要两台同网段 Linux 虚拟机。这里的 HTTP 自动检查不把单机容器结果当作双机高可用证据。

## 文件与数据

`runtime/` 是临时生效配置，`certs/` 是本机证书与私钥，两者不入 Git，也不进入下载 ZIP。缓存保存在 gateway 容器内部，重建容器可能清除。`docker compose down` 只移除这套实验的容器和网络，宿主目录保留。

这是一套可修改的教学环境。公共入口要另行配置域名、可信证书、日志轮转和监控；后端示例仅用于看清请求路由。
