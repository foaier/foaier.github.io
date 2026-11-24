---
title: "先记住这几条 Docker 命令：运行、查看、停止和清理"
date: "2026-11-24"
summary: "用一个临时 Nginx 容器练习生命周期，分清 stop、rm 和镜像清理。"
series: "Docker 与 Kubernetes"
order: 4
tags: ["Docker 基础","Docker","Kubernetes"]
level: "Docker 基础"
prerequisites: ["docker-install"]
goals: ["可以从命令行启动、查看、停止并删除一个练习容器。"]
---

刚开始学 Docker，不用背上百条命令。日常最常见的循环其实很短：启动一个容器，确认它在不在，看输出，停掉，再决定要不要删除。知道自己正在操作哪一层，比记得一个 `prune` 命令更重要。

## 启动、停止和删除分别改了什么

`run` 创建并启动容器；`ps` 查看运行状态；`stop` 结束进程但保留容器记录；`rm` 删除已停止的容器。镜像又是另一类对象，先用 `image ls` 查看。不要把 `stop` 当删除，也别以为删除容器就一定移除了数据卷。

## 把一个容器从创建用到清理

下面故意让 Nginx 在后台跑，然后停掉但不删除，查看它仍出现在 `ps -a`；最后明确删除 named container。Windows PowerShell 和 macOS/Linux 都可直接运行这些单行命令。

~~~powershell
docker run -d --name lesson-web -p 127.0.0.1:8080:80 nginx:alpine
docker ps
docker stop lesson-web
docker ps -a
docker rm lesson-web
docker image ls nginx
~~~

## 怎么确认做对了

stop 之后，`docker ps` 看不到它；`docker ps -a` 仍能看到 Exited。rm 后容器记录消失，镜像仍在 image ls 里。每条命令处理的对象不同，这个差别就是 Docker 日常清理的基本功。

## 留一个小练习

把 `--name` 换成另一个名字，停止和删除时也必须使用新名字。再运行两个同名容器，看看 Docker 为什么拒绝第二个。明确名称能让后续脚本更好读，也避免命令误操作到别的练习。

## 没跑通时先查什么

名字已占用通常是旧容器还在，包括已经退出的容器。用 `docker ps -a` 找到它，确认确实是你的练习，再 rm。不要一上来跑 `docker system prune -a --volumes`：它可能删掉其他项目镜像和本地数据。清理前先看清将删什么。

容器名称也能帮助你隔离不同练习：Compose 会自动按项目名加前缀，直接 docker run 则要自己指定。先用明确名字做小练习，再看 `docker ps --filter name=lesson-web` 定位对象。能准确找对象，清理才不需要一把扫掉整台机器上的东西。

## 参考资料

- [docker container 命令](https://docs.docker.com/reference/cli/docker/container/)
- [Docker 入门](https://docs.docker.com/get-started/)
