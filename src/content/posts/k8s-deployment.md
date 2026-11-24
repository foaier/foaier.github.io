---
title: Deployment：删掉一个 Pod，为什么又长出来一个
date: '2026-11-24'
summary: 用副本实验认识 Deployment、ReplicaSet 和标签选择器，再练习扩容、缩容与声明式配置。
series: Docker 与 Kubernetes
order: 28
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-pod-yaml
goals:
  - 用副本实验认识 Deployment、ReplicaSet 和标签选择器，再练习扩容、缩容与声明式配置。
---
独立 Pod 被删就没了。网页需要持续提供服务，我们需要一个对象记住“始终有两个副本”。这个对象就是 Deployment。它通过 ReplicaSet 管理 Pod 数量，还能在之后的发布过程中管理新旧版本。

## 先看三个对象的分工

Deployment 管发布和 Pod 模板；ReplicaSet 按选择器维持副本数；Pod 承载实际容器。日常修改 Deployment，通常不用手工创建或修改它下面的 ReplicaSet。控制器发现副本不足时补建，并不是复活原来那个 Pod，IP、名字尾巴和 UID 都可能改变。

## 用文件部署两个网页

实验包 `basics/deployment.yaml` 如下。三个 `app: web` 要分清：Deployment 自身可以有标签，但真正关联副本的是 `spec.selector` 和 `spec.template.metadata.labels`。

~~~yaml file=basics/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: lab
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.28-alpine
          ports:
            - name: http
              containerPort: 80
~~~

~~~bash
kubectl apply -f basics/deployment.yaml
kubectl -n lab rollout status deployment/web --timeout=120s
kubectl -n lab get deployment,replicaset,pod -l app=web
kubectl -n lab get deployment web
~~~

第一条 get 用标签过滤，Deployment 自身没有 app 标签，所以可能只显示 ReplicaSet 和 Pod；下一条按名字查 Deployment。看到 `READY 2/2`、两个 Pod `1/1 Running` 表示成功。`replicas: 2` 是两个 Pod，不是一个 Pod 里塞两个 Nginx。

## 删一个，观察新 Pod 出现

打开两个终端。终端 A 观察变化：

~~~bash
kubectl -n lab get pods -l app=web -w
~~~

终端 B 删除刚查到的第一个 Pod：

~~~bash
lab_pod=$(kubectl -n lab get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl -n lab delete pod "$lab_pod"
kubectl -n lab rollout status deployment/web --timeout=120s
~~~

`-w` 持续监听，按 Ctrl+C 退出。你会看到旧名字 Terminating，新名字从 Pending 变成 Running。变量 `lab_pod` 是命令查询到的实际名字，不要把文章里的示例后缀硬抄进去。副本缺少到补齐之间有间隔，镜像拉取失败、资源不足也会阻止恢复，“自愈”不是永不中断。

## 扩成三个，再回到两个

~~~bash
kubectl -n lab scale deployment web --replicas=3
kubectl -n lab rollout status deployment/web --timeout=120s
kubectl -n lab get pods -l app=web
kubectl apply -f basics/deployment.yaml
kubectl -n lab rollout status deployment/web --timeout=120s
~~~

scale 修改了集群里的期望副本数，文件中仍是 2；重新 apply 文件会把它改回 2。这个实验说明，命令行临时操作和 Git 中配置可能不一致。正式维护时要决定谁拥有副本数字段；后面的 HPA 也会修改它，不应让多个控制工具同时抢着改。

## 选择器为什么不能乱改

Deployment 通过选择器辨认它负责的 Pod。`selector.matchLabels` 必须匹配模板标签，且现有 Deployment 的 selector 通常不可更改。不要创建两个选择器互相重叠的控制器，也不要为了改名字随手删生产 Deployment。改模板里的镜像等可更新字段会创建新的 ReplicaSet，原来的历史用于回滚。

~~~bash
kubectl -n lab get rs
kubectl -n lab get pod -l app=web -o jsonpath='{range .items[*]}{.metadata.name}{" -> "}{.metadata.ownerReferences[0].kind}{"/"}{.metadata.ownerReferences[0].name}{"\n"}{end}'
~~~

输出能看到 Pod 的 owner 是 ReplicaSet。再 describe 对应 ReplicaSet，可以看到它归属于 Deployment。

## 副本没起来时看哪里

`rollout status` 超时只说明没有完成，不说明具体原因。先 `kubectl -n lab get pods`，再 describe 有问题的 Pod；如果一个 Pod 都没创建，查看 `kubectl -n lab describe rs`，可能是资源配额、准入规则拒绝了 Pod。不要一直删 Deployment 重试，那会丢掉最有用的现场。

本课保留 `web`。后面的 Service、更新和配置实验继续用它；如果之前删过，重新 apply 文件即可恢复到两个基础网页。

## 继续阅读

- [Deployment](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/deployment/)
- [ReplicaSet](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/replicaset/)
