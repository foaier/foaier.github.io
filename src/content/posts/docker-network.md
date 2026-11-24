---
title: 两个容器怎么互相找到对方？用自己的网络和服务名
date: '2026-11-24'
summary: 通过用户定义 bridge 网络和 DNS 名称连接 API 与数据库。
series: Docker 与 Kubernetes
order: 13
tags:
  - Docker 实战
  - Docker
  - Kubernetes
level: Docker 实战
prerequisites:
  - docker-volumes
goals:
  - 不使用容器 IP，让 API 容器通过数据库服务名连接 PostgreSQL。
---

API 在一个容器里，PostgreSQL 在另一个。把 `localhost:5432` 填进 API 配置，连接却失败。容器里的 localhost 指向 API 容器自己，不是数据库，也不是你的电脑。

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

## 参考资料

- [Bridge 网络](https://docs.docker.com/engine/network/drivers/bridge/)
- [Docker Compose 网络](https://docs.docker.com/compose/how-tos/networking/)
