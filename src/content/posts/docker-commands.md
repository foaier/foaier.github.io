---
title: 日常先会这几条：查看、看日志、停止和清理容器
date: '2026-11-24'
summary: 用一台临时网页服务器练习 Docker 最常用的容器管理命令。
series: Docker 与 Kubernetes
order: 4
tags:
  - Docker
  - Docker 入门
level: Docker 入门
prerequisites:
  - docker-image-container
goals:
  - 会查容器状态和日志，并能安全地区分停止、删除容器与删除镜像。
---

不需要一开始背几十条 Docker 命令。先用同一个临时网页练会四件事：确认它在不在、看它说了什么、停止它、收拾干净。

## 启动一个有名字的练习容器

在终端执行：

~~~powershell
docker run --name command-lab -d -p 127.0.0.1:8083:80 nginx:alpine
docker ps
~~~

浏览器打开 `http://localhost:8083`，应该能看到 Nginx 欢迎页。若 8083 被占用，换一个本机端口即可；冒号右边的 80 是 Nginx 在容器内使用的端口，不要跟着改。

## 查看状态和日志

`docker ps` 只显示正在运行的容器；想找已经退出的容器，用 `docker ps -a`。`docker logs` 查看程序写到标准输出和标准错误的日志；`-f` 会持续跟随新日志，按 Ctrl+C 退出查看，不会停止容器。

~~~powershell
docker ps -a
docker logs --tail 20 command-lab
docker logs -f command-lab
~~~

Nginx 欢迎页通常不会产生很多日志。可以刷新浏览器，再运行 `docker logs --tail 20 command-lab` 看访问记录。看日志不是进容器改文件；它只是读取程序输出。

## 停止和重新启动

~~~powershell
docker stop command-lab
docker ps -a
docker start command-lab
docker ps
~~~

停止后容器仍然存在，所以 `docker start` 可以再次启动它。网页应重新可访问。`docker restart` 则是停止再启动的快捷操作；它不会删除容器，也不会修复应用自身的问题。

## 删除前先看清楚删什么

~~~powershell
docker stop command-lab
docker rm command-lab
docker ps -a
docker image ls
~~~

`docker rm` 删除容器，`docker image rm nginx:alpine` 删除镜像。两者是不同对象。容器还在运行时，普通 `docker rm` 会拒绝；先停止再删。这里不要使用 `docker system prune -a --volumes` 之类全局清理命令，它可能清除其他项目仍在使用的数据。

## 出现问题时先收集证据

如果网页打不开，先 `docker ps -a` 看状态，再 `docker logs --tail 50 command-lab` 看错误。如果容器是 Exited，日志通常比立刻重启更有用；如果容器是 Up，再检查端口有没有映射、主机端口有没有被占用。下一课会用一次故意失败的容器练完整排错顺序。

练习：把命令中的主机端口 8083 换成 8084，再启动另一个名字不同的容器。两者能同时运行吗？回答时请说明容器内端口和本机端口各是哪一个。

## 参考资料

- [Docker 容器常用命令](https://docs.docker.com/reference/cli/docker/container/)
- [docker logs 命令](https://docs.docker.com/reference/cli/docker/container/logs/)
