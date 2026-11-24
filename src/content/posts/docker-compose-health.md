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

## 生产里怎么用、怎么排障

检查项太重会给服务增加负载，超时时间太短会在正常高峰产生误报，太长又会延迟发现故障。每个探测都要明确失败后果和阈值，并验证诊断结果能否区分应用故障与依赖故障。数据库需要恢复时，盲目对所有服务同时重启可能造成连接风暴；使用退避、连接池限制和分批恢复。

## 参考资料

- [控制 Compose 启动顺序](https://docs.docker.com/compose/how-tos/startup-order/)
- [Compose healthcheck](https://docs.docker.com/reference/compose-file/services/#healthcheck)
