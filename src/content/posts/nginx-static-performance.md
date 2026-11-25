---
title: Nginx 06：动静分离、浏览器缓存和 gzip，怎么确认真的生效
date: '2026-11-25'
summary: 用响应头和条件请求验证缓存，把 max-age、no-cache、304 和压缩分开理解。
series: Nginx 从入门到实战
order: 6
tags: [Nginx, 浏览器缓存, 性能]
level: 网站部署
prerequisites: [nginx-load-balancing]
goals:
  - 按路径区分静态资源和动态接口。
  - 观察 max-age、ETag、304 和 gzip 响应。
  - 为 HTML 与带版本号的资源设置不同缓存策略。
---

打开一个页面，浏览器可能要请求 HTML、CSS、JavaScript、图片，再请求接口。让所有请求都进入后端应用，不一定划算。静态文件直接由 Nginx 返回，后端专心处理业务，这就是本课的动静分离。

文件仍然可以放在同一台机器上。动静分离说的是请求由谁处理，不要求一开始就买两台服务器。

## 先确认静态请求没有进入后端

```bash
bash lesson.sh 06-static
curl -I http://localhost:8088/assets/app.v1.css
curl -sS http://localhost:8088/api/whoami
docker compose logs --tail 10 gateway
```

静态请求日志里的 `upstream` 是 `-`，因为没有访问后端。API 请求应有上游地址。这比“看页面能不能打开”更能证明分工是否正确。

本课的路径安排是：

```nginx
location ^~ /assets/ {
    try_files $uri =404;
    expires 1h;
}
location /api/ {
    proxy_pass http://backend-a:3000/;
    include /etc/nginx/course/proxy-headers.conf;
}
location = /index.html {
    add_header Cache-Control no-cache;
}
location / {
    try_files $uri $uri/ /index.html;
}
```

`^~ /assets/` 明确保住资源路径，不被后续正则接走。缺失资源返回 404；前端业务路径才回退到入口 HTML。

## 强缓存有效时，可以完全不发请求

执行：

```bash
curl -I http://localhost:8088/assets/app.v1.css
```

应看到类似：

```http
HTTP/1.1 200 OK
Content-Type: text/css
Cache-Control: max-age=3600
Expires: ...
ETag: "..."
Last-Modified: ...
```

`expires 1h` 生成未来的 Expires 和 `max-age=3600`。正常情况下，浏览器可以在有效期内直接使用本地副本，不访问服务器。**不是每次请求都发过去，然后自动拿一个 304。**

curl 默认不维护浏览器那样的缓存，你反复执行它通常仍会发请求。想观察浏览器缓存，用开发者工具的 Network，注意不要勾选 Disable cache；强制刷新也会改变观察结果。

## 304 是“问过服务器以后确认没变”

ETag 是资源版本的验证标记。浏览器需要重新验证时，会把之前拿到的值放进 `If-None-Match`。

下面自动提取 ETag，再模拟一次条件请求：

```bash
etag=$(curl -sSI http://localhost:8088/assets/app.v1.css | \
  tr -d '\r' | sed -n 's/^[Ee][Tt][Aa][Gg]: //p')
curl -i -H "If-None-Match: $etag" http://localhost:8088/assets/app.v1.css
```

文件未修改时，应返回 304，不携带完整资源正文。服务器确认“你那份仍然有效”，浏览器再使用本地内容。

| 指令或状态 | 真正含义 |
|---|---|
| `max-age=3600` | 在缓存规则允许时，可直接复用一小时 |
| `no-cache` | 可以保存，但复用前要重新验证 |
| `no-store` | 不应存储这次响应 |
| `304 Not Modified` | 条件请求验证通过，使用已有副本 |

把 `no-cache` 理解成“绝对不能缓存”，会在排查问题时走偏。它和 `no-store` 不一样。

## 为什么首页不要缓存一年

假设旧 HTML 引用了 `app.v1.js`，你发布新版本后 HTML 改成 `app.v2.js`。如果浏览器一年都不重新验证 HTML，用户就可能一直拿不到新资源引用。

常用做法是：HTML 使用 `no-cache`；带内容哈希、发布后不再改内容的 JS/CSS 使用长缓存；发布时换文件名，并保留一段时间的旧文件，避免正在浏览旧页面的人加载失败。

实验文件叫 `app.v1.js`，只是便于观察，设置一小时缓存。真实构建得到 `app.a81f2c.js` 这类内容哈希文件后，可以考虑更长的 max-age 和 immutable。没有版本化文件名时，不要照抄一年缓存。

## gzip 压缩的是传输内容

本课开启：

```nginx
gzip on;
gzip_min_length 128;
gzip_types text/css application/javascript application/json;
gzip_vary on;
```

`gzip_min_length` 的实验值较低，方便看小文件压缩。正式环境要考虑 CPU 成本和资源大小。JPEG、PNG、ZIP 通常已经压缩，继续 gzip 收益有限。

```bash
curl -sS -H 'Accept-Encoding: gzip' -D - \
  http://localhost:8088/assets/app.v1.css -o /dev/null
curl --compressed -sS http://localhost:8088/assets/app.v1.css
```

第一条应看到 `Content-Encoding: gzip` 和 `Vary: Accept-Encoding`；第二条让 curl 请求并自动解压，终端应得到可读 CSS。只写 `gzip on`，但请求没有声明接受压缩、资源类型不匹配或太小，都可能看不到压缩。

## add_header 有一个经常踩的继承问题

在传统继承规则下，location 自己写了任何 `add_header`，通常就不再继承上一级的同类指令。父层设置安全头，子层只加 Cache-Control，可能把安全头弄没了。

本系列综合配置会在需要的 location 显式引入 `security-headers.conf`，避免依赖新版本特有的继承开关。`always` 可以让响应头覆盖更多错误状态，但不会自动解决继承问题。

练习：修改 CSS 内容，比较前后 ETag，再带旧 ETag 请求。应看到 200 和新正文，而不是 304。最后用浏览器观察“强缓存直接复用”和“发请求得到 304”的不同，别只背状态码。

## 继续阅读

- [expires 和 add_header](https://nginx.org/en/docs/http/ngx_http_headers_module.html)
- [gzip 模块](https://nginx.org/en/docs/http/ngx_http_gzip_module.html)
- [HTTP 缓存解释](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Guides/Caching)
