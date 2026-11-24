---
title: "一份 YAML 交上去后，Kubernetes 到底是怎么把程序跑起来的？"
date: "2026-11-24"
summary: "顺着一次部署请求认识 API Server、etcd、调度器、控制器和 kubelet。"
series: "Docker 与 Kubernetes"
order: 20
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-why-runtime"]
goals: ["描述从 kubectl apply 到容器启动的主要路径，知道不同故障应找谁。"]
---

Kubernetes 的组件图看着像一间复杂机房。换个入口会好懂一些：你提交了一份“请运行两个 API”的 YAML，这个请求从哪里进，又是谁把程序真正启动起来？跟着它走一圈，比先背组件全名更容易记住。

## 沿着一次部署请求找各个组件

kubectl 把请求发给 API Server；认证、授权、校验通过后，状态存进 etcd。Deployment 控制器看到期望副本数，管理 ReplicaSet，再由它管理 Pod。调度器给未分配节点的 Pod 挑位置。目标节点上的 kubelet 通过运行时拉镜像、建容器，网络插件配置网络，状态再汇报回来。

控制面负责“决定和记录”，工作节点负责“实际运行”。组件通常通过 API Server 观察和更新对象，不是 kubectl 直接登录每台节点启动进程。控制循环反复缩小期望与现状的差距；因此 apply 返回成功时，可能还在下载镜像，甚至还没找到足够内存的节点。

## 先认清 kubectl 要连哪个集群

这一课先准备客户端，集群在下一课创建。查看本机上下文名称和客户端版本，不执行 apply。没有 kubeconfig 时 current-context 报未设置很正常；如果显示公司或云端集群，先记住名字，后面练习必须明确使用 kind-course。

~~~powershell
kubectl version --client
kubectl config get-contexts
kubectl config current-context
~~~

## 怎么确认做对了

Client Version 是本机 kubectl 的版本。context 只是连接地址、凭证、默认 namespace 的组合，不代表机器上实际有一个正在运行的集群。等下一课创建集群后，再用 `get nodes` 和 `get pods -n kube-system` 对上组件名字。

## 留一个小练习

画一条“apply → API Server → 状态变化 → 调度 → kubelet → 容器”的路径。分别标出镜像不存在、节点内存不足、请求被 RBAC 拒绝会卡在哪里。它们最后都表现成“程序没起来”，检查入口却完全不同。

## 没跑通时先查什么

别直接连 etcd 改对象，也别把它理解成存业务表的 PostgreSQL。etcd 保存集群状态；业务数据库和持久卷是别的备份对象。控制面暂时不可用时，已有容器可能仍能运行，但新的调度、扩容和对象变更会受影响。

## 参考资料

- [集群组件](https://kubernetes.io/docs/concepts/overview/components/)
- [控制器](https://kubernetes.io/docs/concepts/architecture/controller/)
