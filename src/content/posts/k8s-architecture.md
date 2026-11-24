---
title: 一条 kubectl apply 经过了谁：看懂控制平面和工作节点
date: '2026-11-24'
summary: 对照真实组件拆解创建 Pod 的全过程，理解 API Server、etcd、调度器、控制器、kubelet 和网络插件。
series: Docker 与 Kubernetes
order: 29
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-deployment
goals:
  - 对照真实组件拆解创建 Pod 的全过程，理解 API Server、etcd、调度器、控制器、kubelet 和网络插件。
---
你已经运行过 Pod，也看到了副本自动补齐。现在再看组件名称，就能把每个名字对应到实际动作。先别背架构图，跟着一条创建请求走一次。

## 电脑里的三个节点装了什么

~~~bash
kubectl get nodes -o wide
kubectl -n kube-system get pods -o wide
kubectl -n kube-system get daemonsets
~~~

在 kind-course 里，通常能看到 API Server、etcd、controller-manager、scheduler、CoreDNS，以及各节点上的 kube-proxy 和 kindnet。控制平面组件多以静态 Pod 运行；kubelet 和 containerd 是节点里的进程，不能指望 `get pods` 把它们也列出来。

## 从文件到容器，按这个顺序理解

1. kubectl 读取 YAML，连接 API Server。请求先经过身份认证、权限检查和适用的准入处理。
2. API Server 接受对象，并把集群状态存进 etcd。只有提交成功还不代表程序已启动。
3. Deployment 控制器根据模板建立 ReplicaSet；ReplicaSet 控制器创建需要的 Pod 对象。
4. scheduler 发现未分配节点的 Pod，筛选资源和条件合适的节点，再通过 API 写入绑定结果。
5. 被选节点上的 kubelet 看到分配给自己的 Pod，通过容器运行时准备镜像、网络和容器。
6. kubelet 持续报告状态、执行探针。控制器继续观察并调整，让实际状态接近期望。

组件主要通过 API Server 读写共享状态。调度器不是直接往 etcd 写一条记录再 SSH 到服务器启动程序；etcd 也不保存你的数据库业务文件或镜像仓库内容。

## 用命令观察调度结果

~~~bash
kubectl -n lab get pods -l app=web -o wide
kubectl -n lab get events --sort-by=.metadata.creationTimestamp
lab_pod=$(kubectl -n lab get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl -n lab describe pod "$lab_pod"
~~~

在 Events 里找 `Scheduled`、`Pulling`、`Created`、`Started`。Scheduled 表示选好了节点；Pulling 表示拉镜像；Started 只代表容器已启动，是否能接业务还要看 Ready 和探针。事件会过期，不是永久审计记录。

## 各组件出问题，会卡在哪一段

| 组件 | 主要职责 | 常见表现 |
| --- | --- | --- |
| API Server | 提供集群 API | kubectl 连接失败或请求失败 |
| etcd | 存集群对象状态 | 写请求失败、控制平面无法正常协作 |
| scheduler | 给新 Pod 选节点 | 新 Pod 长期 Pending，未分配节点 |
| controller-manager | 运行各种协调控制器 | 期望数量变了却迟迟没有对应对象 |
| kubelet / containerd | 在节点运行容器 | 节点异常、容器创建失败、状态不上报 |
| CNI 插件 | 建立 Pod 网络 | Pod 网络初始化失败或跨节点不通 |
| CoreDNS | 解析集群服务名 | IP 能访问，但服务名解析失败 |
| kube-proxy 或替代实现 | 实现 Service 数据转发 | Pod IP 正常、Service 路径异常 |

这张表是定位起点，不是“看到 Pending 就重启 scheduler”。CPU 不够、污点不匹配、PVC 没绑定也会 Pending，必须结合事件判断。

## 控制平面故障和业务故障不是一回事

短时间失去 API Server，已经运行的容器不一定立刻停止，但无法正常发布、调度和协调故障恢复。只检查网页能打开，并不能证明控制平面健康。反过来 API 正常，也不保证你的应用没写错配置。

~~~bash
kubectl get --raw='/readyz?verbose'
docker exec course-worker crictl ps
docker exec course-worker systemctl is-active kubelet
~~~

第一条检查 API Server 就绪检查项；后两条只适用于本课 kind 节点容器，用来观察运行时和 kubelet。`crictl` 面向 CRI，不要把宿主机 `docker ps` 和节点里的容器列表混为一谈。

## 多个控制平面不等于多份互不相关的数据

生产高可用通常需要多个 API Server 和具有法定多数的 etcd 集群。三个 etcd 成员需要两个可用，五个需要三个；加到两个成员并不能容忍一个成员故障。我们的单控制平面用于学习，不承担高可用承诺。后面的备份练习会证明：集群状态备份和业务数据库备份必须分别做。

## 继续阅读

- [Kubernetes 组件](https://kubernetes.io/zh-cn/docs/concepts/overview/components/)
- [控制器工作方式](https://kubernetes.io/zh-cn/docs/concepts/architecture/controller/)
