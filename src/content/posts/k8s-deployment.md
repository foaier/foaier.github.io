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

## 留一个小练习

执行 `kubectl apply -f k8s/20-api.yaml` 恢复源码声明的两个副本，再核对数量。思考命令行 scale 改了现状，Git 里却还是 2，后续自动 apply 为什么会回到 2？GitOps 章节会进一步处理配置归属。

## 没跑通时先查什么

副本始终少一个，先 describe 新 Pod 看调度与镜像错误，再看 readiness。不要看到两个 Running 就判断服务完全可用，Running 可能仍未通过就绪检查。selector 在创建后通常不可随意修改，重构标签前先做好资源替换计划。

副本恢复只说明控制器补了 Pod。容器本地文件、内存里的登录状态、后台定时任务都可能因重建而丢失或重复执行。扩副本之前，先把状态放到合适的共享存储或数据库，并让后台任务具有可重复执行的保护。

## 参考资料

- [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [ReplicaSet](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/)
