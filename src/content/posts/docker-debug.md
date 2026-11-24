---
title: 容器没起来，别猜：先看状态、日志和容器详情
date: '2026-11-24'
summary: 通过 ps -a、logs、inspect 和 exec 顺着检查容器是退出、未启动还是端口冲突。
series: Docker 与 Kubernetes
order: 5
tags:
  - Docker 基础
  - Docker
  - Kubernetes
level: Docker 基础
prerequisites:
  - docker-commands
goals:
  - 用 Docker 自带的查看命令定位一次容器启动问题。
---

终端只告诉你“Exited (1)”，很少直接告诉你业务原因。与其连着重启十次，不如按顺序问：它到底退出没有、程序打印了什么、端口和环境变量实际是什么？Docker 已经把一部分线索放在容器元数据和日志里。

## 退出码、日志和配置要一起看

`logs` 看进程的标准输出和错误；`inspect` 看镜像、端口、挂载和环境配置；`exec` 进入仍在运行的容器执行诊断命令。它们观察的是不同面。容器退出后通常不能 exec，但仍然可以看日志和 inspect。

## 故意让一个容器退出

先模拟一个马上退出的容器，再查看退出码和日志。然后启动稳定的 Nginx，inspect 看端口映射；exec 进去执行 `printenv`。执行前知道容器名，诊断时就不必到处找 ID。

~~~powershell
docker run --name exits-now alpine sh -c "echo 启动了; exit 7"
docker ps -a
docker logs exits-now
docker inspect exits-now
docker run -d --name web-debug -p 127.0.0.1:8080:80 nginx:alpine
docker exec web-debug printenv
~~~

## 容器退出时先拿状态、退出码和末尾日志

先确认实例是否存在，再读退出码和启动错误，最后只取末尾 50 行日志，避免长日志淹没第一条异常。容器不存在时去掉筛选器查真实名字；日志为空时检查程序是否把日志写入文件而非标准输出。先保存这些信息，再决定是否重启。

~~~powershell
docker ps -a --filter name=exits-now
docker inspect exits-now --format 'status={{.State.Status}} exit={{.State.ExitCode}} error={{.State.Error}}'
docker logs --tail 50 exits-now
~~~

## 容器故障先分成四类

| 看到的现象 | 优先检查 | 暂时不要做 |
|---|---|---|
| 容器很快退出 | inspect 的 ExitCode、State.Error、logs | 反复 restart 掩盖第一次错误 |
| 容器运行但访问不到 | 监听地址、端口映射、应用日志 | 先开放所有网卡或关闭防火墙 |
| 健康状态是 unhealthy | Healthcheck 的测试命令和最近结果 | 把 unhealthy 当成进程已经退出 |
| 偶发变慢 | stats、应用日志、依赖服务状态 | 只看一次 CPU 快照就改限额 |

容器状态 running 只说明主进程还活着；健康检查的结果是另一份状态。一个容器可以同时是 running 和 unhealthy。查看状态时要把进程、应用和请求路径分开判断。

## 一次失败怎么把证据收齐

创建只用于本节的 web-fail-lab。第二条故意让 Nginx 启动失败，方便观察退出容器；先保留它，再用 logs 和 inspect 找证据。

~~~powershell
docker run -d --name web-fail-lab nginx:alpine sh -c 'exit 42'
docker ps -a --filter name=web-fail-lab
docker logs web-fail-lab
docker inspect web-fail-lab --format 'status={{.State.Status}} exit={{.State.ExitCode}} error={{.State.Error}}'
docker events --since 5m --filter container=web-fail-lab
docker rm web-fail-lab
~~~

容器很快变成 exited，退出码是 42。它已经停止，因此 docker exec 无法进入；这是预期行为。现场排查时先复制错误信息、镜像摘要和日志，再删掉临时容器。若日志为空，说明程序可能在写日志前就失败，还需看 Engine 事件、Entrypoint 和启动参数。

## 日志和进程检查各有边界

docker logs 读取容器的 stdout/stderr；应用把日志只写到容器内文件时，logs 不会自动替你找到文件。docker top 看容器相关进程，docker stats 给瞬时资源采样，不替代持续监控。需要进入运行中的容器时用 exec，但不要把容器里的手工修复当成正式修复，重建后这些变化会消失。

~~~powershell
docker ps --filter name=web
docker logs --since 10m --timestamps web
docker inspect web --format 'image={{.Config.Image}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}'
docker top web
docker stats --no-stream web
docker exec web nginx -t
~~~

上面的命令假设已有名为 web 且仍在运行的 Nginx；如果没有，先按镜像和运行章节创建，不要把其他业务容器改名覆盖。exec 只适合补充证据，比如配置文件是否有效；修改完仍需把变更写回镜像或配置源。

## 从日志里分清应用错误和 Docker 错误

Connection refused 通常说明对端没有在目标地址和端口监听；超时可能是网络路径或对端无响应；HTTP 500 是应用已接到请求但处理失败。容器能启动不代表程序监听了 0.0.0.0，也不代表依赖数据库已就绪。每次排查都记下请求地址、时间、容器 ID、镜像 tag 和首次出现的错误。

## 参考资料

- [查看容器日志](https://docs.docker.com/reference/cli/docker/container/logs/)
- [inspect 命令](https://docs.docker.com/reference/cli/docker/inspect/)
