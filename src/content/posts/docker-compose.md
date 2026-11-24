---
title: 用 Compose 一次启动 API 和数据库：把多条 docker run 收进一份文件
date: '2026-11-24'
summary: 读懂 compose.yaml 中的 service、ports、environment、volumes 和 depends_on。
series: Docker 与 Kubernetes
order: 14
tags:
  - Docker 实战
  - Docker
  - Kubernetes
level: Docker 实战
prerequisites:
  - docker-network
goals:
  - 使用 Compose 启动两个有关联的服务，并从 API 写入一条记录。
---

手敲 API 的 docker run、再手敲数据库的 docker run，第三次就会忘记上次用了哪个卷、哪个网络。Compose 把这些参数放进一份 YAML，让整个本地服务组合可以一起启动、查看和停止。

## 把多个服务的运行参数写在一起

Compose 文件描述的是服务关系，不是再发明一个新的容器。`build` 指定本地 API 镜像如何生成；`db` 使用官方 PostgreSQL 镜像；`volumes` 保存数据库文件；`depends_on` 描述启动关系。服务名同时成为容器网络中的 DNS 名称。

## 启动 API 和 PostgreSQL

在课程目录先检查合并后的配置，再在后台启动。之后调用 API 添加一条虚构记录，并查看服务状态。第一次 build 会还原 NuGet 包和下载基础镜像；不要把它的耗时与后续缓存构建混为一谈。

~~~powershell
docker compose config
docker compose up --build -d --wait
docker compose ps
Invoke-RestMethod -Method Post -Uri http://localhost:8080/visits -ContentType "application/json" -Body '{"note":"compose works"}'
Invoke-RestMethod http://localhost:8080/visits
~~~

## 启动后查服务状态与各自日志

主练习已经启动过 Compose 服务，这里检查全部容器（也包括已退出的容器）并分别读 API、数据库的最近日志。这样更容易看出是服务没创建、启动即退出，还是应用启动后报错。

~~~powershell
docker compose ps --all
docker compose logs --tail 50 api db
~~~

## Compose 文件里的每一层各管什么

| 配置 | 负责什么 | 课程例子 |
|---|---|---|
| services | 定义 API、数据库等可运行服务 | api、db |
| image / build | 使用现有镜像，或从 Dockerfile 构建 | api 用 build，db 用 postgres 镜像 |
| environment | 给进程传入配置 | API 连接字符串、数据库名 |
| ports | 发布到宿主机的网络入口 | API 的 8080 只绑定本机回环地址 |
| volumes | 把数据放到容器生命周期之外 | PostgreSQL 使用 course-data |
| networks | 给同项目服务提供隔离网络和 DNS | API 通过 db 服务名访问数据库 |
| depends_on / healthcheck | 控制初始启动顺序并判定服务健康 | API 等待数据库健康 |

Compose 的项目名是隔离边界之一。同一目录默认会使用目录名作为项目名，并为服务、网络和卷加前缀；使用 -p 指定名字可以让不同实验互不冲突。

## 先解析配置，再启动服务

Compose 会处理 YAML、环境变量替换、默认网络和卷。启动前先确认它最终解析出的服务名、镜像和端口。完整 config 可能包含环境变量里的密码，只在本机查看，分享前要脱敏。

~~~powershell
docker compose config --services
docker compose config --images
docker compose ps
docker compose up --build -d --wait
docker compose ps
docker compose logs --tail 30 api db
~~~

首次 up 会构建 API 镜像、拉取 PostgreSQL，再创建网络、卷和容器；之后命令会复用可用镜像。--wait 等待容器达到 running/healthy 条件，仍需从 API 请求 /health/ready 和业务接口验证真实链路。

## 服务名就是 Compose 网络里的稳定地址

Compose 会把服务名注册到项目网络的 DNS。API 使用 Host=db、Port=5432 连接数据库，不应写数据库容器 IP；IP 会随重建变化。容器内访问 db:5432 不会经过主机发布端口。如果数据库没有 ports 映射，仍能被同网络的 API 访问。

课程的 API 对宿主机只绑定 127.0.0.1:8080，数据库没有对宿主机发布端口。这样本机可以练习 HTTP 接口，数据库则保持在内部网络。生产环境还需限制其他服务是否能加入项目网络。

## 多环境配置不要把本地密码提交进仓库

Compose 支持从环境变量插值。可用 .env 放非秘密的本机参数，但 .env 不是安全的秘密管理系统；检查 .gitignore，避免把个人凭据提交。部署环境应从 GitHub Environment、云 Secret Manager 或受保护的运行平台注入凭据。

## 参考资料

- [Compose 概览](https://docs.docker.com/compose/)
- [Compose 文件参考](https://docs.docker.com/reference/compose-file/)
