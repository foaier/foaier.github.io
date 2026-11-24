---
title: "装好 Docker，再用两条命令确认它真的能干活"
date: "2026-11-24"
summary: "按 Windows、macOS 或 Linux 选择安装方式，并验证 CLI 与后台引擎连通。"
series: "Docker 与 Kubernetes"
order: 3
tags: ["Docker 基础","Docker","Kubernetes"]
level: "Docker 基础"
prerequisites: ["docker-image-container"]
goals: ["完成 Docker 安装并分辨客户端、后台引擎和镜像仓库。"]
---

安装向导结束，不等于开发环境已经准备好。最省事的检查不是打开设置页逐项猜，而是让 Docker 拉取并运行一个小容器。Windows 用户用 Docker Desktop + WSL 2 是常见起点；Linux 服务器通常直接安装 Docker Engine。不要混着照搬不同系统的服务管理命令。

## 概念讲透：它负责什么，不负责什么

平时敲的 docker 是客户端，它把请求交给 Docker Engine API；后台引擎负责管理镜像、网络、卷和容器，镜像则从仓库下载。客户端能运行不等于引擎能用，能访问引擎也不等于仓库认证成功。Windows 和 macOS 的 Docker Desktop 会提供 Linux 容器运行环境；Linux 通常由 Docker Engine 服务直接管理。

## 运行过程拆解：从输入到结果

排查安装时按请求经过的顺序走：终端能否找到 CLI、CLI 能否连上本机或远程 Engine、Engine 能否访问镜像仓库、镜像能否成功创建容器。每一段有独立错误信息。比如认证失败发生在仓库，权限拒绝可能发生在本地 socket，混在一起重装 Docker 往往既慢又解决不了真正问题。

## 命令行、引擎和仓库各负责一段

输入的 `docker` 是客户端命令，它需要联系后台 Docker Engine 才能建容器。首次运行缺少镜像时，Engine 再去 Registry 下载镜像。所以报错时要区分：CLI 没安装、Engine 没启动、网络拉取失败，这三层不是同一件事。

## 按自己的系统完成安装检查

Windows 先在 Docker Desktop 设置里确认 WSL 2 backend 已开启，再打开新的 PowerShell。macOS 打开 Docker Desktop；Ubuntu 一类 Linux 安装 Docker Engine 与 Compose plugin，并确认当前用户有使用 daemon 的权限。最后用 version 看客户端和服务器信息，再跑 hello-world。

~~~powershell
docker version
docker run --rm hello-world
~~~

## 怎么确认做对了

`docker version` 会分别显示 Client 和 Server。只有 Client 没有 Server 时，说明命令存在，但后台服务尚未连接。随后测试容器应完整输出欢迎消息并退出。这是安装自检，不需要先创建项目文件。

## 案例推演

终端显示 docker --version 正常，但 docker run 报无法连接 daemon。这个结果只证明客户端装好了。接着检查 Docker Desktop 是否启动、当前容器模式和 WSL 集成是否正常；Linux 则检查服务状态与当前用户的 socket 权限。最后再运行 hello-world，把“命令存在、引擎可达、镜像能拉取、容器能运行”逐层验证。

## 留一个小练习

关闭 Docker Desktop 后再运行 `docker version`，观察 Server 部分发生什么；再重新打开。理解这一点，后面遇到 daemon unavailable 时就不会尝试重装整套系统。

## 没跑通时先查什么

Windows 检查 WSL 发行版集成是否针对当前发行版开启，安装/更新 WSL 后重新开终端。Linux 报 permission denied 时，先按发行版文档处理组权限或使用 sudo；把用户加进 docker 组等同授予很高的主机控制权，不能当成无害快捷方式。代理与 DNS 问题看拉取错误，不要只盯着 version。

`docker info` 也能看引擎详情，但它输出信息很多，还可能包含内部地址；求助时别整份贴到公开论坛。安装完成后把客户端版本、Engine 版本和系统发行版记在自己的笔记里，团队协作时有助于判断同一命令为何在不同电脑上表现不一样。

## 生产里怎么用、怎么排障

线上机器常见问题不是没装 CLI，而是 Docker socket 权限、磁盘分区、代理、仓库证书和 daemon 配置不一致。把用户加入 docker 组通常相当于授予接近 root 的权限，不能当普通只读权限发给所有人。安装升级要固定来源、窗口和回退包；验证服务恢复时同时看 daemon 状态、镜像拉取、容器启动和应用探活，不要只看版本号。

## 参考资料

- [Docker Desktop](https://docs.docker.com/desktop/)
- [Linux 上安装 Docker Engine](https://docs.docker.com/engine/install/)
