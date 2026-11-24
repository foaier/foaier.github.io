---
title: "Docker 到底解决什么问题？先从“我电脑上能跑”说起"
date: "2026-11-24"
summary: "从换电脑就丢配置的真实烦恼，理解容器为什么能把运行环境一起带走。"
series: "Docker 与 Kubernetes"
order: 1
tags: ["Docker 基础","Docker","Kubernetes"]
level: "Docker 基础"
prerequisites: []
goals: ["说明容器解决的是环境交付与隔离问题，并举出它解决不了的事情。"]
---

你在自己电脑上把程序调通了，发给同事，他那边报错：数据库版本不同、少装了一个依赖、端口被别的软件占了。先别急着怪同事。程序跑起来不只靠源码，还靠运行时、系统库、配置和外部服务。Docker 是把这些运行条件尽量装在一个可搬动的环境里。

## 换机器时，缺的往往是运行条件

把容器想成带着固定工具和说明书的一间小工作间：不同程序可以有各自的桌子和工具，不用把所有东西装进宿主机。它不是虚拟机的轻量同义词，也不会自动替你准备数据库数据、密码和服务器网络。Docker 更不会让程序从此没有 bug；它主要让“拿什么运行”这件事变得可描述、可重复。

## 先跑一个官方测试镜像

先不建镜像，直接用 Docker 拉一个官方测试镜像跑起来。`--rm` 表示退出后清理这个临时容器，方便反复实验。命令运行前先确认 Docker Desktop 或 Docker Engine 已启动，第一次下载镜像需要网络。

~~~powershell
docker run --rm hello-world
~~~

## 怎么确认做对了

输出里会有 “Hello from Docker!”。它说明客户端联系上了 Docker daemon、镜像成功获取、容器进程确实执行并退出。要是只有“docker 命令存在”，却看不到这段文字，还不能算 Docker 服务可用。

## 留一个小练习

问自己：如果把测试镜像换成一个 Web 服务，除了程序本身，还要怎样让外面的浏览器访问它？先把猜测写下来。后面讲端口时再回来核对，这样网络章节就不是一串陌生命令。

## 没跑通时先查什么

PowerShell 报找不到 docker，先确认安装了 Docker CLI 并重开终端。报 daemon/engine 无法连接，就打开 Docker Desktop 看状态；Linux 上看服务。下载超时是网络或镜像仓库的问题，不是容器启动失败。`docker run` 会一并做拉取与启动，后面会把这几步拆开。

## 参考资料

- [Docker 入门](https://docs.docker.com/get-started/)
- [容器是什么](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/)
