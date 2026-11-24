---
title: "两个容器怎么互相找到对方？用自己的网络和服务名"
date: "2026-11-24"
summary: "通过用户定义 bridge 网络和 DNS 名称连接 API 与数据库。"
series: "Docker 与 Kubernetes"
order: 13
tags: ["Docker 实战","Docker","Kubernetes"]
level: "Docker 实战"
prerequisites: ["docker-volumes"]
goals: ["不使用容器 IP，让 API 容器通过数据库服务名连接 PostgreSQL。"]
---

API 在一个容器里，PostgreSQL 在另一个。把 `localhost:5432` 填进 API 配置，连接却失败。容器里的 localhost 指向 API 容器自己，不是数据库，也不是你的电脑。

## 概念讲透：它负责什么，不负责什么

容器有自己的网络命名空间，所以容器里的 localhost 指自己。用户定义的 bridge 网络提供隔离网络和容器名解析，API 可以通过 db 这样的稳定名字访问数据库，不必依赖会变化的容器 IP。网络负责连通，不替代身份认证、TLS 和访问策略；同在一个网络也不代表数据库应该接受任何来源。

## 运行过程拆解：从输入到结果

同一用户定义网络内，服务名由 Docker DNS 解析到当前容器地址；连接配置应写服务名和容器端口，而不是宿主机发布端口。删除并重建数据库容器后 IP 可以变化，名字通常保持。宿主机浏览器走的是已发布端口，容器间通信走内部网络，两种路径不要混用；新增网络后还要检查服务是否真的加入它。

## 容器里的 localhost 指向它自己

把两个容器接到同一个用户定义 bridge 网络，Docker 会为网络里的容器提供可解析的名字。Compose 默认替项目创建网络，并把服务名作为发现入口，因此连接串里写 `Host=db`。容器 IP 可以随着重建改变，不应该抄进配置当成固定地址。

## 找到 API 和数据库共用的网络

Compose 示例的 API 配置连接 `db` 服务；数据库端口没有发布到宿主机，同网络里能路由到它的容器仍可访问。下面通过数据库容器实际使用的网络名来检查，不依赖你给解压文件夹取了什么名字。

~~~powershell
docker compose up --build -d --wait
docker network ls
$courseDb = docker compose ps -q db
$courseNetworks = docker inspect $courseDb --format '{{json .NetworkSettings.Networks}}' | ConvertFrom-Json
$courseNetworks.PSObject.Properties.Name | ForEach-Object { docker network inspect $_ }
docker compose exec api printenv ConnectionStrings__Default
~~~

## 怎么确认做对了

`docker network inspect` 的容器列表会同时出现 api 与 db。API readiness 应显示 connected。没有 `ports` 时不能通过宿主机的 `localhost:5432` 访问它。在原生 Linux 上宿主机仍可能直接路由到容器 IP，所以“不发布端口”不等于访问控制策略。

## 案例推演

API 配置 Host=localhost，单独运行没问题，放进 Compose 后连不上数据库。localhost 仍指 API 容器自身，不是宿主机或 db 容器。把连接地址改成网络中的服务名，确认双方加入同一个用户定义网络，再从 API 容器验证 DNS 和端口。不要把动态容器 IP 写死进配置，重建后它可能变化。

## 留一个小练习

临时把 `Host=db` 改成 `Host=localhost`，重建 API。查看 readiness 和日志，再改回 `db`。如果确实要从主机用数据库客户端连接，给数据库单独绑定回环地址并发布一个开发端口，测试后撤掉。

## 没跑通时先查什么

服务名必须在共同网络里解析。使用旧的 `--link` 配置或硬编码容器 IP 会让练习变得脆弱。宿主机发布端口和容器到容器的端口是两件事；先判断请求从哪儿发起，再决定应该使用 service name、localhost 还是宿主机地址。

Compose 默认会为项目创建独立网络。同一网络的容器以服务名互相访问，宿主机上的程序通常不能直接使用那个容器 DNS 名。排查时先写清“请求从哪里发、目标在哪个网络、走哪个端口”，别把容器 IP 记死在配置里。

## 查看 API 容器加入了哪个网络

连接串能证明应用配置里写了什么，inspect 则能确认这个容器实际加入的网络。这里直接看 API 容器的网络和 DNS 配置；同一网络中的服务名才能解析，容器 IP 不要写进长期配置。

~~~powershell
$apiId = docker compose ps -q api
docker inspect $apiId --format '{{json .NetworkSettings.Networks}}'
docker compose exec api cat /etc/resolv.conf
~~~


## Docker 常用网络的工作方式

| 网络类型 | 典型场景 | 容器之间是否有 Docker DNS |
|---|---|---|
| 默认 bridge | 单个容器或快速试跑 | 不应依赖容器名 DNS，建议建用户自定义 bridge |
| 用户自定义 bridge | 单机多容器和 Compose | 可以用容器名或 Compose 服务名找对方 |
| host | 特定 Linux 场景，共享主机网络 | 没有普通 bridge 的端口隔离方式 |
| none | 不需要网络的离线任务 | 无外部网络 |

Compose 默认会为一个项目创建专属网络。同一网络里的 API 可以用 db:5432 访问数据库；数据库无需发布宿主机端口。-p 是把主机入口转发到容器，和容器间网络访问是两条不同路径。

## 用一个独立网络验证服务名解析

以下实验创建两个有明确名称的临时容器：web 提供 HTTP，client 通过网络内 DNS 用 web 名称请求它。命令不会暴露主机端口。

~~~powershell
docker network create net-lab
docker run -d --name web-lab --network net-lab nginx:alpine
docker run --rm --network net-lab busybox:1.36 wget -qO- http://web-lab
docker network inspect net-lab
docker rm -f web-lab
docker network rm net-lab
~~~

预期第三条返回 Nginx 欢迎页 HTML；inspect 中能看到 web-lab 作为网络成员。命令使用的 busybox 镜像第一次运行时需要下载。若提示名称冲突，先确认冲突对象是本课旧实验，再删除对应名字；不要清理所有网络。

## 连接异常时看两端，不要先改 DNS

一个容器访问另一个服务失败，按顺序确认：两者是否加入同一网络；目标名称是否能解析；服务在容器内监听哪个端口；应用是否监听 0.0.0.0；Network/host 防火墙是否允许路径。只有 DNS 解析失败时才重点查名称和网络 DNS；连接被拒绝往往是目标没有监听；超时更可能是路径被丢弃或目标无响应。

对 Compose 服务，先用 docker compose ps 查看服务状态，再检查 docker network inspect 项目网络。把数据库发布到 0.0.0.0 并不是修复 API 到数据库 DNS 的方法，反而扩大了攻击面。

## 生产里怎么用、怎么排障

生产网络要按信任边界分区，数据库不应和无关公开服务共享可随意互通的网络；数据库端口只开放给需要的应用。排查连接失败按 DNS、路由、监听地址、防火墙、安全组、TLS 和账号权限顺序查。调试工具不要长期加入生产网络，诊断结束后清理临时容器并记录访问范围。

## 参考资料

- [Bridge 网络](https://docs.docker.com/engine/network/drivers/bridge/)
- [Docker Compose 网络](https://docs.docker.com/compose/how-tos/networking/)
