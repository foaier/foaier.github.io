---
title: Compose 完整实战：Java + MySQL + Redis 留言服务
date: '2026-11-24'
summary: 下载完整项目，一次启动三项服务，写留言并到数据库和 Redis 对账。
series: Docker 与 Kubernetes
order: 17
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - docker-config-secrets
goals:
  - 用 Compose 部署并验收一套有依赖、有数据的应用。
---
前面手工启动 Java、MySQL、Redis，分别记名字、网络、密码和卷，第三次重建就容易漏参数。Compose 把这些运行说明写进一份 YAML，再用同一组命令管理整套应用。它主要管理一台 Docker 引擎上的服务，不会自动把程序调度到多台服务器。

本节完成一个留言实验：Java API 接收文本，MySQL 保存记录，Redis 记录计数。所有文件都在[Docker 实验包](/downloads/docker-labs.zip)，不需要你自行补代码。

## 先到正确目录，再看三个服务

将实验包解压到 `~/docker-labs`。打开 Bash：

~~~bash
cd ~/docker-labs
ls compose.yaml java-app mysql redis
docker compose version
docker compose config --services
~~~

最后应列 app、mysql、redis。看到 no configuration file provided，说明当前目录没有 compose.yaml；使用完整路径 `docker compose -f /实际路径/compose.yaml ...` 也可以，但本课统一在目录中执行。

源码包不是 Git 仓库，不需要先 git clone，也不要求本机装 JDK。第一轮构建会从 Maven 镜像编译 Java。

## 先读配置里最重要的几段

这是文件中的核心关系，**用于讲解，不是完整替代文件**：

~~~yaml
services:
  app:
    build: ./java-app
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      DB_URL: jdbc:mysql://mysql:3306/notes
      REDIS_HOST: redis
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
~~~

build 指向 Dockerfile 所在的项目；ports 让电脑访问 API。连接地址里的 mysql、redis 是 Compose 服务名，同项目网络里的容器可以按名字访问。不要把这里改成 localhost，也不要把 MySQL 的临时 IP 抄进去。

完整文件还写了密码、命名卷和健康检查。MySQL、Redis 不发布主机端口；API 到它们的访问走内部网络，不需要先把数据库暴露给电脑。

## 一次启动，分别验证三层

~~~bash
docker compose config -q
docker compose up --build -d --wait --wait-timeout 240
docker compose ps
curl -f http://localhost:8080/
curl -f http://localhost:8080/health/ready
~~~

第一次构建可能花较长时间，240 秒是等待启动健康的窗口，不是 Maven 构建的总时间上限。ps 应看到三个服务 healthy。首页 message 是 hello-compose；ready 应显示 mysql、redis connected。

up 是创建或协调当前配置，`--build` 构建应用镜像，`-d` 后台运行，`--wait` 等服务状态达到要求。只看到容器 Up 不能代替真实 HTTP 验收。

## 写一条留言，再去数据库对账

~~~bash
curl -f -X POST --data-urlencode 'note=我的第一条容器留言' http://localhost:8080/visits
curl -f http://localhost:8080/visits
docker compose exec mysql mysql -uapp -p notes
~~~

密码输入 `local-app-only`，进入 mysql> 后执行：

~~~sql
SELECT id, note FROM visits ORDER BY id;
EXIT;
~~~

应看到刚才那条留言。再在宿主 Bash 看 Redis：

~~~bash
docker compose exec -e REDISCLI_AUTH=local-redis-only redis redis-cli GET visits
~~~

这是教学计数：一次成功请求大致增加一次，数据库写入与 Redis 更新不是同一个事务。不要拿它保证支付次数或订单一致性。复杂业务需要事务、重试和幂等设计。

## 一组日常命令，避免重建错对象

| 命令 | 用途 |
|---|---|
| `docker compose ps --all` | 包括退出服务一起看 |
| `docker compose logs --tail 50 app` | 看 API 日志 |
| `docker compose exec mysql ...` | 在 MySQL 服务容器里执行命令 |
| `docker compose stop` | 只停止，保留容器 |
| `docker compose start` | 启动已存在容器 |
| `docker compose up -d` | 按配置创建/重建需要更新的服务 |
| `docker compose down` | 删除该项目容器和网络，默认保留命名卷 |

`docker-compose` 是旧独立命令；本课程统一使用 Compose 插件的 `docker compose`。新配置也不需要顶层 `version: '3'`。

## 故障先查哪个服务

up 等待超时先 `docker compose ps --all`，再针对失败服务看日志。MySQL 认证失败常是复用了旧卷；表不存在检查 mysql/init.sql 是否首次初始化时执行过。更新 init.sql 不会自动修改已有数据库，要执行迁移或 SQL。

完成后 `docker compose down` 即可保留留言数据。下一课还要启动这些服务做健康检查，先不要加 `-v` 删除卷。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/compose/)
- [进一步了解相关机制](https://docs.docker.com/reference/compose-file/)
