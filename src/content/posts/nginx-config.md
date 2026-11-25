---
title: Nginx 02：看懂配置层级，学会检查、重载和虚拟主机
date: '2026-11-25'
summary: 搞清 main、events、http、server、location 的分工，用同一个端口部署两个站点。
series: Nginx 从入门到实战
order: 2
tags: [Nginx, 配置, 虚拟主机]
level: 基础操作
prerequisites: [nginx-start]
goals:
  - 找到配置文件、运行日志与生效配置。
  - 解释 master、worker 和 reload 的关系。
  - 用 Host 请求头验证多个虚拟主机。
---

复制配置最常见的错误，是把一段本来属于 `http` 的内容放进了 `server`。Nginx 不是“所有指令写进一个文件都行”，它有明确的层级。先把这个结构看清楚，后面的配置才不会越改越乱。

本课继续使用第一课的实验目录。容器没运行就先执行 `docker compose start`。

## 配置像套盒子，每层都有职责

实验中的 `nginx.conf` 是主文件。下面是一份能说明结构的最小例子，**用于阅读，不需要替换实验文件**：

```nginx
worker_processes 2;
events {
    worker_connections 1024;
}
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    server {
        listen 80;
        server_name course.local;
        root /srv/site;
        location / {
            try_files $uri $uri/ =404;
        }
    }
}
```

| 层级 | 主要负责 | 本例里的指令 |
|---|---|---|
| main，最外层 | 进程、全局日志、PID | `worker_processes` |
| events | 连接处理 | `worker_connections` |
| http | HTTP 共用配置、日志格式、后端组 | `include`、`default_type` |
| server | 一个监听地址上的站点 | `listen`、`server_name` |
| location | 某类请求路径 | `/`、`/api/`、`/assets/` |

分号结束一条指令，花括号包住一个配置块，`#` 后面是注释。`include` 相当于把另一个文件的内容放到当前位置，所以被引入的文件也必须符合当前位置的语法。

实验的 `http` 内有 `include /etc/nginx/conf.d/*.conf;`。因此 `lessons/*.conf` 的内容通常直接从 `server` 或 `upstream` 开始，不再套一层 `http`。

## 文件在磁盘上，不等于已经生效

先看这些命令：

```bash
docker compose exec gateway nginx -v
docker compose exec gateway nginx -V
docker compose exec gateway nginx -t
docker compose exec gateway nginx -T
```

`-v` 看版本；`-V` 还显示编译参数与模块；`-t` 检查语法和配置引用的文件；`-T` 检查并打印展开后的配置，包括 `include` 进来的文件。

`-T` 读的是磁盘配置，不是内存快照。你刚改完文件还没 reload，它打印新文件，不代表旧 worker 已经开始使用新规则。最终还要用 curl 验证行为。生产配置可能包含内部域名等信息，也不应把完整 `-T` 输出随手贴到公开页面。

正确的修改顺序是：

```bash
docker compose exec gateway nginx -t && \
docker compose exec gateway nginx -s reload
```

`&&` 表示前一条成功才执行后一条。不要用“先重启再看看能不能起来”代替配置检查。

## reload 为什么不等于 restart

Nginx 通常有一个 master 和多个 worker。master 管理配置和子进程；worker 接收连接、处理请求。worker 利用事件机制，在等待网络数据时继续处理其他连接，不是每来一个请求就新建一个进程。

reload 时，master 尝试加载新配置；成功后启动新 worker，让旧 worker 处理完已有连接后退出。长连接可能让旧 worker 多留一阵。配置加载失败时，原配置通常仍继续服务，但你必须检查错误日志确认。

| 操作 | 用途 |
|---|---|
| `nginx -t` | 检查配置，不切换业务规则 |
| `nginx -s reload` | 平滑应用新配置 |
| `nginx -s quit` | 优雅退出，等待正在处理的请求结束 |
| `nginx -s stop` | 快速停止，现有连接可能中断 |
| `docker compose restart gateway` | 重启容器，和配置重载不是一回事 |

实验中若执行 stop/quit，Nginx 主进程退出后容器也会停止。恢复用 `docker compose start gateway`。

## 实战：同一个 8088 端口，两个不同站点

加载完整配置：

```bash
bash lesson.sh 02-config
curl -i -H 'Host: course.local' http://127.0.0.1:8088/
curl -i -H 'Host: admin.local' http://127.0.0.1:8088/
curl -i -H 'Host: unknown.local' http://127.0.0.1:8088/
```

依次得到首页、`admin virtual host`、404。三个请求走同一个地址和端口，区别只在 Host 请求头。

核心配置是：

```nginx
server {
    listen 80 default_server;
    server_name _;
    return 404;
}
server {
    listen 80;
    server_name course.local;
    root /srv/site;
    location / { try_files $uri $uri/ =404; }
}
server {
    listen 80;
    server_name admin.local;
    default_type text/plain;
    location / { return 200 "admin virtual host\n"; }
}
```

`default_server` 是这个监听地址和端口的兜底站点。`server_name _` 中的下划线不是“匹配一切”的魔法符号，真正决定兜底的是 `default_server`。

Nginx 先根据监听地址、端口挑候选站点，再根据请求中的主机名匹配。`server_name` 也不会替你添加 DNS 记录。用 curl 的 `-H` 只是绕开改 hosts 文件这一步，浏览器想直接访问 `course.local`，仍需要名称解析。

## 不要把连接数直接叫成并发用户数

`worker_connections` 限制每个 worker 的连接数，包括到客户端和上游的连接；还受文件描述符等系统限制。一个反向代理请求可能占客户端连接和上游连接，HTTP/2 又能在一条连接上复用多个请求。

因此不能拿“worker 数 × connections，再固定除以 2 或 4”当作并发用户容量。实验中两个 worker 是方便观察；生产通常从 `worker_processes auto` 开始，根据 CPU 配额、连接、请求耗时和压测结果调整。

动手练一次：把 `admin virtual host` 改成自己的文字，执行检查和 reload，再发送请求。接着故意删掉分号，运行 `nginx -t`，确认它指出文件和行号；补回分号后重新检查。这个小练习比背一张参数表更有用。

## 继续阅读

- [Nginx 命令行参数](https://nginx.org/en/docs/switches.html)
- [Nginx 控制与平滑重载](https://nginx.org/en/docs/control.html)
- [Nginx 如何处理请求](https://nginx.org/en/docs/http/request_processing.html)
