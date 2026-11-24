---
title: "用 Compose 一次启动 API 和数据库：把多条 docker run 收进一份文件"
date: "2026-11-24"
summary: "读懂 compose.yaml 中的 service、ports、environment、volumes 和 depends_on。"
series: "Docker 与 Kubernetes"
order: 14
tags: ["Docker 实战","Docker","Kubernetes"]
level: "Docker 实战"
prerequisites: ["docker-network"]
goals: ["使用 Compose 启动两个有关联的服务，并从 API 写入一条记录。"]
---

手敲 API 的 docker run、再手敲数据库的 docker run，第三次就会忘记上次用了哪个卷、哪个网络。Compose 把这些参数放进一份 YAML，让整个本地服务组合可以一起启动、查看和停止。

## 概念讲透：它负责什么，不负责什么

Compose 描述一台机器上的多个服务如何构建、连网、挂载数据和注入配置，它会把 service 名称用于网络 DNS，并管理对应容器。它适合开发、测试和简单单机部署，不提供跨主机调度、节点故障自动迁移和多机高可用。YAML 是期望配置，docker compose config 展开变量后才是最终有效配置。

## 运行过程拆解：从输入到结果

Compose 先解析 YAML 和环境变量，再按服务关系准备网络、卷、镜像，最后创建并启动容器。服务名既是配置单元，也是在项目网络里的发现名称。配置改动后 up 可能重建某些容器，因此数据库是否保留取决于数据是否在命名卷中。compose config 能暴露变量插值后的真实配置，运行它之后要防止把敏感输出直接粘贴到 issue。

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

## 怎么确认做对了

ps 里 API 与数据库都 Up，API 查询返回刚写进去的 note。重新执行 `up -d` 不会每次无条件重建全部服务；Compose 会按配置变更重新创建需要更新的服务。命令成功不代表密码应该用于生产。

## 案例推演

API 和 PostgreSQL 分别能启动，组合起来却偶尔失败。先用 compose config 查看最终环境变量、端口、卷和服务名，再用 ps 与 logs 分析启动结果。应用连接数据库应使用 db:5432，不是 localhost:5432；依赖声明负责启动顺序或健康条件，应用还需在数据库短暂不可用时重试连接。

## 留一个小练习

给 API 服务加一个 Compose profile 或单独的本地调试端口，然后用 `docker compose config` 检查最终 YAML。随后 `docker compose down` 再 up，记录数据是否保留。不要边试边改卷名，否则旧卷还在但新配置可能指向另一个卷。

## 没跑通时先查什么

服务启动不了时先看 `docker compose ps`，随后 `docker compose logs api db`。确认 YAML 缩进、环境变量名称和本机端口没有冲突。Compose 面向本机或单机应用管理，不负责跨多台主机协调副本；需要集群调度时再学 Kubernetes。

`docker compose config` 展开的结果可能包含插值后的敏感值，复制给别人看之前先检查输出。YAML 是可读配置，不是天然安全存储；环境变量也会出现在容器检查结果里，生产密钥还需限制访问并规划轮换。

## 生产里怎么用、怎么排障

单机 Compose 上线前要明确单点主机、磁盘损坏和整机故障怎么处理，不能把 restart: unless-stopped 误当成高可用。限制日志大小、规划卷备份、固定镜像版本、保护 .env，并把升级和回滚步骤写成可重复操作。多个主机和自动调度是编排平台要解决的问题，先判断规模和运维能力再迁移到 Kubernetes。

## 参考资料

- [Compose 概览](https://docs.docker.com/compose/)
- [Compose 文件参考](https://docs.docker.com/reference/compose-file/)
