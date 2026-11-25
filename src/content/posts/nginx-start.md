---
title: Nginx 01：它到底管什么？先让第一个网页跑起来
date: '2026-11-25'
summary: 从浏览器发出一个请求开始，分清 Web 服务器、代理和负载均衡，再亲手启动 Nginx。
series: Nginx 从入门到实战
order: 1
tags: [Nginx, HTTP, 入门]
level: 零基础
prerequisites: []
goals:
  - 说清 Nginx 在浏览器和应用之间负责什么。
  - 启动实验站，观察一次成功请求和一次 404。
  - 分清本机端口、容器端口、静态文件和后端接口。
---

你写好了一个网页，双击 HTML 文件就能打开。那为什么上线还需要 Nginx？因为其他人没法双击你电脑里的文件。他们访问的是一个网络地址，需要有程序一直监听端口，收到请求后把内容送回去。

Nginx 就能做这件事。它还可以接住请求，再转交给 Java、.NET、Node.js 等应用。应用写成什么语言，不影响这层分工。

这套教程先做一个小站，再加上代理、多个后端、HTTPS 和故障演练。示例配置都在同一个实验包里，每一课都有完整文件，可以回到任意一课重做。

## 一个请求会经过哪里

先看最简单的情况：

```text
浏览器 GET /index.html
       ↓
Nginx 监听 80 端口
       ↓ 读取文件
/srv/site/index.html
       ↓
浏览器收到 HTTP 200 和 HTML
```

这里的 HTML、CSS、图片都是磁盘上已经存在的文件，叫**静态资源**。Nginx 找到它们，读取并返回，不需要查询数据库。

如果你请求的是“查我的订单”，结果跟登录账号、数据库有关，就要交给应用计算。这是动态请求：

```text
浏览器 /api/orders → Nginx → 后端应用 → 数据库
                         ← 返回 JSON ←
```

“动静分离”就是把这两种请求分开处理。不是看页面有没有动画，也不是把所有 `.html` 都当成静态业务。

## 几个常听到的词，先对上号

| 名称 | 谁在用它 | 一个具体例子 |
|---|---|---|
| Web 服务器 | 网站提供者 | 读取首页文件，返回给浏览器 |
| 正向代理 | 发起请求的客户端 | 浏览器配置一个代理，由代理替它访问外部网站 |
| 反向代理 | 提供服务的一方 | 用户访问一个网站地址，Nginx 把请求交给内部应用 |
| 负载均衡 | 有多个后端的网站 | 把请求分给 A、B 两台应用，避免全压在一台上 |
| HTTPS 入口 | 网站提供者 | 在 Nginx 上配置证书，完成浏览器到入口的 TLS 加密 |

反向代理不会让浏览器地址栏自动变成后端地址。地址栏变化通常是 301、302、307、308 重定向，那是另一回事。

Nginx 擅长处理很多网络连接，但“能扛几万并发”不是装好就兑现的指标。文件大小、网络、TLS、后端耗时都会影响结果。先把请求链路跑通，后面再学怎么观察瓶颈。

## 准备一个不会影响其他服务的实验环境

主线使用 Docker Compose，把 Nginx 和两个小后端放在隔离网络里。后端没有数据库，不需要账号或密钥。Windows 使用 Docker Desktop 和 WSL 2 的 Ubuntu 终端；macOS/Linux 使用 Bash 终端。

先运行：

```bash
docker version
docker compose version
openssl version
curl --version
```

`docker version` 应同时显示 Client 和 Server。只有 Client、后面报无法连接，说明 Docker 引擎还没启动。如果还没装 Docker，可以先看[安装与环境准备](/articles/docker-install/)。Ubuntu 缺工具时执行：

```bash
sudo apt update
sudo apt install -y curl unzip openssl
mkdir -p ~/nginx-course
```

下载 [Nginx 实验源码](/downloads/nginx-labs.zip)，把 ZIP 放到刚建的 `~/nginx-course`，然后执行：

```bash
cd ~/nginx-course
unzip nginx-labs.zip
cd nginx-labs
bash init.sh
docker compose ps
```

`init.sh` 做三件事：准备当前配置目录，生成后续 HTTPS 实验用的本地证书，启动三个容器。证书只用于本地练习，不会被浏览器自动信任。

初次运行需要下载镜像。镜像下载失败时先解决 Docker 的网络连接，修改 Nginx 配置不会修复镜像仓库超时。

## 亲手发出第一条请求

在同一目录运行：

```bash
curl -i http://localhost:8088/
curl -I http://localhost:8088/assets/app.v1.css
curl -i http://localhost:8088/not-here
```

第一条应得到 `HTTP/1.1 200 OK`，后面跟着网页 HTML。第二条只取响应头，注意 `Content-Type: text/css`。第三条得到 404，说明请求已经到达 Nginx，只是文件不存在。

`curl` 的几个参数会一直用到：

| 参数 | 用途 |
|---|---|
| `-i` | 响应头和正文一起看 |
| `-I` | 发送 HEAD 请求，只看响应头；它不等同于 GET |
| `-H '名字: 值'` | 添加请求头，后面用来测试虚拟主机、缓存等 |
| `-v` | 展示连接和协议细节，排查 HTTPS 时很有用 |
| `-sS` | 隐藏进度条，但保留错误 |
| `-f` | HTTP 400 及以上视为失败，适合脚本验收 |

浏览器打开 `http://localhost:8088`，应看到“网页已经跑起来了”。此时点“请求后端”会失败，这是正常的：第一课只配置了静态文件，还没有把 `/api/` 接到后端。

## 8088 和 80 为什么不同

实验的端口映射是：

```yaml
ports:
  - "127.0.0.1:8088:80"
```

左边的 8088 是你电脑的入口，右边的 80 是 Nginx 在容器内监听的端口。浏览器访问的是你电脑，所以用 8088。只绑定 `127.0.0.1` 是为了本机实验，其他电脑不能直接访问。

两个后端没有发布端口，只能从实验网络内访问。后面会看到：不开放后端到公网，也能通过 Nginx 使用它们。

## 换一行文字，确认文件真的由你控制

用编辑器打开实验目录的 `site/index.html`，把标题改成自己的一句话，保存后再次运行：

```bash
curl -sS http://localhost:8088/
docker compose logs --tail 5 gateway
```

应看到新文字和本次访问日志。修改静态文件不需要 reload；修改 Nginx 配置才需要重新加载。浏览器仍显示旧内容时先强制刷新，对照 curl 的结果判断是否是浏览器缓存。

暂停实验执行 `docker compose stop`，继续用 `docker compose start`。彻底移除这套实验容器和网络用 `docker compose down`，它不会删除你电脑上的源码和证书。后续文章默认终端位于 `nginx-labs` 目录。

## 如果以后要直接装在 Linux 上

这是另一种安装方式，主线实验不需要执行。以全新的 Ubuntu 24.04 实验机为例，系统软件包会同时安装程序、默认配置和 systemd 服务：

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
sudo nginx -t
curl -I http://127.0.0.1/
systemctl status nginx --no-pager
```

`enable` 设置开机启动，`--now` 表示立即启动；`status` 查看服务状态。系统包通常把主配置放在 `/etc/nginx/nginx.conf`，日志放在 `/var/log/nginx/`，但最终应使用 `nginx -V`、`nginx -T` 核对实际路径。

本机访问正常、远端访问失败时，再检查监听地址、路由和入口网络规则；开放需要的 HTTP/HTTPS 流量即可，不用把防火墙全部关闭。云服务器还可能有独立的安全组规则。

Ubuntu 仓库版本与官方容器镜像可能不同。后面的 `http2 on`、upstream 动态解析等配置有版本要求，所以不要把整套容器配置原样覆盖到系统包。源码编译更适合有自定义模块或构建要求的情况，先学会安装方式对应的目录和服务管理，再考虑自己维护编译依赖与升级。

## 继续阅读

- [Nginx 官方入门指南](https://nginx.org/en/docs/beginners_guide.html)
- [Nginx 官方容器镜像说明](https://hub.docker.com/_/nginx)
- [爵岚的尚硅谷 Nginx 基础笔记](https://www.cnblogs.com/yayuya/p/17998459)：本系列的主题参考，实验和讲解按当前环境重新编写。
