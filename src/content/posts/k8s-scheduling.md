---
title: "Pod 为什么 Pending？从资源请求到节点选择看调度"
date: "2026-11-24"
summary: "根据资源、标签、污点和拓扑约束，理解调度器为什么暂时放不下工作负载。"
series: "Docker 与 Kubernetes"
order: 34
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-security"]
goals: ["检查 kind 节点标签，并为临时 Job 加一个可满足的 nodeSelector。"]
---

Pending 看起来像启动失败，其实 Pod 可能正等待调度。调度器要找满足资源和约束的节点；有时正在做决定，有时则是你写的条件压根无处满足。

## 概念讲透：它负责什么，不负责什么

调度器先过滤不满足条件的节点，再给候选节点打分。requests、节点标签、nodeSelector/亲和性、taint/toleration、卷拓扑和拓扑分布约束都会影响结果。Pod Pending 可能是请求的资源放不下，也可能是条件写得太严。容忍 taint 只表示允许落到该节点，不会主动把 Pod 送过去。

## 运行过程拆解：从输入到结果

调度器先过滤不可行节点：requests 放不下、缺少标签、污点未容忍、卷不能跨区等都会淘汰；剩下节点才按策略评分。亲和性和拓扑分散表达软硬偏好，nodeSelector 通常是硬约束。Pod Pending 时 Events 会给出失败过滤原因，调小 request 之前要确认真实内存/CPU需求，否则只是把调度问题换成运行期 OOM 或节流。

## 节点资源和约束怎样影响调度

requests 决定调度时预留的资源空间；nodeSelector 与 required affinity 是硬条件，preferred affinity 是偏好。污点让节点默认不接特定 Pod，toleration 只表示可接受，不保证一定调度。Pod 反亲和与 topologySpreadConstraints 可以摊开副本，但只有一节点的 kind 无法验证跨节点高可用。

## 用节点标签安排一个任务

下载包的 `k8s/os-check.yaml` 已包含带 `nodeSelector` 的一次性 Job，本篇后面也列出了完整 YAML。先查看标签再应用它。kind 默认只有一个可调度的 control-plane 节点，Pod 会匹配它的 Linux 标签；完成后删除 Job。

~~~powershell
kubectl get nodes -o wide
kubectl get nodes --show-labels
kubectl apply -f k8s/os-check.yaml
kubectl -n container-course wait --for=condition=complete job/os-check --timeout=120s
kubectl -n container-course logs job/os-check
kubectl -n container-course get pods -l job-name=os-check -o wide
kubectl -n container-course delete job os-check
~~~

## 怎么确认做对了

Job Pod 带 selector 后落在带 Linux 标签的节点并打印 Linux。若没有匹配标签，Pod 会卡在 Pending，而不是进入容器执行失败。

## 案例推演

新副本一直 Pending，describe 事件提示没有节点满足约束。先看事件给出的资源不足、taint 或卷区域原因，再比较 Pod requests 和节点 allocatable，检查亲和性与标签是否拼错。不要立刻删掉约束；若节点容量不足，先扩节点或调整经压测验证的 request。

## 留一个小练习

在两个以上节点的本地集群试拓扑分布约束，分别比较硬性约束和偏好。硬约束设置过强会卡住所有副本；资源、可用区和副本数要一起设计。

## 没跑通时先查什么

先 describe Pod 看 FailedScheduling Events，再核对节点 allocatable、已请求总量、selector、污点和调度器。Pending 的容器尚未启动，通常没有可读日志。

节点的 allocatable 不是机器整块硬件规格，系统进程和 kubelet 本身也要预留资源。调度器依据声明的 requests 放置 Pod，不会预先知道某个应用会突然多吃多少内存。因此 requests 的估算要结合观测，limit 则要结合压测。

如果节点能接收 Pod 但磁盘或临时存储快满，也会遇到驱逐和启动问题。requests、limits 与节点污点要放在一次容量讨论里看，不能只研究 CPU。

## 选择器写在哪一层

下载包的 k8s/os-check.yaml 包含完整 Job。核心部分如下，nodeSelector 放在 Pod 的 spec 中，和 containers 同级，而不是放到 Job 自己的 spec 上：

~~~yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: os-check
  namespace: container-course
spec:
  template:
    spec:
      nodeSelector:
        kubernetes.io/os: linux
      restartPolicy: Never
      containers:
        - name: check
          image: busybox:1.37
          command: ["/bin/sh", "-c", "uname -s"]
~~~

要制造一个可解释的 Pending，可以把 linux 临时改为 imaginary-os，删除已经完成的 os-check Job，再用修改后的清单创建它。describe Pod 的事件应指出没有匹配节点。Job 的 Pod 模板通常不可原地修改，因此这次创建一个新的实验实例；不要把这种删建步骤用于有业务副作用的生产 Job。

观察结束后只删除这个 Job，再把文件里的标签值还原为 linux。即使调度条件有问题，查看日志也不会帮忙，因为容器尚未运行，这时 Events 才是第一条线索。

## Pending 时用事件和节点余量找调度原因

前面已把 nodeSelector 临时改成不存在的标签，并用新 Job 创建了一个 Pending Pod。先从 Job 标签自动取出 Pod 名，再看 Events。事件会指出资源不足、taint 不容忍或 nodeSelector 不匹配；节点详情展示 allocatable 和已分配 requests。先按具体原因修复，不要盲目删掉所有调度约束。

~~~powershell
$pendingPod = kubectl -n container-course get pods -l job-name=os-check -o jsonpath='{.items[0].metadata.name}'
kubectl -n container-course describe pod $pendingPod
kubectl describe nodes
~~~


## 生产里怎么用、怎么排障

把关键副本全调度到同一故障域会造成一次节点维护全站不可用。用 topology spread 或反亲和性分散副本，同时确认集群有足够容量容纳约束。污点常用于隔离系统节点或特殊硬件，随意给业务容忍会挤占关键资源；资源利用率和故障域要一起看。

## 参考资料

- [节点分配](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/)
- [Pod 拓扑分布](https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/)
- [污点与容忍](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)
