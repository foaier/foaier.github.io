---
title: "Kubernetes 值得学吗？先从 Docker Compose 的边界看起"
date: "2026-11-24"
summary: "先不背术语，看看一台电脑什么时候不够用，以及 K8s 能帮什么忙。"
series: "Docker 与 Kubernetes"
order: 19
tags: ["Kubernetes 入门", "Docker"]
level: "Kubernetes 入门"
prerequisites: ["docker-compose"]
goals: ["能用自己的话区分 Docker Compose 和 Kubernetes，知道什么时候值得学集群。"]
---

如果你只想在自己的电脑上同时启动一个网站和一个数据库，Docker Compose 通常已经够用。Kubernetes（常简称 K8s）主要处理另一类麻烦：程序要放到几台机器上跑、机器或程序坏了要补回来、更新时要少停机。今天先判断它解决什么，不需要安装任何新工具。

## 先看看 Compose 已经替你做了什么

如果你在前面课程里下载了解压了 `container-course` 示例，把终端打开在这个文件夹中。下面两条命令只查看配置，不会启动或停止程序：

~~~powershell
docker compose config --services
docker compose ps
~~~

第一条会列出 API 和数据库服务；第二条显示它们当前是否运行。Compose 知道这两项服务怎样在**这台电脑**上一起启动。机器关机后，它不会自动把服务搬到另一台机器上。

## 多台机器会多出哪些麻烦

想象网站访问量增加，单台机器不够用。除了多开几个程序，还得回答：新程序放在哪台机器？它们的地址变了，其他服务怎么找到它们？一台机器坏了，谁发现并补一个副本？更新出错了，怎么停下来？Kubernetes 就是负责协调这些事情的平台。

先认识三个词就够了：**集群**是一起工作的机器；**节点**是集群里的一台机器；**副本**是同一个程序运行的一份实例。后面会亲手创建本地练习集群，再逐个拆开看它怎么工作。

## Compose 和 Kubernetes 各适合做什么

| 你现在要做的事 | 通常从哪里开始 | 原因 |
|---|---|---|
| 本机同时启动网站和数据库 | Docker Compose | 只有一台电脑，配置少，排错也简单 |
| 在多台机器上运行、更新和补齐程序 | Kubernetes | 它能协调不同节点上的程序实例 |
| 只想自动构建 Docker 镜像 | GitHub Actions 等 CI 工具 | 构建镜像不需要先有 Kubernetes 集群 |
| 保存数据库、恢复误删数据 | 数据库备份方案 | Kubernetes 不会自动替数据库备份 |

Kubernetes 也会带来额外工作：要升级集群、管理权限和网络、观察资源用量，还得安排人处理故障。它不会自动把普通程序变成高可用程序，也不会因为有两个副本就自动备份数据库。

## 给自己做个选择

写下你当前遇到的一个真实麻烦：是本机启动服务太难，还是多台机器的发布、扩容和故障恢复太难？前者先把 Docker 和 Compose 学顺；后者再继续学 Kubernetes。下一篇会在自己的电脑上搭一个可随时删除的练习集群，不会碰公司的服务器。

## 参考资料

- [Kubernetes 是什么](https://kubernetes.io/docs/concepts/overview/)
- [Docker Compose 概览](https://docs.docker.com/compose/)
