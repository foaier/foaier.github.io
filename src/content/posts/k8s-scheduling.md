---
title: Pod 为什么 Pending？从资源请求到节点选择看调度
date: '2026-11-24'
summary: 根据资源、标签、污点和拓扑约束，理解调度器为什么暂时放不下工作负载。
series: Docker 与 Kubernetes
order: 34
tags:
  - Kubernetes 进阶
  - Docker
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-security
goals:
  - 检查 kind 节点标签，并为临时 Job 加一个可满足的 nodeSelector。
---

Pending 看起来像启动失败，其实 Pod 可能正等待调度。调度器要找满足资源和约束的节点；有时正在做决定，有时则是你写的条件压根无处满足。

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

## 调度约束从“硬条件”到“偏好”有不同后果

| 机制 | 约束方向 | 常用场景 |
|---|---|---|
| nodeSelector | 硬性节点标签条件 | 只运行 Linux、指定硬件类别 |
| required nodeAffinity | 必须满足 | 必须落在某一地区或节点池 |
| preferred nodeAffinity | 倾向满足 | 优先使用某一节点池，缺少时仍可运行 |
| podAffinity / antiAffinity | 和其他 Pod 的同处/分散关系 | 靠近缓存，或分散故障域 |
| taint / toleration | 节点拒绝，Pod 显式容忍 | 隔离系统节点和专用硬件 |
| topologySpreadConstraints | 在故障域间控制副本分布 | 避免副本全在同一节点或可用区 |

toleration 只是通行证，不是导航指令；它不会把 Pod 指定到带该污点的节点。nodeSelector 和 required affinity 没有匹配节点时 Pod 就无法调度；preferred affinity 则可能在没有理想节点时退而求其次。

亲和性规则与 requests、卷拓扑一起工作。一个节点即使有空闲 CPU，也可能因 PVC 绑定到另一可用区、污点未容忍或 podAntiAffinity 冲突而被淘汰。

## 读一段 required 和 preferred 亲和性

以下片段要求 Pod 运行在带 workload=api 标签的节点，同时尽量靠近 pool=fast 的节点。required 条件没有候选节点时会保持 Pending；preferred 条件不满足时仍可调度。

~~~~yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: workload
              operator: In
              values: [api]
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 50
        preference:
          matchExpressions:
            - key: pool
              operator: In
              values: [fast]
~~~~

IgnoredDuringExecution 表示节点标签后来变化时，调度器不会自动驱逐已经运行的 Pod。亲和性字段属于 Pod template，改 Deployment 后会触发新一轮滚动更新。

## 单节点 kind 看不到真正的高可用分散

课程 kind 默认只有一个节点，不能证明反亲和性或 topologySpread 能跨节点分散副本。已有 os-check Job 只能练标签选择；要练多故障域，先创建多节点 kind 集群并给节点设置不同的拓扑标签，再观察 Pod 分布。不要用强硬的 zone 约束去测试单节点集群，否则所有副本都可能 Pending。

## 参考资料

- [节点分配](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/)
- [Pod 拓扑分布](https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/)
- [污点与容忍](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)
