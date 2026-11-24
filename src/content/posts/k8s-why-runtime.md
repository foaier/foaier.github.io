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

## 概念讲透：它负责什么，不负责什么

Kubernetes 是声明式容器编排系统：你声明副本数、资源和配置，控制器持续让实际状态靠近期望状态。它解决多节点上的调度、服务发现、滚动发布和自愈，不替应用设计数据库、高可用、备份或业务回滚。单个小服务若只跑在一台机器上，Compose 可能更简单；集群能力有学习、维护和成本。

## 运行过程拆解：从输入到结果

当服务从一台机器扩到多台，问题变成副本放哪、宕机谁补、地址如何稳定、版本怎么逐步替换。Kubernetes 用 API 对象表达这些要求，由控制器不断协调。它有意不替你决定业务正确性和数据模型。若主要痛点只有自动启动一个进程，上完整集群要先算控制面维护、学习成本、托管费用和团队值班能力。

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

## 案例推演

团队有十几个服务，发布时靠 SSH 登录多台机器，常出现漏更新和端口冲突。Kubernetes 可以统一声明部署和服务入口，但接入前还得准备镜像仓库、网络插件、存储、权限、监控和值班流程。先列出当前痛点和平台所需能力，再做一个服务的试点，量化发布失败率和运维负担，别为了“先进”迁移。

## 留一个小练习

写下你的应用只有一台机器时，最担心的三个故障。区分“程序崩溃”“整台宿主机断电”“数据库文件丢失”。容器重启能解决哪个？多节点能解决哪个？备份又负责哪个？不要把所有答案都写成“上 K8s”。

## 没跑通时先查什么

不要在 Docker Desktop 设置里随便启用、重置已有 Kubernetes 环境。后面会单独创建 kind 练习集群。云服务商的托管集群减少控制面维护工作，但业务权限、资源费用、备份和应用排错仍要自己负责。

## 比较单机 Compose 和集群命令各自管什么

第一条查看单机服务状态；第二条列出 kubectl 能连接的集群；第三条查看当前集群节点，只有已有 Kubernetes 集群时才成功。Compose 管一台机器上的服务组合，Kubernetes 管集群对象和调度。没有集群时第三条失败不代表 Docker 坏了，先完成 kind 安装。

~~~powershell
docker compose ps
kubectl config get-contexts
kubectl get nodes
~~~



## 什么时候 Compose 更合适，什么时候再看 Kubernetes

| 当前需求 | 通常更简单的选择 | 为什么 |
|---|---|---|
| 一台开发机启动 API 和数据库 | Docker Compose | 文件少、启动快、调试路径短 |
| 单台小服务器托管低风险服务 | Compose 或托管应用平台 | 没有集群团队时少维护一个控制面 |
| 多节点调度、统一发布和副本自愈 | Kubernetes | 控制器能跨节点协调声明状态 |
| 只想自动构建镜像 | CI 工作流 | 构建和发布不需要先部署集群 |
| 需要数据库高可用 | 托管数据库或成熟数据库方案 | Kubernetes 本身不实现数据库复制与恢复 |

评估 K8s 时要把平台成本算进去：控制面和节点升级、CNI/CSI、镜像仓库、RBAC、安全策略、监控、备份、值班和云资源费用。托管集群能减少控制面运维，不会替你自动解决应用权限、容量和数据恢复。

## 把常见需求映射到 Kubernetes 对象

| 需求 | 常见对象或能力 | 它仍然没有替你解决什么 |
|---|---|---|
| 保持 API 副本数 | Deployment | 应用是否无状态、数据库是否扛得住 |
| 稳定服务地址 | Service / EndpointSlice | 用户登录、业务级负载策略 |
| 集群内配置 | ConfigMap / Secret | Secret 的安全存储和轮换责任 |
| 保留数据库文件 | PVC / PV / CSI | 备份、跨区恢复和数据库复制 |
| 自动增加副本 | HPA + Metrics API | 节点容量、镜像拉取和下游瓶颈 |
| 用户访问入口 | Gateway API controller 等 | 域名、证书、防火墙和应用认证 |

“有这个对象”与“能力已经可用”之间还隔着 controller、驱动、权限、策略和容量。创建 HPA 但没有 Metrics API，不会产生指标；声明 LoadBalancer 但没有云实现，不会凭空得到公网地址。

## 用一个问题判断是否值得上集群

列出目前最贵的三个运维痛点，再标出 K8s 能直接解决的那一个、仍要另做的那一个，以及预计新增的值班工作。只有平台带来的收益大于学习和维护成本时，才值得把应用迁过去。先用单个无状态 API 做试点，保留数据迁移和回滚方案，再扩展范围。

## 生产里怎么用、怎么排障

上集群后会多出控制面升级、节点容量、权限误配、网络策略和费用等运维面。集群自身故障可能影响很多业务，团队必须有平台负责人、版本支持策略、备份恢复演练和成本看板。把 Kubernetes 当作一套运行平台来运营，不是装好 kubectl 后应用就自然高可用。

## 参考资料

- [容器运行时](https://kubernetes.io/docs/setup/production-environment/container-runtimes/)
- [Kubernetes 概览](https://kubernetes.io/docs/concepts/overview/)
