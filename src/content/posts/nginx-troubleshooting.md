---
title: Nginx 10：亲手制造 404、502、504，再按日志找到原因
date: '2026-11-25'
summary: 建立从入口到上游的排错顺序，读懂请求耗时、上游耗时与 499。
series: Nginx 从入门到实战
order: 10
tags: [Nginx, 日志, 排障]
level: 运行维护
prerequisites: [nginx-limits-security]
goals:
  - 从响应、配置和日志定位失败发生在哪一层。
  - 复现不同状态码，区分连接失败与等待响应超时。
  - 使用请求编号关联日志，避免盲目调大超时。
---

“网站打不开”不是一个足够具体的故障描述。连接被拒绝、证书不可信、HTTP 404、上游超时，背后的处理方法完全不同。这一课故意制造几种错误，学会从现象往回定位。

实验错误只影响本机的教学入口，后端和博客本身不会因此改动。

## 先把四种错误都看一遍

```bash
bash lesson.sh 10-debug
curl -i http://localhost:8088/missing
curl -i http://localhost:8088/forbidden/
curl -i http://localhost:8088/bad/
curl -i 'http://localhost:8088/slow/?ms=3000'
```

预期依次为 404、403、502、504。每个错误都有明确原因：

| 路径 | 本课故意设置的问题 | 你应该先看什么 |
|---|---|---|
| `/missing` | 静态文件不存在 | location、root 和实际路径 |
| `/forbidden/` | `deny all` | 访问控制规则 |
| `/bad/` | 指向 Nginx 容器里未监听的 3999 端口 | 上游连接和 error_log |
| `/slow/?ms=3000` | 后端等三秒，入口只等一秒 | proxy_read_timeout 和后端耗时 |

看完响应就紧接着读日志：

```bash
docker compose logs --tail 40 gateway
```

502 常能看到连接上游被拒绝；504 常能看到等待上游响应头超时。状态码只是线索，生产的同一个状态码也可能由上游应用返回，要继续核对日志。

## access_log 记请求结果，error_log 记处理异常

实验把访问日志写 stdout，错误日志写 stderr，统一用 `docker compose logs` 查看。主配置中采用 JSON 格式：

```nginx
log_format course escape=json '{"id":"$request_id",'
    '"request":"$request","status":$status,'
    '"duration":"$request_time","upstream":"$upstream_addr",'
    '"upstream_status":"$upstream_status",'
    '"upstream_time":"$upstream_response_time"}';
```

完整文件还记录了缓存和限流状态。`escape=json` 对变量做适合 JSON 的转义，避免请求内容中的引号破坏结构。别把 Authorization、完整 Cookie 等凭证随意写进日志；URL 查询参数也可能含敏感数据，业务设计时要避免把秘密放在 URL。

| 字段 | 怎样理解 |
|---|---|
| `request_time` | Nginx 从接收请求到记录完成的总耗时，可能包含客户端收发时间 |
| `upstream_response_time` | 与上游交互、接收响应的耗时；多次尝试可能有多个值 |
| `upstream_addr` | 这次尝试的后端地址；静态请求通常为 `-` |
| `upstream_status` | 上游尝试的状态，重试时可能有多个 |
| `request_id` | 入口生成的请求编号，用于关联其他系统日志 |

总耗时很长、上游耗时很短，可能是客户端上传慢、下载慢或其他入口阶段等待。两者都很长，再去看应用、数据库和外部依赖。不要看到“响应慢”就直接加 worker。

## 用一个请求编号把记录找出来

本课给响应添加 `X-Request-ID`，也把同一编号传给后端：

```bash
curl -i http://localhost:8088/api/whoami
docker compose logs --since 2m gateway
```

从响应头复制编号，在日志里搜索。返回 JSON 中的 `requestId` 应与响应头一致。真实项目还需要应用把这个编号写进日志，才能继续关联数据库调用或下游请求。

一个超时请求不一定完全没执行。入口已经返回 504，后端仍可能继续计算或写入数据，所以定位超时也要关心取消信号和幂等性。

## 三种超时，分别等什么

```nginx
proxy_connect_timeout 1s;
proxy_send_timeout 5s;
proxy_read_timeout 5s;
```

connect 是建立上游连接的等待；send 是向上游发送数据过程中相邻写操作之间的等待；read 是从上游读取数据时相邻读操作之间的等待。后两者通常不是“整个请求最多只能五秒”。

如果上游每隔几秒就发送一小段数据，整个响应可以持续更久。SSE、下载、WebSocket 要结合各自协议与心跳设计。把所有超时统一改成一天，常常只是让连接积压得更久。

## 499：是客户端先离开了

```bash
curl --max-time 0.2 'http://localhost:8088/slow/?ms=3000'
docker compose logs --tail 8 gateway
```

curl 应因自己的时间限制退出，Nginx 访问日志通常记录 499。它表示在 Nginx 完成响应之前，对端关闭连接。对端可能是浏览器，也可能是更前面一层网关；499 不是标准 HTTP 响应状态，通常是 Nginx 的日志记录。

因此大量 499 不能直接归咎于“用户网络不好”。也可能是应用太慢，让前置代理先等不住了。要对比整条链路的超时设置和耗时分布。

## 配置改错了，先保住旧服务

实验的 `lesson.sh` 会备份当前配置，复制新配置后先执行 `nginx -t`，成功才 reload；失败则恢复旧文件。你也可以手动理解这个过程：

```bash
cp runtime/default.conf runtime/before-change.bak
# 用编辑器修改 runtime/default.conf。
docker compose exec gateway nginx -t
# 只有检查成功后，才执行下面这一条。
docker compose exec gateway nginx -s reload
```

失败时恢复备份，再检查和重载。只恢复磁盘文件但不确认进程使用了什么配置，容易让下一次发布继续踩坑。

日志文件轮转也要区分：宿主机部署通常交给 logrotate，并通过 reopen 信号让 Nginx 重新打开日志；容器输出到标准流时，主要看容器日志驱动的轮转配置。不要让实验式无限日志写满生产磁盘。

## 一套能复用的排查顺序

先用 `curl -v` 判断失败在 DNS、TCP、TLS 还是 HTTP；再确认 Nginx 进程和端口；然后用 `nginx -T` 核对磁盘配置，配合实际请求确认已加载；接着查错误与访问日志；最后从入口容器直接请求上游。

```bash
docker compose ps
docker compose exec gateway nginx -T
docker compose exec gateway wget -qO- http://backend-a:3000/whoami
```

练习：先猜“后端服务没启动”和“后端路径写错”分别更可能得到什么结果，再停服务、恢复服务、改路径进行验证。两种现象能分开，很多线上排障就已经有方向了。

## 继续阅读

- [访问日志模块](https://nginx.org/en/docs/http/ngx_http_log_module.html)
- [代理超时与上游状态](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [upstream 耗时变量](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#variables)
