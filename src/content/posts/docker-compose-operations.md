---
title: Compose 日常运维：看日志、备份数据库、更新服务都怎么做
date: '2026-11-24'
summary: 练习 Compose 的日志、重启和数据库备份，并弄清 down 与 down -v 的差别。
series: Docker 与 Kubernetes
order: 16
tags:
  - Docker 实战
  - Docker
  - Kubernetes
level: Docker 实战
prerequisites:
  - docker-compose-health
goals:
  - 可以用 Compose 检查服务状态、导出练习数据并安全停止环境。
---

Compose 环境跑起来之后，最常用的工作往往不是改 YAML，而是回答几件小事：哪个服务报错、数据库还能不能连、今天更新镜像会不会丢数据。把这些日常动作练熟，后面学集群运维会容易很多。

## 日常操作先分清会不会删数据

`logs` 收集容器标准输出；`restart` 重启现有容器；`up -d` 按新配置协调服务；`down` 停掉并移除容器与网络，但保留命名卷；`down -v` 额外删除卷。生产更新前先备份，成功启动后再验证健康和数据。

## 导出一份课程数据库备份

先写入几条练习记录，再让 pg_dump 在数据库容器里生成 SQL 文件，随后用 `docker compose cp` 原样复制到本机。`course-local-only` 只在课程沙盒使用。备份文件含业务数据，真实系统要限制权限、加密并制定保留周期。

~~~powershell
docker compose exec -T db pg_dump -U course -d course --file=/tmp/course-backup.sql
docker compose cp db:/tmp/course-backup.sql ./course-backup.sql
Get-Item course-backup.sql
docker compose logs --tail 100 api db
docker compose down
~~~

## 真的恢复一次，备份才算有用

备份命令跑完以后，先重新启动课程环境，然后在同一 PostgreSQL 实例里创建一个独立测试库。下面只恢复虚构练习数据，不覆盖 course 数据库。若 course_restore 已存在，先检查它是你以前的实验数据，换一个新的测试库名也可以。

~~~powershell
docker compose up -d --wait
docker compose exec -T db createdb -U course course_restore
docker compose cp ./course-backup.sql db:/tmp/course-restore.sql
docker compose exec -T db psql -U course -d course_restore -v ON_ERROR_STOP=1 -f /tmp/course-restore.sql
docker compose exec -T db psql -U course -d course_restore -c "SELECT id, note FROM visits ORDER BY id;"
~~~

ON_ERROR_STOP 让 SQL 出错时停下来，避免前面失败、后面还继续输出，让人误以为全成功。应该能查到备份时已经存在的记录；备份之后才新写入的记录不会凭空出现。业务库仍叫 course，API 没有切到测试库。

测试完确认不再需要恢复库，再执行下面这条明确指向它的清理命令。不要把数据库名顺手换成正在用的 course。

~~~powershell
docker compose exec -T db dropdb -U course course_restore
~~~

这验证的是逻辑导出与恢复的基本路径。生产系统还要量出恢复用时、允许损失的数据时间窗口，以及备份期间持续写入时的一致性要求，再决定是否需要 WAL 归档和时间点恢复。

## Compose 日常命令分别会不会重建容器

| 命令 | 作用 | 对数据的影响 |
|---|---|---|
| up -d | 创建或按配置更新服务 | named volume 通常保留 |
| stop / start | 停止或启动现有容器 | 不删除容器和卷 |
| restart | 重启现有容器 | 保留容器写入层和卷 |
| logs / exec | 查看输出或临时进入运行容器 | 不改变部署定义 |
| down | 删除项目容器和网络 | 默认保留 named volume |
| down -v | 连项目卷一起删除 | 卷内数据会删除 |

Compose 是声明式工具：修改 compose.yaml 后重新 up，Compose 会比较期望配置并按需重建容器。手工 docker run 创建的容器不属于该项目的服务状态。

## 一次日常巡检和安全重启

先看项目名、容器状态和最近日志；确认数据库和 API 的健康后，再按服务名重启 API。重启后验证就绪接口和一条业务读请求。

~~~powershell
docker compose ps
docker compose logs --tail 50 api
docker compose restart api
docker compose ps
Invoke-RestMethod http://localhost:8080/health/ready
Invoke-RestMethod http://localhost:8080/visits
~~~

在解压后的 container-course 目录运行这些命令，保持与启动课程环境时相同的工作目录。若平时启动时指定过 -p，就要在这些命令里使用同一个项目名；换项目名会让 Compose 创建另一套容器、网络和卷。

## 扩缩容前先看端口和状态存储

课程 API 固定把 8080 发布到宿主机，直接把它扩成多个容器可能发生主机端口冲突。多副本服务应让副本只在内部网络监听，由一个负载均衡入口承接主机端口；数据库也不能只靠把副本数调大来获得安全的高可用。

改变 Compose 配置后先运行 docker compose config 校验，再执行 up。要更新镜像可先 pull 或 build，再观察 ps、logs 和健康检查。回滚到旧镜像版本时同样需要确认标签是否指向预期摘要。

## 释放空间前先判定卷是否有用

docker compose down -v 会删除项目卷，开发时可能正好删掉唯一一份数据库数据。清理前先查卷、备份状态和目标项目；对于其他服务，不要在不理解数据生命周期时使用系统级 prune。

~~~powershell
docker compose ls
docker volume ls
docker system df
docker compose down
~~~

最后一条保留 named volume。若确实要删除课程练习数据，应单独运行 down -v 并再次确认项目和数据无需保留。

## 参考资料

- [Compose CLI](https://docs.docker.com/reference/cli/docker/compose/)
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
