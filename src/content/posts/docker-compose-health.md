---
title: 健康检查实战：数据库停了，API 为什么还活着
date: '2026-11-24'
summary: 停掉 MySQL，观察 live、ready 和 unhealthy，再恢复业务读写。
series: Docker 与 Kubernetes
order: 18
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - docker-compose
goals:
  - 解释 healthcheck、depends_on 和 restart 的不同职责。
---
容器进程存在，和用户能成功保存留言，是两件事。Java API 还在，但数据库停止后，写入一定失败。健康检查就是定期运行一个小检查，把“程序是否可用”变成可观察状态。

准备：[Compose 留言项目](/articles/docker-compose/)已能写入记录。打开 Bash，进入 `~/docker-labs`。本节故意停课程数据库，别在业务环境照做。

## 先拿到正常状态

~~~bash
cd ~/docker-labs
docker compose up -d --wait --wait-timeout 240
docker compose ps
curl -f http://localhost:8080/health/live
curl -f http://localhost:8080/health/ready
~~~

live 只说明 HTTP 进程能回答；ready 会查询 MySQL，并向 Redis 发一个请求。正常分别返回 alive、ready。读文章时要看检查究竟做了什么，不能看到健康接口名字就以为它一定检查了数据库。

## healthcheck 的字段怎么算

~~~yaml
healthcheck:
  test: ["CMD", "curl", "-fsS", "http://localhost:8080/health/ready"]
  interval: 5s
  timeout: 8s
  retries: 6
  start_period: 40s
~~~

这段在 app 服务内执行。test 使用最终镜像中明确安装的 curl，`-f` 遇到 HTTP 错误时返回非零退出码。interval 是两次检查之间的等待，timeout 限制单次时长，retries 是连续失败阈值，start_period 给启动阶段宽限。

总判定时间不能只把 interval 乘 retries 当成精确承诺，还受到执行耗时、起始时刻和宽限期影响。健康检查应便宜、可重复，不应该每几秒跑一次全库扫描。

## 停数据库，看进程与健康分开变化

~~~bash
docker compose stop mysql
curl -i http://localhost:8080/health/live
curl -i http://localhost:8080/health/ready
docker compose ps
~~~

live 通常仍为 200，ready 应为 503；过一段时间 app 会变为 unhealthy。若立刻看还是 healthy，等几个检查周期再查看，这不是检查没有生效。

~~~bash
APP_ID=$(docker compose ps -q app)
docker inspect "$APP_ID" --format '{{json .State.Health}}'
docker compose logs --tail 30 app
~~~

State.Health 的 Log 里有 ExitCode 和 Output，可以判断是接口返回 503、命令不存在，还是检查超时。若 `$APP_ID` 为空，先查 ps --all，别拿空变量继续执行 inspect。

## depends_on 只管启动阶段吗

本项目让 app 等待 mysql、redis 的 service_healthy，避免数据库初始化还没完成就立刻发送请求。但应用运行后数据库故障，Compose 不会自动把 app 变成永不失败的服务。

`restart: unless-stopped` 处理的是容器进程退出后的重启策略。unhealthy 不等于进程退出，因此普通 Docker/Compose 不会仅因 unhealthy 自动重启容器。

恢复数据库：

~~~bash
docker compose start mysql
docker compose up -d --wait --wait-timeout 240
curl -f http://localhost:8080/health/ready
curl -f http://localhost:8080/visits
~~~

应恢复 ready，旧留言仍在。若连接池暂时还在恢复，先看日志和健康记录，再重试。应用应该自己处理依赖短暂不可用，不能把所有恢复责任推给 Compose。

## 检查失败别直接把阈值调大

先问五个问题：命令在镜像里吗；检查发生在容器内还是宿主机；端口是不是应用真正监听的；接口是否需要认证；超时是启动慢还是依赖真的坏了。把 retries 从 6 改到 60，可能只是晚几分钟发现同一个故障。

线上还要考虑流量入口如何使用健康状态。Compose 的 healthcheck 本身不会替你的反向代理配置摘除后端。Kubernetes 的 readiness 与 Service 联动，是后半部分的新能力，不要混到 Docker 里理解。

## 结束前确认业务恢复

~~~bash
curl -f -X POST --data-urlencode 'note=数据库恢复后新增' http://localhost:8080/visits
docker compose ps
docker compose down
~~~

看到新留言写入、三项服务 healthy 后再关闭实验。down 保留命名卷，下一课备份与更新继续用这份数据。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/compose/how-tos/startup-order/)
- [进一步了解相关机制](https://docs.docker.com/reference/compose-file/services/)
