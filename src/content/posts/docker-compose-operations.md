---
title: Compose 运维：备份恢复、更新回滚、日志与清理
date: '2026-11-24'
summary: 从一条留言出发，备份到 SQL、恢复到新库，再检查更新和数据边界。
series: Docker 与 Kubernetes
order: 19
tags:
  - Docker
  - Docker 进阶
level: Docker 进阶
prerequisites:
  - docker-compose-health
goals:
  - 执行可恢复的更新，区分 stop、down 和 down -v。
---
真正维护一个服务，常做的不是第一次 up，而是看日志、备份、更新、恢复。下面继续用 Java + MySQL + Redis 的留言项目，所有命令在 Bash 的 `~/docker-labs` 执行。先完成 Compose 课，确保有至少一条留言。

## 每次操作前先确认项目

~~~bash
cd ~/docker-labs
docker compose config --services
docker compose up -d --wait --wait-timeout 240
docker compose ps --all
docker compose logs --tail 30 app mysql redis
~~~

确认只有 app、mysql、redis 三个服务。Compose 项目名写在配置顶层 name，这份示例是 docker-labs。换目录、改 `-p` 项目名可能产生另一套容器与卷，所以“数据不见了”有时只是连接到了新项目。

完整 config 可能展示密码，分享报错时先去掉敏感值。查日志可以加 `--since 10m` 限制时间，避免把所有历史输出混在一起。

## 先做备份，再证明能恢复

在容器内部生成 SQL，复制到本机 backups：

~~~bash
mkdir -p backups
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --no-tablespaces --set-gtid-purged=OFF notes > /tmp/notes.sql'
docker compose cp mysql:/tmp/notes.sql backups/notes.sql
ls -lh backups/notes.sql
~~~

不要只凭“文件大小不是零”判定成功。恢复到另一个库，避免覆盖正在用的 notes：

~~~bash
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "CREATE DATABASE IF NOT EXISTS notes_restore CHARACTER SET utf8mb4"'
docker compose cp backups/notes.sql mysql:/tmp/restore.sql
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot notes_restore < /tmp/restore.sql'
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "SELECT id,note FROM notes_restore.visits"'
~~~

应看到备份时的留言。再次恢复同名表可能覆盖该恢复库中的测试数据，只在 notes_restore 里做。生产环境还要测恢复耗时、文件加密、访问权限和异地保存，不是把 SQL 放在同一块会坏的磁盘上就算备份方案。

## 只重建应用，不重建数据库

先保存当前镜像为本地回滚标签，再编辑 compose.yaml 里的 DEMO_MESSAGE 为 `updated-message`：

~~~bash
docker tag foaier-java:lesson foaier-java:before-change
docker compose up -d --no-deps --build app
docker compose logs --tail 30 app
curl http://localhost:8080/
~~~

等应用启动后应返回新文案。`--no-deps` 表示这次只处理 app，不连带启动依赖；如果 MySQL、Redis 本来没运行，应用仍不会变健康。代码变化要重新 build，只有环境变量变化时通常不用重新构建镜像。

仅改文案的回滚：把 DEMO_MESSAGE 改回原值，再 up app。若应用镜像也变了，需要把 compose 的 image 指到保存的标签，并使用 `--no-build`，避免马上又构建覆盖。

## stop、down、down -v 差在哪里

| 操作 | 容器 | 项目网络 | 命名卷 |
|---|---|---|---|
| stop | 停止并保留 | 保留 | 保留 |
| start | 启动已有容器 | 复用 | 复用 |
| down | 删除 | 删除 | 默认保留 |
| down -v | 删除 | 删除 | 删除声明的非 external 卷及相关匿名卷 |

~~~bash
docker compose down
docker compose up -d --wait --wait-timeout 240
curl -f http://localhost:8080/visits
~~~

留言应该仍在。不要为了“重新部署一下”就执行 down -v；那是在删除数据库数据。生产更新要明确有没有卷操作、有没有数据库迁移、应用回滚能不能兼容新数据结构。

## 日志变大与磁盘压力

~~~bash
docker system df
docker compose ps -q app
docker compose logs --tail 50 app
~~~

先判断空间来自镜像、缓存、卷还是日志。生产可给服务设置日志轮转，比如在服务下面配置：

~~~yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
~~~

这是服务级片段，要放在 app 等服务下，而不是文件顶层。修改后重建容器才应用；已有历史日志也不会自动变成集中日志系统。重要日志应另外采集，轮转只是控制本机增长。

## 收尾与下一次启动

~~~bash
docker compose down
ls backups
~~~

保留卷和 SQL 备份，下次 up 可以继续。磁盘紧张时先列出具体资源再删，不复制“删除所有容器、所有卷”的一行命令。你真正需要的操作记录是：更新了哪个版本、备份在哪里、如何恢复、验收哪一个业务请求。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/reference/cli/docker/compose/)
- [进一步了解相关机制](https://docs.docker.com/engine/logging/drivers/json-file/)
