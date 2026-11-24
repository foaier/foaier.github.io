---
title: "什么时候才需要 Kubernetes？先别把 Docker 扔掉"
date: "2026-11-24"
summary: "从单机 Compose 的边界出发，分清编排平台、容器运行时和 OCI 镜像。"
series: "Docker 与 Kubernetes"
order: 19
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["docker-github-actions"]
goals: ["判断一个应用是否值得上 Kubernetes，并说清 Docker 与 containerd 的关系。"]
---

一个 API 加一个数据库，用 Compose 就能把本地环境管得挺好。为什么还要再学 Kubernetes？因为事情一多，问题会变：机器坏了谁补副本，发布失败怎么停，几个服务怎么互相找到，流量增加时又该往哪台机器放。Kubernetes 是来处理这些协作问题的。

## 多台机器带来的新问题

Docker 擅长构建、分发和运行容器。Kubernetes 接收你写的期望状态，让多台节点一起完成它。你声明 API 要两个副本，控制器就不断核对现状，少了便尝试补齐。它不会自动修好错误代码，也不会替数据库生成可靠备份。

Kubernetes 节点通过 CRI 和容器运行时交流，常见实现有 containerd、CRI-O。旧的 dockershim 已经移除，但 Docker 构建的符合 OCI 规范的镜像照样能用。“不再内置对接 Docker Engine 的那层”不等于“不支持 Docker 镜像”。kind 还会用 Docker 容器模拟节点，节点里面再跑 Kubernetes，别把这几层混在一起。

## 先看看单机 Compose 管了什么

先盘点自己的机器有多少容器，看看单机上它们都归谁管理。这一课不创建集群，不需要碰当前 kubeconfig。用课程 Compose 的配置对照：它知道本机的服务组合，却不会把 API 副本分散到另外三台服务器。

~~~powershell
docker compose config --services
docker ps --format "table {{.Names}}	{{.Status}}	{{.Image}}"
~~~

## 怎么确认做对了

能列出 api、db 及本机已有容器。接下来应该能解释一个取舍：个人小站、低流量小工具可以继续用简单部署；需要多个节点、统一发布、服务发现和故障恢复时，Kubernetes 才更可能抵得上管理成本。

## 留一个小练习

写下你的应用只有一台机器时，最担心的三个故障。区分“程序崩溃”“整台宿主机断电”“数据库文件丢失”。容器重启能解决哪个？多节点能解决哪个？备份又负责哪个？不要把所有答案都写成“上 K8s”。

## 没跑通时先查什么

不要在 Docker Desktop 设置里随便启用、重置已有 Kubernetes 环境。后面会单独创建 kind 练习集群。云服务商的托管集群减少控制面维护工作，但业务权限、资源费用、备份和应用排错仍要自己负责。

## 参考资料

- [容器运行时](https://kubernetes.io/docs/setup/production-environment/container-runtimes/)
- [Kubernetes 概览](https://kubernetes.io/docs/concepts/overview/)
