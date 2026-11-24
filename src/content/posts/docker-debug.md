---
title: "容器没起来，别猜：先看状态、日志和容器详情"
date: "2026-11-24"
summary: "通过 ps -a、logs、inspect 和 exec 顺着检查容器是退出、未启动还是端口冲突。"
series: "Docker 与 Kubernetes"
order: 5
tags: ["Docker 基础","Docker","Kubernetes"]
level: "Docker 基础"
prerequisites: ["docker-commands"]
goals: ["用 Docker 自带的查看命令定位一次容器启动问题。"]
---

终端只告诉你“Exited (1)”，很少直接告诉你业务原因。与其连着重启十次，不如按顺序问：它到底退出没有、程序打印了什么、端口和环境变量实际是什么？Docker 已经把一部分线索放在容器元数据和日志里。

## 概念讲透：它负责什么，不负责什么

docker ps 只看当前运行中的容器，ps -a 还会看到已经退出的实例；logs 看进程写到 stdout/stderr 的内容，inspect 看启动参数、挂载、网络和退出状态，exec 则进入仍在运行的容器做检查。它们回答的问题不同。容器启动失败时通常先看状态和退出码，再看日志，最后用 inspect 对照实际配置与预期配置。

## 运行过程拆解：从输入到结果

把一次失败拆成创建、启动、运行、对外服务四个阶段。创建失败查配置、镜像和权限；启动后立刻退出查退出码与日志；进程还活着但访问失败查监听端口和映射；请求已到应用却报错再查依赖与业务日志。docker logs、inspect、exec 分别提供不同阶段的证据，按层检查比反复重启更快。

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

## 怎么确认做对了

第一段输出会告诉你容器退出码为 7，logs 中能看见启动文字。inspect 返回很多 JSON，可以重点查 `.State`、`.Config`、`.NetworkSettings.Ports`。第二段 exec 会打印 Nginx 容器环境。退出码、日志和配置合起来看，才有排查价值。

## 案例推演

API 容器启动几秒就退出，开发者不断改端口。先用 docker ps -a 找到退出实例，再看 logs 和 State.ExitCode；若提示找不到 DLL，应查镜像构建产物和启动命令，而不是改端口。若进程仍运行但浏览器访问失败，再检查监听地址、端口映射和应用日志。每一步只验证一个假设，避免同时改五个配置。

## 留一个小练习

把 8080 改成已占用的端口启动另一个服务，再用 `docker ps` 和 `docker logs` 查发生了什么。记下“端口被占用”与“容器进程退出”哪一个证据来自哪里。练习目的是用证据，不是靠猜。

## 没跑通时先查什么

容器持续重启时 `docker logs --tail 100 <name>` 先看最近记录，避免刷几万行。`exec` 失败先看是否还在 Up。某些极简镜像没有 bash、curl 或编辑器，试 `/bin/sh` 或直接检查镜像里可用命令；不要为了调试随手把工具都装进生产镜像。

日志只记录程序真正写到标准输出和标准错误的内容。如果应用把日志写到容器内文件，`docker logs` 看起来就像什么都没发生；这时要先搞清日志配置和文件是否挂出，再决定收集方式。不要一边重启一边覆盖旧容器，先把错误现场留住。

下一课需要 8080。观察完成后执行 `docker stop web-debug`，再运行 `docker rm web-debug exits-now` 清理这两只明确命名的实验容器。`exits-now` 本来就已退出，不需要再次停止。

## 容器退出时先拿状态、退出码和末尾日志

先确认实例是否存在，再读退出码和启动错误，最后只取末尾 50 行日志，避免长日志淹没第一条异常。容器不存在时去掉筛选器查真实名字；日志为空时检查程序是否把日志写入文件而非标准输出。先保存这些信息，再决定是否重启。

~~~powershell
docker ps -a --filter name=exits-now
docker inspect exits-now --format 'status={{.State.Status}} exit={{.State.ExitCode}} error={{.State.Error}}'
docker logs --tail 50 exits-now
~~~


## 生产里怎么用、怎么排障

生产排错保留现场很重要。重启或删除容器可能让当前日志、退出状态和临时文件消失；先复制日志、inspect 摘要和时间线。容器里没有 shell 时，不要假设 exec 一定能用，可以用同网络的诊断容器或临时调试镜像。日志中可能有令牌和用户数据，收集后按访问控制处理，公开工单前先脱敏。

## 参考资料

- [查看容器日志](https://docs.docker.com/reference/cli/docker/container/logs/)
- [inspect 命令](https://docs.docker.com/reference/cli/docker/inspect/)
