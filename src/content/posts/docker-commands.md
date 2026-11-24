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

## 概念讲透：它负责什么，不负责什么

常用操作围绕四类对象：镜像是模板，容器是实例，网络连接实例，卷保存实例之外的数据。stop 让进程有机会结束，rm 删除已停止的容器，rmi 删除本地镜像引用，prune 则按筛选规则清理未使用对象。删容器不等于删卷，删标签也不一定立刻回收被其他标签引用的层。先确认对象，再做删除命令。

## 运行过程拆解：从输入到结果

容器状态可以画成 created → running → exited → removed。stop 会先给主进程发送终止信号并等待，超时后才可能强制结束；rm 删除已停止的实例。对带数据库卷的容器，删掉实例后卷通常还在；对只写可写层的文件则跟实例一起消失。先用 ps 和 inspect 认对象，再决定动作。

## 启动、停止和删除分别改了什么

`run` 创建并启动容器；`ps` 查看运行状态；`stop` 结束进程但保留容器记录；`rm` 删除已停止的容器。镜像又是另一类对象，先用 `image ls` 查看。不要把 `stop` 当删除，也别以为删除容器就一定移除了数据卷。

## 把一个容器从创建用到清理

下面故意让 Nginx 在后台跑，然后停掉但不删除，查看它仍出现在 `ps -a`；最后明确删除 named container。Windows PowerShell 和 macOS/Linux 都可直接运行这些单行命令。

~~~powershell
docker run -d --name lesson-web -p 127.0.0.1:8080:80 nginx:alpine
docker ps
docker stop lesson-web
docker ps -a
docker image ls nginx
~~~

## 怎么确认做对了

stop 之后，`docker ps` 看不到它；`docker ps -a` 仍能看到 Exited。这个阶段容器还没删，先留着给下面的 inspect 检查。每条命令处理的对象不同，这个差别就是 Docker 日常清理的基本功。

## 案例推演

开发机磁盘告急，有人准备复制一条网上的 prune 全清命令。先用 docker system df 找出镜像、构建缓存、容器和卷各自占用，再列出正在使用的容器和卷。确认练习容器可以删后，先 stop 再 rm，最后只清理未使用的构建缓存。不要在有数据库卷的机器上把“清空间”变成“删业务数据”。

## 留一个小练习

等下面把本课容器删掉后，再把 `--name` 换成 `lesson-web-2` 重做一遍。试着连续创建两个同名实例，看看 Docker 为什么拒绝第二个。明确名称能让后续脚本更好读，也避免命令误操作到别的练习。

## 没跑通时先查什么

名字已占用通常是旧容器还在，包括已经退出的容器。用 `docker ps -a` 找到它，确认确实是你的练习，再 rm。不要一上来跑 `docker system prune -a --volumes`：它可能删掉其他项目镜像和本地数据。清理前先看清将删什么。

容器名称也能帮助你隔离不同练习：Compose 会自动按项目名加前缀，直接 docker run 则要自己指定。先用明确名字做小练习，再看 `docker ps --filter name=lesson-web` 定位对象。能准确找对象，清理才不需要一把扫掉整台机器上的东西。

## 检查当前实例，再删容器记录

`docker ps -a` 里这时应该还能看到刚刚停止的 `lesson-web`。inspect 再核对它的状态和来源镜像；确定对象没搞错后，删掉容器记录，再检查 Nginx 镜像仍留在本机。这样也能看清容器和镜像的生命周期并不相同。

~~~powershell
docker inspect lesson-web --format '{{.State.Status}} {{.Config.Image}}'
docker rm lesson-web
docker image ls nginx:alpine
~~~


## 生产里怎么用、怎么排障

生产清理通常要设保留策略：旧镜像按版本和回滚窗口回收，日志按大小和时间轮转，卷必须经数据负责人确认。--volumes 会扩大清理范围，使用前逐个检查卷归属和备份状态。脚本应输出将删除的对象、先 dry-run 或按标签选择，并留审计记录；不要在故障时靠一条范围很大的命令碰运气。

## 参考资料

- [docker container 命令](https://docs.docker.com/reference/cli/docker/container/)
- [Docker 入门](https://docs.docker.com/get-started/)
