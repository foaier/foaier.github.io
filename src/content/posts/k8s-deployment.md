---
title: "删了一个 Pod，它怎么又长回来了？Deployment 在替你盯副本"
date: "2026-11-24"
summary: "从实际删除实验理解 Deployment、ReplicaSet 与声明式管理。"
series: "Docker 与 Kubernetes"
order: 23
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-pod-yaml"]
goals: ["验证控制器补齐 API 副本，并能扩容和恢复期望副本数。"]
---

你看到一个 Pod 名字不顺眼，删掉了；一转头，又来了个新名字。不是删除命令失灵，而是 Deployment 还写着“我要两个副本”。你删掉的是现状，控制器继续按期望补齐。

## 概念讲透：它负责什么，不负责什么

Deployment 管理无状态副本的期望数量和 Pod 模板，创建 ReplicaSet 来维护对应版本的 Pod。删除一个 Pod 只是改变现状，ReplicaSet 会补回副本；更新模板会生成新 ReplicaSet 并按策略替换旧副本。副本数只对可横向运行的应用有意义，应用必须共享状态或把状态放到外部。

## 运行过程拆解：从输入到结果

Deployment 的 selector 先找到由它管理的 ReplicaSet，Pod 模板改变时创建新 ReplicaSet，并根据滚动策略逐步替换旧 Pod。只改副本数不会改变模板版本；只删一个 Pod 会让所属 ReplicaSet 创建替代者。看 ownerReferences、generation 和 rollout history 能区分当前模板、控制器观察版本和实际 Pod，避免把手工改的单个 Pod 误当作部署变更。

## 谁在维持两个 API 副本

课程 `20-api.yaml` 包含一个 Service 与一个 Deployment。Deployment 的 replicas 是期望副本数，selector 对上 Pod template 的 labels。Deployment 管 ReplicaSet，ReplicaSet 再管 Pod。不要手动去改 ReplicaSet 数量和 Deployment 争夺控制权。

应用是否适合多个副本，也要自己保证。这个 API 的记录写入 PostgreSQL，所以换一个 Pod 仍能读到同样数据；如果把用户会话或文件只放在容器本地，扩容后就可能一会儿有一会儿没。

## 删掉一个副本，观察它怎么回来

先确认当前上下文是 kind-course，使用标签选出一个课程 API Pod 再删除它，避免操作数据库。`-w` 持续观察，看到新 Pod 出现并 Running 后按 Ctrl+C，仅停止观察。随后扩到三个副本，观察期望和实际数量。

~~~powershell
kubectl config current-context
kubectl -n container-course get deployment,replicaset,pod
$coursePod = kubectl -n container-course get pod -l app=course-api -o jsonpath="{.items[0].metadata.name}"
kubectl -n container-course delete pod $coursePod
kubectl -n container-course get pods -l app=course-api -w
# 观察完成后按 Ctrl+C，再执行
kubectl -n container-course scale deployment/course-api --replicas=3
kubectl -n container-course rollout status deployment/course-api
~~~

## 怎么确认做对了

新 Pod 的名字和 UID 与被删除的不同，READY 最终达到 1/1。Deployment 的 AVAILABLE 变为 3。数据库没有因此多出三个副本，API 扩容与数据库扩容是两回事。

## 案例推演

删掉 API Pod 后它很快以新名字出现。查看 Deployment、ReplicaSet 和 Pod 的 ownerReferences，可沿着所有权找到是谁补它。把副本调到三后，再确认数据库没有跟着变成三份；水平扩 API 与复制数据库不是同一个动作，后者需要复制协议和数据一致性设计。

## 留一个小练习

执行 `kubectl apply -f k8s/20-api.yaml` 恢复源码声明的两个副本，再核对数量。思考命令行 scale 改了现状，Git 里却还是 2，后续自动 apply 为什么会回到 2？GitOps 章节会进一步处理配置归属。

## 没跑通时先查什么

副本始终少一个，先 describe 新 Pod 看调度与镜像错误，再看 readiness。不要看到两个 Running 就判断服务完全可用，Running 可能仍未通过就绪检查。selector 在创建后通常不可随意修改，重构标签前先做好资源替换计划。

副本恢复只说明控制器补了 Pod。容器本地文件、内存里的登录状态、后台定时任务都可能因重建而丢失或重复执行。扩副本之前，先把状态放到合适的共享存储或数据库，并让后台任务具有可重复执行的保护。

## 生产里怎么用、怎么排障

扩副本能分摊无状态请求，但内存会话、容器本地文件、单次后台任务可能在多副本下丢失或重复。生产部署还要为副本设置资源、探针、拓扑分布和容量预算。手工 kubectl scale 改出的状态可能与 Git 声明不同，下一次自动发布会覆盖它；明确 Git 与集群谁是配置来源。

## 参考资料

- [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [ReplicaSet](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/)
