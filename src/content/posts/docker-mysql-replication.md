---
title: MySQL 主从实战：搭复制、查延迟、暂停再追赶
date: '2026-11-24'
summary: 两套独立 MySQL 8.4 实例，从复制账号和 GTID 开始逐步验证。
series: Docker 与 Kubernetes
order: 20
tags:
  - Docker
  - Docker 进阶
level: Docker 进阶
prerequisites:
  - docker-compose-operations
goals:
  - 建立复制并定位 IO 与 SQL 线程故障，理解复制不等于备份。
---
单机 MySQL 学会了，再看“主库写入，从库跟着出现”怎么实现。Docker 在这里只负责准备两台数据库的运行环境，复制协议、事务日志、延迟与故障都属于 MySQL 的能力。

本课使用全新 MySQL 8.4 实例和 GTID 复制。GTID 是事务标识，副本根据已经执行过的事务继续追赶，避免手工抄某个 binlog 文件的偏移。不要把这套从空数据起步的步骤直接用于已有业务数据库。

## 启动独立的主从实验

先下载[实验包](/downloads/docker-labs.zip)，解压至 `~/docker-labs`。在 Bash：

~~~bash
cd ~/docker-labs/replication
docker compose config --services
docker compose up -d --wait --wait-timeout 240
docker compose ps
~~~

应有 source、replica 两个 healthy 服务，没有发布主机数据库端口。这套项目名是 mysql-replication-lab，与之前的留言项目分开。电脑内存不足时先停止上一套实验。

两边的 server-id 分别为 101 和 102，GTID 与 enforce-gtid-consistency 开启；source 开启 binlog，replica 还有 relay log。复制大致这样走：

~~~text
主库提交事务 → binlog → 副本接收线程 → relay log → 副本应用线程 → 表数据
~~~

## 在主库创建复制账号

~~~bash
docker compose exec source mysql -uroot -p
~~~

密码输入 `local-root-only`。在 **mysql>** 中执行：

~~~sql
CREATE USER 'repl'@'%' IDENTIFIED BY 'local-repl-only';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';
SHOW VARIABLES LIKE 'gtid_mode';
SHOW BINARY LOG STATUS;
EXIT;
~~~

gtid_mode 应为 ON。账号只授予复制所需权限，不拿业务账户或 root 作为复制身份。重复练习时用户已存在不必再 CREATE；先核对旧实验状态，不要忽略所有 SQL 错误后继续。

## 在副本填写来源并启动复制

~~~bash
docker compose exec replica mysql -uroot -p
~~~

同样输入教学 root 密码，在副本的 mysql> 执行：

~~~sql
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='source',
  SOURCE_PORT=3306,
  SOURCE_USER='repl',
  SOURCE_PASSWORD='local-repl-only',
  SOURCE_AUTO_POSITION=1,
  GET_SOURCE_PUBLIC_KEY=1;
SET GLOBAL super_read_only=ON;
START REPLICA;
SHOW REPLICA STATUS\G
EXIT;
~~~

source 是 Compose 网络中的服务名，使用容器端口 3306。GET_SOURCE_PUBLIC_KEY 用于本地实验中的认证密钥获取；它不等于给复制流量提供完整 TLS 保护，生产复制应配可信证书。

重点找 `Replica_IO_Running: Yes`、`Replica_SQL_Running: Yes`，以及 Last_IO_Error、Last_SQL_Error 是否为空。一个负责接收，一个负责应用，两边都正常才说明链路正在工作。`Seconds_Behind_Source` 也不能独自证明业务层完全无延迟。

## 真写一条数据，再从副本读取

在主库登录后运行：

~~~sql
CREATE DATABASE replication_demo CHARACTER SET utf8mb4;
CREATE TABLE replication_demo.messages (id INT PRIMARY KEY, note VARCHAR(100));
INSERT INTO replication_demo.messages VALUES (1, '从主库写入');
EXIT;
~~~

切回宿主 Bash，登录副本：

~~~bash
docker compose exec replica mysql -uroot -p
~~~

~~~sql
SELECT * FROM replication_demo.messages;
SHOW REPLICA STATUS\G
EXIT;
~~~

应查到 id=1 的数据。异步复制允许短暂延迟，立刻查询可能还没跟上，等状态正常后重试。不要为了让结果看起来一致直接在副本上再插一条，那会掩盖复制故障。

## 停复制，观察积压，再恢复

在副本 mysql> 执行 `STOP REPLICA;`。然后到主库插入 id=2 的留言，副本暂时不应出现这条数据。回副本执行：

~~~sql
START REPLICA;
SHOW REPLICA STATUS\G
SELECT * FROM replication_demo.messages;
EXIT;
~~~

恢复后应追上 id=2。这说明复制能补上暂停期间仍保留在主库日志中的事务；如果主库日志已被清理或数据基础不一致，就不能指望简单 START 修好。

常见故障：IO 线程失败查网络、账号和认证；SQL 线程失败查具体事务与数据冲突。不要配置“自动跳过所有重复主键错误”，这样可能把不一致藏起来。已有主库的数据要先做一致性备份与恢复，再按正确复制位置或 GTID 接上。

## 主从不是备份，也不是自动切换

误删数据也会复制；主库停机时，这个实验没有自动选主、切入口和防双写系统。同一台电脑的两个容器更不能抵御电脑断电。

~~~bash
docker compose down
~~~

该命令保留两套数据卷。完全重做空库实验时，确认只在 replication 目录、没有需要的数据后再执行 `docker compose down -v`。重新建立复制关系时从本课第一步开始，不混用旧卷和新库。

## 继续阅读

- [命令与配置说明](https://dev.mysql.com/doc/refman/8.4/en/replication-gtids-howto.html)
- [进一步了解相关机制](https://dev.mysql.com/doc/refman/8.4/en/show-replica-status.html)
