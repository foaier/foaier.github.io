---
title: Redis 容器实战：配置、认证、过期与 AOF 持久化
date: '2026-11-24'
summary: 从一份 redis.conf 开始，写入键，再重建容器检查数据。
series: Docker 与 Kubernetes
order: 11
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - docker-mysql
goals:
  - 验证配置生效，区分键过期、认证失败与数据丢失。
---
Redis 经常用来做缓存、计数器或临时状态存储。Docker 负责启动 Redis；Redis 自己负责读写数据、认证和持久化。把这两层分开，就容易看懂 `docker run ... redis-server ...` 后半段到底是谁的参数。

这课使用 Redis 7.4，在本机 Bash 练习。先新建自己的目录，不要拿已有生产配置覆盖：

~~~bash
mkdir -p ~/docker-practice/redis
cd ~/docker-practice/redis
~~~

## 写一份能读懂的 redis.conf

创建文件：

~~~bash
cat > redis.conf <<'EOF'
bind 0.0.0.0
protected-mode yes
port 6379
daemonize no
requirepass local-redis-only
dir /data
appendonly yes
appendfsync everysec
EOF
~~~

| 配置 | 本次含义 |
|---|---|
| bind | 在容器内监听，主机暴露范围仍由 `-p` 决定 |
| protected-mode | 开启保护模式，不能代替网络与认证设计 |
| daemonize no | Redis 保持前台，交给 Docker 管理 |
| requirepass | 本地实验密码；生产使用 ACL 等权限方案 |
| dir | 保存数据的目录，稍后挂卷 |
| appendonly / appendfsync | 把写入记录进 AOF，按设定刷盘 |

`everysec` 是性能和数据丢失窗口之间的取舍，不等于每次成功响应都已经同步到磁盘。

## 启动，证明加载的就是这份配置

~~~bash
docker volume create redis-note-data
docker run --name redis-note -d -p 127.0.0.1:6380:6379 \
  --mount type=bind,source="$PWD/redis.conf",target=/usr/local/etc/redis/redis.conf,readonly \
  --mount source=redis-note-data,target=/data \
  redis:7.4-alpine redis-server /usr/local/etc/redis/redis.conf

docker logs --tail 20 redis-note
docker exec redis-note redis-cli ping
~~~

没有提供密码的 ping 应返回 `NOAUTH`，这反而证明认证配置生效。再用教学密码验证：

~~~bash
docker exec -e REDISCLI_AUTH=local-redis-only redis-note redis-cli ping
docker exec -e REDISCLI_AUTH=local-redis-only redis-note redis-cli CONFIG GET appendonly
~~~

应分别得到 PONG 和 yes。正式系统不要给普通业务用户 CONFIG 权限；本节是本机管理员实验。

## 写入、读取、过期

~~~bash
docker exec -e REDISCLI_AUTH=local-redis-only redis-note redis-cli SET lesson docker
docker exec -e REDISCLI_AUTH=local-redis-only redis-note redis-cli GET lesson
docker exec -e REDISCLI_AUTH=local-redis-only redis-note redis-cli SET temporary hello EX 30
docker exec -e REDISCLI_AUTH=local-redis-only redis-note redis-cli TTL temporary
~~~

lesson 的值应是 docker；temporary 的 TTL 会逐渐减少，过 30 秒 GET 它得到 nil 是过期规则，并非 Docker 丢数据。Redis 不是默认把所有键都永久保存，业务还可以给键设置过期时间。

## 删除容器后，再读那条不过期记录

先正常停止，以便 Redis 收尾，再重建：

~~~bash
docker stop redis-note
docker rm redis-note
docker run --name redis-note -d -p 127.0.0.1:6380:6379 \
  --mount type=bind,source="$PWD/redis.conf",target=/usr/local/etc/redis/redis.conf,readonly \
  --mount source=redis-note-data,target=/data \
  redis:7.4-alpine redis-server /usr/local/etc/redis/redis.conf

docker exec -e REDISCLI_AUTH=local-redis-only redis-note redis-cli GET lesson
~~~

若 Redis 仍在启动，等日志出现 ready 后重试。应该读到 docker。Redis 7 的 AOF 可能是目录下的一组文件，不要只复制一个想当然的 `appendonly.aof` 当作完整备份。

## 启动即退出和连接失败怎么查

配置写了 daemonize yes，Redis 可能后台化后导致容器主进程结束，应改回 no。日志提示配置文件是目录，先检查宿主路径是否存在、拼写是否正确。NOAUTH、WRONGPASS 属于认证问题；Connection refused 要看监听地址和端口，不能混为一谈。

本机访问的是 6380，容器内是 6379。公网 Redis 不应该靠“有一个简单密码”就直接开放。集群通信端口与地址也有额外要求，后面的 Redis Cluster 课会在独立网络里做。

~~~bash
docker stop redis-note
docker rm redis-note
~~~

保留 redis.conf 和 redis-note-data 便于复习；确定不再需要数据时才删对应卷。

## 继续阅读

- [命令与配置说明](https://hub.docker.com/_/redis)
- [进一步了解相关机制](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
