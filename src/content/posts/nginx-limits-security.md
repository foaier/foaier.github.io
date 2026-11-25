---
title: Nginx 09：限流、连接限制和入口防护，先看请求为什么被拦
date: '2026-11-25'
summary: 通过并发请求观察 429，通过上传观察 413，再理解真实客户端地址和规则边界。
series: Nginx 从入门到实战
order: 9
tags: [Nginx, 限流, 安全]
level: 进阶实践
prerequisites: [nginx-proxy-cache]
goals:
  - 区分请求频率限制、连接限制与请求体大小限制。
  - 复现 429、403 和 413，并解释对应配置。
  - 避免错误信任转发头或用入口规则代替业务权限。
---

一个脚本每秒打几百次搜索接口，后端可能很快被拖慢。入口限流的作用，是在请求进入应用之前控制一部分压力。但限制按谁计算、允许多少突发、拒绝后返回什么，都需要讲清楚。

这课只对本机实验发少量请求，不需要压测工具，也不向外部网站发流量。

## 每秒两次，不等于计数器每秒整点清零

加载配置：

```bash
bash lesson.sh 09-security
curl -i http://localhost:8088/api/whoami
```

核心规则分为两层：

```nginx
# http 层：定义计数的键、共享区和平均处理速率。
limit_req_zone $binary_remote_addr zone=per_ip:10m rate=2r/s;
limit_conn_zone $binary_remote_addr zone=connections:10m;

# /api/ 的 location 内：真正应用限制。
limit_req zone=per_ip burst=3 nodelay;
limit_req_status 429;
limit_conn connections 5;
limit_conn_status 429;
```

`limit_req_zone` 定义规则不等于启用限制，location 里还需要 `limit_req`。共享区使不同 worker 能针对同一个键计数。

`rate=2r/s` 控制平均速率。`burst=3` 允许一定突发超额，`nodelay` 让允许范围内的突发请求不用按速率逐个等待，但超额额度并不会因为立即放行就立刻恢复。

没有 nodelay 时，允许进入突发范围的请求可能被延迟处理；超过范围则拒绝。它不是一个简单的“每秒开始清零，前两个放过”的固定窗口。

## 发二十个请求，观察 200 和 429

```bash
seq 1 20 | xargs -P 10 -I '{}' \
  curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8088/api/whoami
docker compose logs --tail 25 gateway
```

`-P 10` 让 xargs 最多并行执行十个命令，`-o /dev/null` 丢掉响应正文，`-w` 只打印状态码。通常会同时出现 200 和 429，不要求固定各几条，因为机器速度和请求到达时间不同。

日志里的 `limit` 可出现 `PASSED`、`REJECTED` 等状态。别只看客户端说“请求失败”，要确定是入口限流、上游故障，还是应用自己返回了 429。

正式上线可先用 `limit_req_dry_run on;` 观察本来会拦多少请求，再确定阈值。阈值应依据后端容量和业务体验，不能把实验的每秒两次直接当成生产推荐值。

## limit_conn 限的是连接处理，不是注册用户

`limit_conn` 控制同一键对应的并发连接处理数量。只有读完请求头并进入处理阶段的连接才被计数；HTTP/2、HTTP/3 的并发请求还有各自计数语义，所以它不能简单等同于操作系统里的 TCP socket 数。

要观察这个限制，可以临时把请求限流调大，只保留较小的连接限制，再并发请求耗时接口 `/api/slow?ms=3000`。短到瞬间完成的接口不容易形成并发占用。

别把 `keepalive_timeout` 当成并发限制，也别把 upstream 的 `keepalive 16` 当成入口最多十六个用户。它们在控制不同阶段的连接行为。

## 请求体太大，先由入口返回 413

本课 server 中设置 `client_max_body_size 1m;`。用一份约两 MiB 的文件测试：

```bash
dd if=/dev/zero of=/tmp/nginx-upload.bin bs=1024 count=2048
curl -i --data-binary @/tmp/nginx-upload.bin http://localhost:8088/api/upload
rm /tmp/nginx-upload.bin
```

应看到 413。限制是请求体大小，不是文件扩展名。真实 multipart 上传还包含边界和其他字段，允许“刚好 1MB 文件”时要考虑额外开销。

如果应用允许上传 20MB，Nginx 只允许 1MB，应用根本没机会处理请求。反过来，入口允许很大，后端也可能自己拒绝。上传问题要把入口、应用、中间网关的限制一起核对，而不是一路改成无限大。

## 隐藏文件和管理路径怎样处理

```nginx
location ~ /\. { deny all; }
location /internal/ { deny all; }
```

```bash
curl -i http://localhost:8088/.env
curl -i http://localhost:8088/internal/status
```

两条应返回 403。这个隐藏文件规则会影响 `.well-known` 路径；正式使用 HTTP-01 证书验证时，要为验证路径明确设置允许规则，并检查优先级。

入口拒绝某些路径能减少误暴露，但后端仍要做身份认证和授权。只在 Nginx 拦 `/admin/`，后端却提供另一个未保护的管理接口，问题依然存在。基础认证也应只在 HTTPS 上使用，并把密码文件放在站点目录之外。

## 限流的 IP，真的是用户的 IP 吗

Nginx 前面如果还有 CDN，`$remote_addr` 可能全是 CDN 的地址。结果就是所有用户一起争同一份额度。另一个极端，是无条件信任 `X-Forwarded-For`，攻击者换一个请求头就能绕过按 IP 限流。

正确方向是只信任明确的前置代理范围，再通过 realip 模块还原地址：

```nginx
# 配置示意：地址必须替换为实际可信代理网段。
set_real_ip_from 192.0.2.0/24;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

不要把网段换成 `0.0.0.0/0`。实验没有前置代理，因此不启用这段。公司出口、校园网、移动网络的很多用户可能共享公网地址，即使地址可信，按 IP 限流也未必公平。登录后的账号、租户和业务配额通常需要应用层进一步管理。

## 安全响应头能做什么

本课引入 `X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN` 和 Referrer-Policy。这些是浏览器侧的限制，不能自动修复 SQL 注入、越权或跨站脚本。

你可以用 `curl -I` 确认它们出现在成功和拒绝响应中。生产要按站点需求设计 CSP、跨域策略等，别在不了解影响时一次加几十个头，最后连自己的图片和脚本也加载不了。

练习完成后，重新加载第 04 课请求同一个 API，比较是否还出现入口限流。通过改变一条规则验证因果，比看到错误码就到处加超时更可靠。

## 继续阅读

- [请求限速模块](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)
- [连接限制模块](https://nginx.org/en/docs/http/ngx_http_limit_conn_module.html)
- [真实客户端地址模块](https://nginx.org/en/docs/http/ngx_http_realip_module.html)
