---
title: "数据库容器先启动，不代表它已经能接请求"
date: "2026-11-24"
summary: "用健康检查和 service_healthy 处理启动时序，区分进程启动与依赖就绪。"
series: "Docker 与 Kubernetes"
order: 15
tags: ["Docker 实战","Docker","Kubernetes"]
level: "Docker 实战"
prerequisites: ["docker-compose"]
goals: ["实测 PostgreSQL 健康检查，并解释 depends_on 为什么要等待 healthy。"]
---

`docker compose up` 经常同时启动 API 与数据库。数据库进程先出现，并不代表它已经初始化数据库、打开端口并可以接受连接。API 若马上开始调用，可能启动一次就报错退出。单纯写 `depends_on: db` 只表达顺序，不一定表达“数据库已经准备好”。

## 概念讲透：它负责什么，不负责什么

进程启动、容器运行、应用可服务是三个不同状态。healthcheck 会定期执行一个轻量检查并报告 healthy/unhealthy；Compose 的 service_healthy 让依赖服务在首次启动时达到健康状态后再启动后续服务。健康检查不会修复服务，也通常不会因为 unhealthy 自动重启进程；应用仍需处理运行期断线和重连。

## 运行过程拆解：从输入到结果

数据库启动时要初始化文件和用户，容器进程先运行并不代表初始化已经完成。healthcheck 反复执行检查，连续成功后 Docker 报告 healthy；service_healthy 用这个状态控制首次依赖启动。运行期间数据库掉线后，Compose 不会持续替 API 排队请求，应用要做超时、退避、重连，并在无法提供业务时准确报告未就绪。

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

## 怎么确认做对了

数据库 Health 应变为 healthy 后，API 才启动。首次创建 PostgreSQL 数据目录可能比后续启动久。如果数据库 healthy，而 `/health/ready` 仍为 503，就继续查连接串、用户名和数据库名，而不是再加十次 retry。

## 案例推演

Compose 启动后 API 比数据库先发起连接，第一次请求 500，手动重试又成功。查看数据库健康检查输出和 API 启动日志，确认不是单纯的进程启动顺序。让数据库检查真实查询能力，并让 API 在短暂断线时退避重试；如果 API 只检查自身 HTTP 端口，不能据此宣称依赖数据库的业务已就绪。

## 留一个小练习

暂时停止数据库：`docker compose stop db`，再请求 API 的 `/health/live` 与 `/health/ready`。前者仍能响应，后者返回 503。用 `docker compose start db` 恢复后再请求就绪接口。这个例子也说明 depends_on 管理的是启动关系，数据库运行途中故障仍需要应用处理。

## 没跑通时先查什么

容器健康检查与 API 自身 `/health/ready` 不完全相同：前者由 Docker 执行，后者反映应用的数据库依赖。无论哪一层失败，都看 `.State.Health.Log` 或应用日志。健康检查命令必须存在于镜像中；精简镜像没有 curl 时，不要照搬依赖 curl 的写法。

健康检查的命令由 Docker 定期执行，因此频率、超时与资源开销都要合理。健康是探针当前观察到的状态，不是对全部业务正确性的证明。服务持续 unhealthy 时，把健康命令日志和应用本身的请求日志分开读，定位会更快。

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

## 生产里怎么用、怎么排障

检查项太重会给服务增加负载，超时时间太短会在正常高峰产生误报，太长又会延迟发现故障。每个探测都要明确失败后果和阈值，并验证诊断结果能否区分应用故障与依赖故障。数据库需要恢复时，盲目对所有服务同时重启可能造成连接风暴；使用退避、连接池限制和分批恢复。

## 参考资料

- [控制 Compose 启动顺序](https://docs.docker.com/compose/how-tos/startup-order/)
- [Compose healthcheck](https://docs.docker.com/reference/compose-file/services/#healthcheck)
