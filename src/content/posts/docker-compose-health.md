---
title: 数据库容器先启动，不代表它已经能接请求
date: '2026-11-24'
summary: 用健康检查和 service_healthy 处理启动时序，区分进程启动与依赖就绪。
series: Docker 与 Kubernetes
order: 15
tags:
  - Docker 实战
  - Docker
  - Kubernetes
level: Docker 实战
prerequisites:
  - docker-compose
goals:
  - 实测 PostgreSQL 健康检查，并解释 depends_on 为什么要等待 healthy。
---

`docker compose up` 经常同时启动 API 与数据库。数据库进程先出现，并不代表它已经初始化数据库、打开端口并可以接受连接。API 若马上开始调用，可能启动一次就报错退出。单纯写 `depends_on: db` 只表达顺序，不一定表达“数据库已经准备好”。

## 先启动与已就绪是两种状态

Compose 健康检查会周期运行一个命令，并把状态标成 starting、healthy 或 unhealthy。`condition: service_healthy` 可以让依赖方等到健康条件满足再启动。这里用 `pg_isready` 检查 PostgreSQL 接受连接。健康检查也要设置合理超时与重试，不能把一台慢机器误判为永久坏掉。

## 查看数据库健康检查的历史

课程 Compose 已给 db 配置 pg_isready 检查，api 依赖 healthy 状态。首次初始化数据库时可以观察 starting 到 healthy 的变化。`start_period` 是失败计数的宽限期，不是强制等待时间；期间一旦检查成功，容器仍能提前变成 healthy。

~~~powershell
docker compose up --build -d
docker compose ps
$courseDb = docker compose ps -q db
docker inspect $courseDb --format "{{json .State.Health}}"
~~~

## 单独检查健康状态，再请求 API 就绪接口

健康检查历史能解释数据库为什么还处在 starting 或 unhealthy。下方只查询当前状态与应用 readiness；如果数据库已 healthy、API 仍未就绪，就继续看连接配置和 API 日志。

~~~powershell
$dbId = docker compose ps -q db
docker inspect $dbId --format 'Database health={{.State.Health.Status}}'
Invoke-RestMethod http://localhost:8080/health/ready
~~~

## Healthcheck 到底测的是谁

healthcheck 在容器内部按间隔运行一条检查命令，依据退出码更新 Health 状态。它检查的是服务是否满足你定义的条件，而不是 Docker daemon 是否正常，也不保证外部网络、TLS、登录权限和真实业务数据都可用。

| 参数 | 作用 | 调得太激进会怎样 |
|---|---|---|
| test | 执行什么检查 | 命令不存在或只测端口，产生误判 |
| interval | 两次检查间隔 | 过短会增加检查负载 |
| timeout | 单次检查最长时间 | 过短会把慢启动误判失败 |
| retries | 连续失败几次才 unhealthy | 过少导致抖动，过多延迟发现 |
| start_period | 启动宽限期 | 太短会误判冷启动，太长会延迟发现故障 |

Compose 的短 depends_on 只保证创建顺序；长格式 condition: service_healthy 会等依赖健康后再启动调用方。它只解决启动阶段的等待，不是持续的故障恢复机制。

## 从 inspect 里看检查结果

课程数据库使用 pg_isready 检查 PostgreSQL 是否能接受连接，API 使用应用自带的健康检查模式。启动后先读状态和最近一次检查，再请求 API 的健康端点。

~~~powershell
docker compose up --build -d --wait
docker compose ps
docker inspect (docker compose ps -q db) --format '{{json .State.Health}}'
docker inspect (docker compose ps -q api) --format '{{json .State.Health}}'
Invoke-RestMethod http://localhost:8080/health/live
Invoke-RestMethod http://localhost:8080/health/ready
~~~

数据库 Health 为 healthy 表示 pg_isready 成功；API 的 liveness 说明进程能响应，readiness 说明 API 与数据库链路满足课程定义。Healthy 仍不代表每个业务接口都正确，所以还要写入并读回一条测试记录。

## 不要把 unhealthy 和 restart 混为一谈

Healthcheck 连续失败会把状态变为 unhealthy，但 Docker 的 restart policy 主要依据容器进程是否退出；它通常不会仅因 unhealthy 就自动重启容器。诊断时分别看 State.Status、State.Health 和 ExitCode，再决定是应用故障、依赖未就绪还是检查命令写错。

如果把数据库检查写成 curl localhost:5432，可能因镜像没有 curl 而永远失败。检查命令必须存在于目标镜像内，并验证它问的是正确的就绪条件。API readiness 可以依赖数据库，liveness 通常不应因为数据库短暂不可用而让所有 API 进程一起重启。

## 参考资料

- [控制 Compose 启动顺序](https://docs.docker.com/compose/how-tos/startup-order/)
- [Compose healthcheck](https://docs.docker.com/reference/compose-file/services/#healthcheck)
