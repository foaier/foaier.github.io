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

## 留一个小练习

关闭 Docker Desktop 后再运行 `docker version`，观察 Server 部分发生什么；再重新打开。理解这一点，后面遇到 daemon unavailable 时就不会尝试重装整套系统。

## 没跑通时先查什么

Windows 检查 WSL 发行版集成是否针对当前发行版开启，安装/更新 WSL 后重新开终端。Linux 报 permission denied 时，先按发行版文档处理组权限或使用 sudo；把用户加进 docker 组等同授予很高的主机控制权，不能当成无害快捷方式。代理与 DNS 问题看拉取错误，不要只盯着 version。

`docker info` 也能看引擎详情，但它输出信息很多，还可能包含内部地址；求助时别整份贴到公开论坛。安装完成后把客户端版本、Engine 版本和系统发行版记在自己的笔记里，团队协作时有助于判断同一命令为何在不同电脑上表现不一样。

## 参考资料

- [Docker Desktop](https://docs.docker.com/desktop/)
- [Linux 上安装 Docker Engine](https://docs.docker.com/engine/install/)
