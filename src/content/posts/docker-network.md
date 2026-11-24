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

## 留一个小练习

临时把 `Host=db` 改成 `Host=localhost`，重建 API。查看 readiness 和日志，再改回 `db`。如果确实要从主机用数据库客户端连接，给数据库单独绑定回环地址并发布一个开发端口，测试后撤掉。

## 没跑通时先查什么

服务名必须在共同网络里解析。使用旧的 `--link` 配置或硬编码容器 IP 会让练习变得脆弱。宿主机发布端口和容器到容器的端口是两件事；先判断请求从哪儿发起，再决定应该使用 service name、localhost 还是宿主机地址。

Compose 默认会为项目创建独立网络。同一网络的容器以服务名互相访问，宿主机上的程序通常不能直接使用那个容器 DNS 名。排查时先写清“请求从哪里发、目标在哪个网络、走哪个端口”，别把容器 IP 记死在配置里。

## 参考资料

- [Bridge 网络](https://docs.docker.com/engine/network/drivers/bridge/)
- [Docker Compose 网络](https://docs.docker.com/compose/how-tos/networking/)
