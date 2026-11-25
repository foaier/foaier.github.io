---
title: Nginx 04：反向代理实战，proxy_pass 后面的斜杠到底改了什么
date: '2026-11-25'
summary: 接通前端和后端，观察实际收到的路径、Host、客户端地址与请求编号。
series: Nginx 从入门到实战
order: 4
tags: [Nginx, 反向代理, HTTP]
level: 代理实战
prerequisites: [nginx-static-location]
goals:
  - 通过一个网站入口同时提供页面与后端接口。
  - 推导 proxy_pass 有无 URI 时的路径变化。
  - 理解转发头、容器网络和 WebSocket 的特殊要求。
---

现在页面已经能打开，但点击请求后端还没反应。这一课把 `/api/` 接起来。你的浏览器只访问 Nginx，Nginx 再访问内部的 `backend-a:3000`。

后端是实验包中的一个小 Node.js 服务，只返回节点名称、收到的路径和请求头。选择它不是为了学习 Node，而是让代理行为直接出现在返回结果里。换成 Spring Boot 或 ASP.NET Core，道理一样。

## 先接通，再看每一行负责什么

```bash
bash lesson.sh 04-proxy
curl -sS 'http://localhost:8088/api/whoami?name=foaier'
```

返回的 JSON 应包含：

```json
{
  "node": "backend-a",
  "path": "/whoami",
  "query": "?name=foaier",
  "host": "localhost",
  "forwardedProto": "http"
}
```

时间、客户端地址和请求编号会随环境变化。浏览器地址栏仍是 `localhost:8088`，你也可以回到首页点击按钮，看到同一份结果。

对应配置位于 `lessons/04-proxy.conf`：

```nginx
location /api/ {
    proxy_pass http://backend-a:3000/;
    include /etc/nginx/course/proxy-headers.conf;
}
```

`backend-a` 是 Compose 服务名，容器网络里的 DNS 会把它解析到对应容器。这里不能写 `localhost:3000`：对 Nginx 来说，localhost 是 Nginx 自己的容器，不是你的电脑，也不是另一个后端容器。

## 尾部斜杠不是风格问题，它改变路径

先比较两条请求：

```bash
curl -sS http://localhost:8088/api/whoami
curl -sS http://localhost:8088/keep/whoami
```

第一条后端看到 `/whoami`，第二条看到 `/keep/whoami`。配置区别在这里：

```nginx
location /api/ {
    proxy_pass http://backend-a:3000/;
}
location /keep/ {
    proxy_pass http://backend-a:3000;
}
```

| 写法 | 请求 `/api/users?id=7` 到后端后 |
|---|---|
| `location /api/` + `proxy_pass http://backend-a:3000;` | `/api/users?id=7` |
| 同一 location + `proxy_pass http://backend-a:3000/;` | `/users?id=7` |
| 同一 location + `proxy_pass http://backend-a:3000/v1/;` | `/v1/users?id=7` |

背后的规则是：`proxy_pass` 带 URI 时，用这个 URI 替换匹配到的 location 前缀。只有主机和端口、没有 URI 时，通常保留原请求路径。正则 location、变量和 rewrite 组合另有规则，先不要把这张表直接套进去。

实际项目里，后端接口本来就以 `/api/` 开头，就保留它；后端只认识 `/users`，才去掉入口的 `/api/`。应当对照后端路由决定，不要凭感觉加斜杠。

## 请求头为什么也要转发

实验的 `includes/proxy-headers.conf` 内容如下：

```nginx
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Request-ID $request_id;
```

`Host` 告诉后端用户访问的站点名；`X-Forwarded-Proto` 说明外部是 HTTP 还是 HTTPS；请求编号方便把入口日志和应用日志连起来。`Connection ""` 清除逐跳连接头，配合 HTTP/1.1 让后续上游连接复用成为可能。

这里故意覆盖 `X-Forwarded-For`，因为实验的 Nginx 是第一个可信入口。客户端自己伪造的地址不能当作事实。你可以验证：

```bash
curl -sS -H 'X-Forwarded-For: fake-client' http://localhost:8088/api/whoami
```

结果里的 `forwardedFor` 不应是 `fake-client`。如果前面还有 CDN 或负载均衡器，要先定义可信代理的地址范围，再正确还原客户端地址；不能信任互联网上任意请求附带的转发头。

`$host` 通常不带外部端口，实验访问 8088，后端看到的 Host 是 localhost。需要生成绝对 URL 的应用，应明确配置外部地址或可信转发协议，而不是随意拼接一个可能由用户控制的 Host。

## 同一个入口，前端为什么通常不需要配 CORS

页面来自 `http://localhost:8088`，JavaScript 请求 `/api/whoami` 也发给这个来源，浏览器没有跨源。Nginx 到后端是服务器之间的请求，不受浏览器同源策略直接约束。

如果你在前端写死 `http://localhost:3000`，就绕过了入口，又变成不同端口的跨源请求。所以部署时优先让前端使用 `/api/...` 这类相对路径，并让入口统一路由。

## WebSocket 不能只复制普通代理配置

WebSocket 需要协议升级。真实后端支持 WebSocket 时，通常在 `http` 层配置 map，再在对应 location 显式传递 Upgrade 和 Connection：

```nginx
# 放在 http 层，不是 server 内。
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
# 放在 server 内。
location /ws/ {
    proxy_pass http://websocket_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 60s;
}
```

这是接入已有 WebSocket 服务的配置示意，实验后端没有实现该协议，不要把 `websocket_backend` 原样加进本课配置。长连接还需要应用心跳；把超时无限调大不能代替心跳和连接清理。

## 接不通时，按这三个位置检查

```bash
docker compose ps
docker compose exec gateway wget -qO- http://backend-a:3000/whoami
docker compose logs --tail 20 gateway backend-a
```

容器内直接请求成功、外部失败，重点查代理规则。容器内也失败，先查服务名、应用监听地址和进程。后端返回 404，先看它收到的 `path`；不要一上来就怀疑防火墙。

练习：把 `/api/` 的目标改成 `http://backend-a:3000/v1/`，预测 `/api/orders/42` 会变成什么路径，重载后用返回的 JSON 验证，再恢复配置。

## 继续阅读

- [proxy_pass 与代理请求头](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [WebSocket 代理](https://nginx.org/en/docs/http/websocket.html)
- [可信代理与真实客户端地址](https://nginx.org/en/docs/http/ngx_http_realip_module.html)
