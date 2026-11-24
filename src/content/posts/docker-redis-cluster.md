---
title: Redis 集群实战：三主三副本、哈希槽、扩缩容与切换
date: '2026-11-24'
summary: 从六个节点创建集群，再练 MOVED、迁槽、节点移除和故障恢复。
series: Docker 与 Kubernetes
order: 21
tags:
  - Docker
  - Docker 进阶
level: Docker 进阶
prerequisites:
  - docker-mysql-replication
goals:
  - 验收槽覆盖，完成扩缩容并观察副本接手。
---
Redis 主从复制解决“有另一份数据”，分片解决“数据分开存到不同主节点”。Redis Cluster 同时涉及这两件事：多个主节点分担数据，每个主节点有副本。本节创建三主三副本，再练扩容、迁槽、缩容和故障切换。

先学会单机 Redis、Docker 网络和 Compose。实验需要比单个容器更多内存。六个容器仍在同一台电脑上，只能演示机制，不代表有六台独立服务器的容灾能力。

## 从取模、哈希环到槽

| 分配方法 | 思路 | 加节点时的影响 |
|---|---|---|
| hash(key) % 节点数 | 算出落在哪台机器 | 节点数变化后，大量映射可能改变 |
| 一致性哈希 | 把节点与键映射到环上 | 通常只改变部分区间，分布还要考虑虚拟节点等设计 |
| Redis Cluster 哈希槽 | 先算槽，再查槽属于谁 | 槽总数固定，通过迁移槽调整分布 |

Redis Cluster 有 16384 个槽，通常按 `CRC16(key) % 16384` 定位；使用 `{...}` 哈希标签时会按标签部分计算。槽分得均匀不代表内存与流量一定均匀，一个超大键或热点键仍可能压垮某个主节点。

## 起六个节点，明确网络范围

下载[实验包](/downloads/docker-labs.zip)，解压至 `~/docker-labs`。在 Bash 执行：

~~~bash
cd ~/docker-labs/redis-cluster
docker compose up -d --wait
docker compose ps
~~~

应有 r1～r6；r7、r8 属于 grow profile，默认不启动。每个节点有独立卷，配置开启 cluster-enabled、AOF，并设置独立的通告地址。网络使用 `172.30.99.0/24`；若与本机已有网络冲突，应同步修改文件中的子网、各节点 IP 和下面的命令。

本实验没有密码，也没有发布任何主机端口，只允许在实验网络中操作。真实部署必须设计认证、TLS、网络限制和客户端可达地址，不能直接把这份文件开放到公网。

## 创建三主三副本，查槽覆盖

~~~bash
docker compose exec r1 redis-cli --cluster create \
  172.30.99.11:6379 172.30.99.12:6379 172.30.99.13:6379 \
  172.30.99.14:6379 172.30.99.15:6379 172.30.99.16:6379 \
  --cluster-replicas 1
~~~

阅读节点分配计划，确认是这六个地址后输入 yes。`--cluster-replicas 1` 表示每个主节点配一个副本。初始化只运行一次，已有集群会提示节点不为空，不能重复创建。

~~~bash
docker compose exec r1 redis-cli cluster info
docker compose exec r1 redis-cli cluster nodes
docker compose exec r1 redis-cli --cluster check 172.30.99.11:6379
~~~

应看到 cluster_state:ok、cluster_slots_assigned:16384、六个节点以及三个主节点。记录节点 ID、地址、角色和槽范围，它们不是可以照抄的常量。`--cluster check` 应确认所有槽已覆盖。

## MOVED 不是写坏了，加 -c 再试

~~~bash
docker compose exec r1 redis-cli -c SET lesson redis-cluster
docker compose exec r2 redis-cli -c GET lesson
docker compose exec r1 redis-cli CLUSTER KEYSLOT lesson
~~~

应读到 redis-cluster。`-c` 让 redis-cli 遇到重定向时跟到正确节点；不加可能收到 MOVED，表示这个槽在另一地址。初始连接成功不代表客户端能到达被重定向地址，所以实验在容器内执行，避免主机无法访问内部 IP。

多键命令要求键在同一槽时，可用 `order:{42}:name`、`order:{42}:price` 这样的共享标签。不要为了省事把所有键都写同一个标签，否则又集中到一个槽。

## 加一个主节点，再把槽交给它

~~~bash
docker compose --profile grow up -d --wait r7 r8
docker compose exec r1 redis-cli --cluster add-node 172.30.99.17:6379 172.30.99.11:6379
NEW_ID=$(docker compose exec -T r7 redis-cli cluster myid)
docker compose exec r1 redis-cli --cluster reshard 172.30.99.11:6379 \
  --cluster-from all --cluster-to "$NEW_ID" --cluster-slots 4096 --cluster-yes
docker compose exec r1 redis-cli --cluster check 172.30.99.11:6379
~~~

加入成功时新主节点最初没有槽；reshard 才搬数据和槽。应看到 r7 获得 4096 个槽。这里是空闲教学集群，真实大数据迁移要关注耗时、内存、延迟和客户端重试。

再把 r8 作为它的副本：

~~~bash
docker compose exec r1 redis-cli --cluster add-node \
  172.30.99.18:6379 172.30.99.11:6379 --cluster-slave --cluster-master-id "$NEW_ID"
docker compose exec r1 redis-cli cluster nodes
~~~

r8 的复制对象应是 r7 的 ID。CLI 中仍有 slave 这样的参数名称，实际含义是添加 replica。

## 缩容先迁空槽，后删除节点

本段接着上一步执行；先确认 r1 当前仍是 master。若之前做过故障实验使它变成副本，请从 cluster nodes 中选一个存活主节点作为接收方，并替换下列接收 ID 的获取对象。

~~~bash
OLD_ID=$(docker compose exec -T r1 redis-cli cluster myid)
REPLICA_ID=$(docker compose exec -T r8 redis-cli cluster myid)
docker compose exec r1 redis-cli --cluster del-node 172.30.99.11:6379 "$REPLICA_ID"
docker compose exec r1 redis-cli --cluster reshard 172.30.99.11:6379 \
  --cluster-from "$NEW_ID" --cluster-to "$OLD_ID" --cluster-slots 4096 --cluster-yes
docker compose exec r1 redis-cli --cluster check 172.30.99.11:6379
~~~

确认 r7 为 0 slots 后，再移除它：

~~~bash
docker compose exec r1 redis-cli --cluster del-node 172.30.99.11:6379 "$NEW_ID"
docker compose stop r7 r8
docker compose exec r1 redis-cli --cluster check 172.30.99.11:6379
~~~

应回到六节点，全部槽仍被覆盖。如果上面迁移的槽数不是 4096，先根据 check 的实际结果调整，不要直接删除仍持有槽的节点。

## 停一个主节点，观察副本接手

先查看 `docker compose exec r1 redis-cli role`，确认 r1 为 master，并在 cluster nodes 里找到它的副本。然后：

~~~bash
docker compose stop r1
docker compose exec r2 redis-cli cluster nodes
docker compose exec r2 redis-cli -c GET lesson
~~~

故障判定与选举不是瞬间完成，等数秒后重试，应看到原副本成为 master，GET 恢复。然后 `docker compose start r1`，观察它重新加入后的角色，不要假定恢复的旧主一定自动当回主节点。

Redis 复制通常是异步的，切换可能丢失尚未复制的写入。所有容器所在电脑断电，整组都会受影响。

## 卡点与清理

一直 waiting for the cluster to join，检查所有节点能否互通 6379 和集群总线端口 16379；宿主端口映射不能替代节点通告地址。节点 not empty 要区分“已初始化”和“拿了旧数据卷”。CLUSTERDOWN 先查槽覆盖、故障主节点和可用多数派，不用 FLUSHALL 掩盖问题。

~~~bash
docker compose --profile grow down
~~~

默认保留八个卷。彻底重练时确认无数据需要后再加 `-v`；必须包含 grow profile，才能覆盖扩容实验的对象。只删 nodes.conf 而保留其他数据可能造成状态混乱，重做练习应从一套明确的空卷开始。

## 继续阅读

- [命令与配置说明](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/)
- [进一步了解相关机制](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
