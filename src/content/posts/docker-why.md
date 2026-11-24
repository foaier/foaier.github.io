---
title: Docker 是什么：镜像、容器、仓库和虚拟机一次分清
date: '2026-11-24'
summary: 从 Java 程序换机器跑不起来讲起，认识 Docker 的交付方式与边界。
series: Docker 与 Kubernetes
order: 1
tags:
  - Docker
  - Docker 入门
level: Docker 入门
prerequisites: []
goals:
  - 解释镜像、容器和仓库的关系，分清容器与虚拟机。
---
Docker 不是新的编程语言，也不是用来写业务的框架。它解决的是交付问题：把程序和运行它需要的文件打包起来，让另一台机器按同样的方式启动。

例如你写了一个 Java 网站，本机有 Java 21，测试服务器只有 Java 17。把 JAR 复制过去，并不代表网站能运行。换成 Docker 后，你交付的是“Java 21 运行环境 + JAR + 启动说明”这份镜像。测试服务器按镜像启动容器，就少了一项需要人工对齐的配置。

## 镜像、容器、仓库先分清

| 名称 | 可以怎样理解 | 网站例子 |
|---|---|---|
| 镜像 Image | 已经打包好的程序模板，只读 | `nginx:stable-alpine` |
| 容器 Container | 从模板启动的一份程序，有自己的运行状态 | 用该镜像启动的 `web` |
| 镜像仓库 Registry | 保存和分发镜像的服务 | Docker Hub、企业镜像仓库 |

一个镜像可以创建多个容器。就像同一份安装包可以供多人使用，两个容器不会因为来源相同就变成同一个程序。删除容器与删除镜像是两件事；数据库文件要单独安排保存位置。

Repository 是仓库服务中的一个镜像名称，例如 `library/nginx`；tag 是它的标签，例如 `stable-alpine`。不写标签时默认使用 `latest`，但这个词不保证版本最新，也不代表永远不变。

## Docker 和虚拟机到底差在哪

~~~text
虚拟机：硬件 → 虚拟化软件 → 每台虚拟机自己的内核 → 应用
Linux 容器：Linux 内核 → 隔离开的进程和文件视图 → 应用
~~~

虚拟机运行一整套操作系统。Linux 容器通常共享运行环境的 Linux 内核，只带应用和必要的用户空间文件，因此启动往往更快，额外占用也更小。Ubuntu 镜像里没有一套等待开机的 Ubuntu 内核。

Windows、macOS 上的 Docker Desktop 会提供一个 Linux 环境来跑 Linux 容器。所以“共享内核”指共享这个 Linux 环境的内核，不能理解成 Linux 程序直接共用 Windows 内核。

| 比较项 | 容器 | 虚拟机 |
|---|---|---|
| 隔离范围 | 进程、网络、文件视图等 | 一套独立操作系统 |
| 启动过程 | 启动应用进程 | 启动操作系统，再启动应用 |
| 适合什么 | 交付服务、测试依赖、多环境部署 | 不同操作系统、完整机器环境 |
| 需要检查什么 | 内核能力、CPU 架构、挂载与权限 | 虚拟机镜像、硬件资源、系统配置 |

容器不是绝对安全的沙箱，也不是可以无条件跨平台的万能安装包。ARM 和 x86 镜像、Linux 和 Windows 镜像都要匹配运行环境。

## 敲一条 docker 命令，谁在干活

~~~text
终端里的 docker 命令
        ↓ 发请求
Docker Engine 后台服务
        ├─ 本机没有镜像 → 从仓库下载
        └─ 按镜像和参数 → 创建网络、挂载文件、启动容器
~~~

命令行客户端负责发请求，后台 Engine 负责执行。客户端在电脑上不等于后台已经启动。后面看到 `Cannot connect to the Docker daemon` 时，应先查后台服务，而不是改网站代码。

## 用一次运行串起三个概念

还没装 Docker，就先去[安装课](/articles/docker-install/)，安装后回来执行。以下两条命令不依赖项目文件，可以在任意目录运行：

~~~bash
docker pull hello-world
docker run --name hello-demo hello-world
~~~

`pull` 下载镜像；`run` 从镜像创建容器，运行里面的测试程序。出现 `Hello from Docker!` 后程序执行完毕，容器随之停止。停止不等于出错，要看程序是不是本来就该结束。

~~~bash
docker image ls hello-world
docker ps -a --filter name=hello-demo
docker rm hello-demo
~~~

应看到镜像仍在，容器在删除前是 `Exited (0)`，删除后不再出现。`0` 通常表示正常退出。这里不删除 hello-world 镜像，后面还可以反复创建容器。

## 换台电脑时哪些东西还得带

镜像解决运行文件的一致性，端口、数据库地址、密码和数据不是靠“同一个镜像”自动变出来的。部署一套网站时，你通常还需要说明：发布哪个端口、连哪个数据库、数据放在哪、程序怎么检查健康。

接下来的顺序是：装好 Docker → 管理镜像和容器 → 运行 Nginx、MySQL、Redis → 写 Dockerfile → 把多个服务交给 Compose。遇到陌生命令先看参数和预期结果，再自己改一个值观察变化。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-docker/)
- [进一步了解相关机制](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/)
