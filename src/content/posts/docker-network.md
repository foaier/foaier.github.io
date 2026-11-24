---
title: Docker 网络：名字怎么找到容器，localhost 又指向谁
date: '2026-11-24'
summary: 自建网络、按名字访问、断开后恢复，再比较四种网络模式。
series: Docker 与 Kubernetes
order: 12
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - docker-redis
goals:
  - 验证容器 DNS 和网络连接，避免依赖临时 IP。
---
在 API 容器里写 `localhost:3306`，它找的是 API 自己，不是另一个 MySQL 容器。Docker 网络解决的是“这些容器怎样互相找到、互相连接”。这节用两个容器把名字解析、端口访问和网络隔离分开验证。

准备：Bash、Docker。无需运行数据库，任意目录执行即可。使用独立网络 `network-note`。

## 建自己的网络，用名字访问网页

~~~bash
docker network create network-note
docker run --name network-web -d --network network-note nginx:stable-alpine
docker run --rm --network network-note busybox:1.37 nslookup network-web
docker run --rm --network network-note busybox:1.37 wget -qO- http://network-web
~~~

nslookup 应解析出容器地址，wget 应打印 Nginx HTML。这里没有 `-p`，但同网络的客户端仍能访问容器端口 80。`-p` 解决主机访问容器，不是容器之间通信的必要条件。

用户自建 bridge 网络提供按容器名发现服务的能力。默认的 bridge 网络不能按相同方式假定容器名 DNS 可用，因此多服务练习主动创建网络。

## 查看连接关系，别把 IP 写死

~~~bash
docker network ls
docker network inspect network-note
docker inspect network-web --format '{{json .NetworkSettings.Networks}}'
~~~

inspect 的 Containers 中应有 network-web。容器重建后 IP 可以变化，长期配置用名字。你看到的桥接网卡位于运行 Docker Engine 的 Linux 环境中，Desktop 用户在 Windows 的网络列表里不一定看到同样的 docker0。

~~~text
network-note 网络
    客户端 → DNS 找 network-web → 容器 IP:80 → Nginx
本机浏览器要访问它？另加 -p 发布主机端口
~~~

## 四种网络方式分别用在哪里

| 模式 | 行为 | 注意 |
|---|---|---|
| 自建 bridge | 容器有自己的地址，网络内可按名字互访 | 本系列多服务主线 |
| host | 共用主机网络 | Linux 上直接占主机端口；Desktop 支持条件不同，`-p` 不再有同样作用 |
| none | 只有本地回环，没有通常的外部连接 | 离线任务或网络隔离实验 |
| container:名字 | 共享指定容器的网络空间 | localhost 相同，但文件系统仍分开 |

用 none 看一下接口，再共享网页容器的网络执行请求：

~~~bash
docker run --rm --network none alpine:3.22 ip addr
docker run --rm --network container:network-web busybox:1.37 wget -qO- http://127.0.0.1
~~~

第二条能访问网页，因为两个进程这次在同一个网络空间里。这不是通常独立容器的 localhost 行为，也不会把两个容器的磁盘合并。

## 故意断开网络，再恢复

~~~bash
docker network disconnect network-note network-web
docker run --rm --network network-note busybox:1.37 wget -T 3 -qO- http://network-web
docker network connect network-note network-web
docker run --rm --network network-note busybox:1.37 wget -T 3 -qO- http://network-web
~~~

断开后应该请求失败；重新接入后恢复 HTML。若 DNS 或网络更新有短暂延迟，等一下再试。这个实验说明故障并不总在 Nginx 配置，也可能是两个容器根本不在同一网络。

`-T 3` 是这里 BusyBox wget 的超时参数，避免失败时一直等。Docker network connect/disconnect 是在改连接关系，不是在重建应用。

## 从名字到应用，一层层排查

先确认容器正在运行且在同一网络；再 nslookup 名称；再检查目标端口；最后看应用日志。名字能解析不代表目标有进程监听。Connection refused 常是端口没服务，超时可能是网络阻断或对端忙，HTTP 500 则已经进入应用处理。

数据库无需为 API 访问而发布到所有网卡。后面 Compose 会自动给项目建网络，API 连 `mysql:3306`、`redis:6379`，避免把临时 IP 固定进配置。

~~~bash
docker rm -f network-web
docker network rm network-note
~~~

网络提示 active endpoints 时，先用 inspect 查还有哪个容器连接，再清理对应实验对象，不要删除全部网络。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/engine/network/)
- [进一步了解相关机制](https://docs.docker.com/engine/network/drivers/bridge/)
