---
title: "Compose 日常运维：看日志、备份数据库、更新服务都怎么做"
date: "2026-11-24"
summary: "练习 Compose 的日志、重启和数据库备份，并弄清 down 与 down -v 的差别。"
series: "Docker 与 Kubernetes"
order: 16
tags: ["Docker 实战","Docker","Kubernetes"]
level: "Docker 实战"
prerequisites: ["docker-compose-health"]
goals: ["可以用 Compose 检查服务状态、导出练习数据并安全停止环境。"]
---

Compose 环境跑起来之后，最常用的工作往往不是改 YAML，而是回答几件小事：哪个服务报错、数据库还能不能连、今天更新镜像会不会丢数据。把这些日常动作练熟，后面学集群运维会容易很多。

## 概念讲透：它负责什么，不负责什么

Compose 运维命令管理的是服务栈：ps 看容器状态，logs 聚合服务日志，restart 重启进程，up 按配置创建或更新容器，down 移除服务容器和网络。down 默认保留命名卷，down -v 会额外删除卷。数据库备份是应用数据的一份独立制品，不能用“容器还在”或“卷还在”代替。

## 运行过程拆解：从输入到结果

安全的数据库恢复顺序是先确认目标实例和时间点，再准备空的隔离数据库，执行恢复，核对表结构、关键记录和应用读取，最后才切换连接。Compose down 默认不删命名卷，down -v 会删项目关联卷；容器升级、卷删除、数据库恢复是三种不同操作。值班手册要把这些命令分开写，并标出哪一步会覆盖数据。

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

## 怎么确认做对了

备份文件应不是 0 字节；logs 能同时标明来源服务。down 后数据库卷仍保留，重新 up 能查回数据。不要以“命令没报错”作为唯一验收：备份需要恢复测试，更新需要健康检查和业务请求验证。

## 案例推演

升级后数据库表结构变了，应用回滚到旧版本后报错。回滚镜像不等于回滚数据库；部署前应记录应用版本和数据库迁移版本，采用向前兼容的迁移顺序，并先在副本或测试恢复上演练。日常备份生成后，至少在隔离环境恢复一次，检查表、记录数和应用读写，而不是只确认 pg_dump 返回码。

## 留一个小练习

把这份虚构 SQL 导入另一个临时数据库，确认 visits 记录回来。不要在当前工作库直接试覆盖恢复。接着试 `docker compose up -d --build` 只更新 API，并观察数据库容器是否被不必要地重建。

## 没跑通时先查什么

备份文件为空时检查容器名、目录是否存在与 pg_dump 错误。恢复前先阅读 SQL 文件头并选独立数据库。正式备份还要有加密、校验、异地副本和定期恢复演练。

应用数据库文件与备份文件放在同一块磁盘，磁盘坏了两者可能一起丢失。真实环境需要异地或受控备份位置、可读的保留周期和恢复负责人。课程只演示逻辑备份命令，恢复演练要用独立数据库，避免把工作数据覆盖掉。

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

## 生产里怎么用、怎么排障

备份策略要写清 RPO（最多能丢多少数据）和 RTO（多久恢复），并覆盖恢复权限、加密密钥、存储保留和异地副本。恢复会覆盖数据，必须核对目标实例并避免覆盖线上库。日志命令可能暴露连接串，分享前脱敏；执行 down、删除卷或切换数据库版本前先做影响确认和恢复点记录。

## 参考资料

- [Compose CLI](https://docs.docker.com/reference/cli/docker/compose/)
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
