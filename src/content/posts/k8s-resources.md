---
title: requests 和 limits：为什么 Pod Pending，为什么会 OOM
date: '2026-11-24'
summary: 通过 CPU 请求过大和内存超限两次实验，分清调度、限流、OOM、QoS、默认限制和命名空间配额。
series: Docker 与 Kubernetes
order: 34
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-probes
goals:
  - 通过 CPU 请求过大和内存超限两次实验，分清调度、限流、OOM、QoS、默认限制和命名空间配额。
---
“服务器还有空闲，为什么 Pod 仍然 Pending？”经常是因为 scheduler 按 requests 做资源预算，而不是看这一秒 CPU 有多闲。requests 是资源请求，limits 是运行时上限，两者不能混成“分配的资源”。

## CPU 和内存的单位

`100m` CPU 是 0.1 核，`1000m` 是 1 核；它不是独占绑定某个核心。`128Mi` 内存是 128 × 1024 × 1024 字节，和十进制的 M 不同。CPU 超过限制通常被限流，响应变慢；内存超限可能被 OOM 杀掉。requests 太低会过度装箱，太高又会让 Pod 排不进去。

## 先制造一个无法满足的 CPU 请求

~~~yaml file=resources/pending.yaml
apiVersion: v1
kind: Pod
metadata:
  name: cpu-pending
  namespace: lab
spec:
  containers:
    - name: pause
      image: busybox:1.37
      command: ["sleep", "3600"]
      resources:
        requests: {cpu: "1000", memory: 16Mi}
~~~

~~~bash
kubectl apply -f resources/pending.yaml
kubectl -n lab get pod cpu-pending
kubectl -n lab describe pod cpu-pending
kubectl describe node course-worker
~~~

这里故意请求一千核，不是一千毫核。普通电脑无法满足，Events 会出现 Insufficient cpu；节点 describe 中的 Allocatable 和 Allocated resources 能帮助理解预算。删除文件里的一个零并不是严谨修复，要根据程序实际需求设置合理 requests。此实验直接删除坏 Pod，避免长期占着排错列表。

~~~bash
kubectl -n lab delete pod cpu-pending
~~~

## 再制造内存超限，识别退出原因

~~~yaml file=resources/oom.yaml
apiVersion: v1
kind: Pod
metadata:
  name: memory-demo
  namespace: lab
spec:
  restartPolicy: Never
  containers:
    - name: allocator
      image: python:3.13-alpine
      command: ["python", "-c", "import time; x=bytearray(256*1024*1024); time.sleep(60)"]
      resources:
        requests: {cpu: 50m, memory: 16Mi}
        limits: {cpu: 200m, memory: 64Mi}
~~~

~~~bash
kubectl apply -f resources/oom.yaml
kubectl -n lab get pod memory-demo -w
~~~

容器尝试申请 256 MiB，而上限 64 MiB，通常会显示 OOMKilled。按 Ctrl+C，再读取状态：

~~~bash
kubectl -n lab get pod memory-demo -o jsonpath='{.status.containerStatuses[0].state.terminated.reason}{"\n"}'
kubectl -n lab describe pod memory-demo
kubectl -n lab delete pod memory-demo
~~~

退出码 137 只表示进程被 SIGKILL，不能单凭它认定内存泄漏；这里要结合 OOMKilled、限制和实验行为。真实程序要看工作集、缓存、堆外内存和流量变化，不能无限加 limit。

## QoS 是分类，不是永不被驱逐的等级

所有容器都没有 CPU/内存 requests 和 limits，通常是 BestEffort；所有容器 CPU、内存请求与上限都齐全且分别相等，符合 Guaranteed 条件；其余通常是 Burstable。节点压力驱逐还会考虑优先级、是否超过请求等因素，不能只按 QoS 三个词猜测驱逐顺序。

## LimitRange 和 ResourceQuota 各管哪一层

LimitRange 可以给容器补默认值、限制单个请求范围；ResourceQuota 约束整个 namespace 的总量。放到单独的实验 namespace，避免配额影响后续 web：

~~~yaml file=resources/quota.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: quota-lab
---
apiVersion: v1
kind: LimitRange
metadata:
  name: defaults
  namespace: quota-lab
spec:
  limits:
    - type: Container
      defaultRequest: {cpu: 50m, memory: 32Mi}
      default: {cpu: 200m, memory: 128Mi}
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: budget
  namespace: quota-lab
spec:
  hard:
    pods: "2"
    requests.cpu: "500m"
    requests.memory: 256Mi
    limits.memory: 512Mi
~~~

~~~bash
kubectl apply -f resources/quota.yaml
kubectl -n quota-lab create deployment demo --image=nginx:1.28-alpine --replicas=3
kubectl -n quota-lab get pods
kubectl -n quota-lab describe rs
kubectl -n quota-lab describe quota budget
~~~

最多两个 Pod 被允许创建，ReplicaSet 事件会出现 exceeded quota；不是第三个 Pod 一直 Pending，因为创建请求已经被拒绝。看不到第三个 Pod 时，去 describe ReplicaSet 才能找到原因。完成后 `kubectl delete namespace quota-lab`，这只清理本课专用 namespace。

## 继续阅读

- [管理容器资源](https://kubernetes.io/zh-cn/docs/concepts/configuration/manage-resources-containers/)
- [资源配额](https://kubernetes.io/zh-cn/docs/concepts/policy/resource-quotas/)
