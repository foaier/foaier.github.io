---
title: MySQL 容器实战：建表、写中文、保留数据与备份恢复
date: '2026-11-24'
summary: 用 MySQL 8.4 完成真实读写、重建和 SQL 恢复实验。
series: Docker 与 Kubernetes
order: 10
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - docker-ports
goals:
  - 重建容器后找回记录，并在另一个数据库验证备份。
---
MySQL 不能只练到“容器启动了”。这节要完成建表、写中文、查记录，然后删除容器重新创建，确认数据还能读。使用 MySQL 8.4 LTS，不沿用旧笔记里的 5.7。

准备：本机 Bash、Docker，已经理解命名卷。所有密码都是本地教学值，不用于线上。实验用 3307 映射到本机，避开常见的 3306。

## 创建数据库容器，等初始化结束

~~~bash
docker volume create mysql-note-data
docker run --name mysql-note -d -p 127.0.0.1:3307:3306 \
  --mount source=mysql-note-data,target=/var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD=local-root-only \
  -e MYSQL_DATABASE=notes \
  -e MYSQL_USER=learner -e MYSQL_PASSWORD=local-learner-only \
  mysql:8.4

docker logs -f mysql-note
~~~

第一次会初始化数据目录，别看到容器 ID 就急着连接。日志出现最终服务的 `ready for connections` 后按 Ctrl+C 停止看日志。`MYSQL_DATABASE`、`MYSQL_USER` 由官方镜像初始化脚本使用，不是 Docker 自带的关键字。

## 进入 MySQL，确认字符集再写数据

在宿主终端执行，提示密码时输入 `local-learner-only`：

~~~bash
docker exec -it mysql-note mysql -ulearner -p notes
~~~

现在进入的是 **mysql> 提示符**，下面复制 SQL，不要贴进 Bash：

~~~sql
SELECT VERSION();
SHOW VARIABLES LIKE 'character_set_server';
SET NAMES utf8mb4;
CREATE TABLE messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  body VARCHAR(200) NOT NULL
) DEFAULT CHARSET=utf8mb4;
INSERT INTO messages(body) VALUES ('你好，Docker'), ('第二条留言');
SELECT * FROM messages;
EXIT;
~~~

应看到两条中文记录。`utf8mb4` 能存储完整 Unicode 字符集；客户端、连接、库表的字符集都影响结果，不是改完一个配置就能修复已损坏的历史文本。

本机数据库客户端可以连接 `127.0.0.1:3307`，数据库 notes，用户 learner。其他容器不能把这个 localhost 当成 MySQL，容器间连接将在网络课学习。

## 删容器，再挂同一个卷

~~~bash
docker stop mysql-note
docker rm mysql-note
docker run --name mysql-note -d -p 127.0.0.1:3307:3306 \
  --mount source=mysql-note-data,target=/var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD=local-root-only mysql:8.4
docker logs --tail 30 mysql-note
~~~

等待启动完成，再用前面的 learner 账号登录，执行 `SELECT * FROM messages;`，两条记录应该仍在。因为数据库文件放在命名卷，不在容器可写层。

注意：旧数据目录存在时，镜像不会重新创建库和账户。把 run 里的密码环境变量改掉，不会修改数据库中已经创建的密码；需要使用 MySQL 的账户管理 SQL。

## 备份一份 SQL，恢复到新数据库

下面命令在容器内写备份文件，再复制到宿主，避免终端编码改变 SQL。只适用于本课静态实验数据：

~~~bash
docker exec -e MYSQL_PWD=local-root-only mysql-note sh -c 'mysqldump -uroot --single-transaction --no-tablespaces --set-gtid-purged=OFF notes > /tmp/notes.sql'
mkdir -p ~/docker-practice/mysql
docker cp mysql-note:/tmp/notes.sql ~/docker-practice/mysql/notes.sql
docker exec -e MYSQL_PWD=local-root-only mysql-note mysql -uroot -e 'CREATE DATABASE notes_restore CHARACTER SET utf8mb4'
docker exec -e MYSQL_PWD=local-root-only mysql-note sh -c 'mysql -uroot notes_restore < /tmp/notes.sql'
docker exec -e MYSQL_PWD=local-root-only mysql-note mysql -uroot -e 'SELECT * FROM notes_restore.messages'
~~~

看到恢复库中两条数据，才证明这个备份可用。环境变量中的教学密码不是秘密管理方案。生产备份还要考虑并发 DDL、大表、恢复时间、加密和异地保存。

## 常见卡点与收尾

Access denied 先核对连接账号、密码，以及是不是复用了旧数据卷。Exited 先看 logs，别给 MySQL 加 `--privileged`。磁盘满或权限错误查数据目录与 Docker 可用空间。升级数据库版本不能直接换大版本标签后碰运气，要按 MySQL 支持的升级路径演练。

~~~bash
docker stop mysql-note
docker rm mysql-note
docker volume inspect mysql-note-data
~~~

卷先保留。确认备份与实验数据都不要了，才执行 `docker volume rm mysql-note-data`。后面的主从实验使用另一套卷，不会复用这里的单机数据。

## 继续阅读

- [命令与配置说明](https://hub.docker.com/_/mysql)
- [进一步了解相关机制](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html)
