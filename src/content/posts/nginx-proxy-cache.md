---
title: Nginx 08：把公共接口缓存起来，别把用户数据也缓存了
date: '2026-11-25'
summary: 实测 MISS、HIT、BYPASS，解释缓存键、有效期、跳过读取与禁止写入的区别。
series: Nginx 从入门到实战
order: 8
tags: [Nginx, 代理缓存, 性能]
level: 进阶实践
prerequisites: [nginx-https]
goals:
  - 区分浏览器缓存和 Nginx 代理缓存。
  - 根据响应头验证缓存命中与过期。
  - 对携带 Cookie 或 Authorization 的请求绕过缓存。
---

上一课之前讲的 `expires`，主要是告诉浏览器怎样复用响应。这一课缓存的位置变了：Nginx 把后端响应保存下来，后续请求可能不用再访问后端。

适合先练的对象是公开、不随账号变化、允许短暂延迟的内容，例如公共分类列表。余额、购物车、个人资料不能因为“读得多”就套上同一份缓存。

## 建立一个看得见时间变化的实验

```bash
bash lesson.sh 08-cache
curl -i 'http://localhost:8088/cached/time?case=first'
curl -i 'http://localhost:8088/cached/time?case=first'
```

第一次应得到 `X-Cache: MISS`，第二次是 `HIT`。两次 JSON 里的 time 相同，说明第二次复用了第一次存下来的响应。等十秒以上再请求，通常会看到 `EXPIRED`，后端时间也更新了；如果缓存文件已经被移除，也可能重新 MISS。

第一次就 HIT 时，说明这个地址刚刚被请求过。换一个查询参数，例如 `case=second`，再观察。

## 缓存目录和缓存键，各管一件事

配置分两处，第一处位于 `http` 层：

```nginx
proxy_cache_path /var/cache/nginx/course
    levels=1:2 keys_zone=course_cache:10m
    max_size=64m inactive=10m use_temp_path=off;
map $http_authorization $has_auth { "" 0; default 1; }
map $http_cookie $has_cookie { "" 0; default 1; }
```

`keys_zone` 主要保存缓存键与元数据，不是把所有响应正文都放进 10MB 内存。正文通常放磁盘。`max_size` 限制磁盘缓存的目标规模，后台管理过程会清理，不能把它当严格实时的磁盘硬配额。

`inactive=10m` 表示一段时间没人访问的项目可以被清理，和内容“新鲜十秒”是不同维度。

第二处在要缓存的 location：

```nginx
location /cached/ {
    proxy_pass http://backend-a:3000/public/;
    include /etc/nginx/course/proxy-headers.conf;
    proxy_cache course_cache;
    proxy_cache_key "$scheme|$host|$request_uri";
    proxy_cache_valid 200 10s;
    proxy_cache_bypass $has_auth $has_cookie;
    proxy_no_cache $has_auth $has_cookie;
    proxy_cache_lock on;
    add_header X-Cache $upstream_cache_status always;
}
```

缓存键包含协议、站点和完整请求 URI，包括查询参数。`/cached/time?city=beijing` 和 `?city=shanghai` 会分开。如果接口还根据语言、租户或其他请求头返回不同内容，就要把真正影响响应的维度纳入设计，不能只复制这个键。

## bypass 和 no_cache 为什么要一起写

| 指令 | 控制什么 |
|---|---|
| `proxy_cache_bypass` | 这次请求是否跳过读取现有缓存 |
| `proxy_no_cache` | 这次后端响应是否禁止写进缓存 |

只设置“不读缓存”，后端拿到的个人化响应仍可能被写进去；只设置“不写缓存”，请求又可能先读到了不合适的旧缓存。这个实验对携带任何 Cookie 或 Authorization 的请求同时设置两者。

```bash
curl -i -H 'Cookie: demo=1' 'http://localhost:8088/cached/time?case=first'
curl -i -H 'Authorization: Bearer demo' 'http://localhost:8088/cached/time?case=first'
curl -i http://localhost:8088/api/private/profile
```

前两条应看到 BYPASS。第三条走未启用缓存的 `/api/`，后端会返回 `Cache-Control: private, no-store` 和示例 Set-Cookie。

Nginx 自身也会依据某些请求与响应头决定是否缓存，例如 Authorization、Set-Cookie、Cache-Control。不要为了提高命中率随意添加 `proxy_ignore_headers`，那可能绕开后端对私有内容的保护。

## 多个请求同时没命中，会怎样

缓存刚失效时，大量请求可能一起涌向后端。`proxy_cache_lock on` 让同一缓存项的填充有协调机制，减少同时回源。但锁等待和超时也有边界，它不是把所有并发永久排成一条队。

可以在后端增加耗时，再用多个并发请求看日志；判断是否有效，要观察回源次数、延迟和错误率，不是只看 HIT 比例。若后端本来响应很快、请求又很分散，缓存可能只是增加了维护成本。

## 上游坏了，要不要返回过期内容

公开资讯可以考虑短时使用旧内容：

```nginx
# 可选策略，确认业务允许旧数据后再加入缓存 location。
proxy_cache_use_stale error timeout http_502 http_503 http_504 updating;
```

这能在某些上游异常时继续服务旧副本，但它改变了业务语义。库存、账户状态等内容是否允许旧值，不能由运维单方面决定。本课默认配置没有启用 stale，避免你还没意识到就一直拿旧数据。

清缓存也不是“每次发布就删掉整台机器的缓存目录”。简单场景可以等短 TTL、改变资源版本或缓存命名空间。专门的 purge 能力依版本、发行版与模块而异，不能认为任意开源安装都有相同指令。

## 缓存不命中时先看什么

先确认请求落到了开启缓存的 location，再看请求是否有 Cookie/Authorization、后端是否返回禁止缓存的头、状态码是否被 `proxy_cache_valid` 覆盖。之后才查缓存目录权限和日志。

练习：给同一路径分别加 `?page=1`、`?page=2`，各请求两次。应得到两组独立的 MISS/HIT。再对相同 URL 加 Cookie，确认不会读取匿名缓存。能解释这三个结果，才算真正理解了缓存键和绕过条件。

## 继续阅读

- [proxy_cache 与缓存控制指令](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache)
- [HTTP 缓存规则](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Guides/Caching)
