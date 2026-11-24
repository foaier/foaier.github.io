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

## 留一个小练习

暂时停止数据库：`docker compose stop db`，再请求 API 的 `/health/live` 与 `/health/ready`。前者仍能响应，后者返回 503。用 `docker compose start db` 恢复后再请求就绪接口。这个例子也说明 depends_on 管理的是启动关系，数据库运行途中故障仍需要应用处理。

## 没跑通时先查什么

容器健康检查与 API 自身 `/health/ready` 不完全相同：前者由 Docker 执行，后者反映应用的数据库依赖。无论哪一层失败，都看 `.State.Health.Log` 或应用日志。健康检查命令必须存在于镜像中；精简镜像没有 curl 时，不要照搬依赖 curl 的写法。

健康检查的命令由 Docker 定期执行，因此频率、超时与资源开销都要合理。健康是探针当前观察到的状态，不是对全部业务正确性的证明。服务持续 unhealthy 时，把健康命令日志和应用本身的请求日志分开读，定位会更快。

## 参考资料

- [控制 Compose 启动顺序](https://docs.docker.com/compose/how-tos/startup-order/)
- [Compose healthcheck](https://docs.docker.com/reference/compose-file/services/#healthcheck)
