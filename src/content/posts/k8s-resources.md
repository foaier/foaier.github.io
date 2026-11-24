---
title: CPU 500m、内存 256Mi 是什么意思？把 requests 和 limits 算明白
date: '2026-11-24'
summary: 区分调度资源承诺、CPU 限流与内存 OOM，避免凭感觉填资源。
series: Docker 与 Kubernetes
order: 27
tags:
  - Kubernetes 入门
  - Docker
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-probes
goals:
  - 读取课程资源配置，并从事件区分 Pending、CPU throttling 与 OOMKilled。
---

服务在开发机飞快，放进 Pod 后突然慢了；还有一种情况是看着 CPU 不忙，Pod 却总重启。先别急着加机器，检查资源声明。requests 和 limits 不是两个随便抄来的数字，它们影响不同环节。

## 把 requests 与 limits 的作用分开

CPU 的 1000m 等于一个 CPU 核心的计算时间份额，50m 是 0.05 核。内存 Mi 是二进制单位，与十进制 M 不同。调度器主要依据 requests 判断节点是否放得下；运行时的内存 limit 超出后可能被 OOM 杀死，CPU limit 通常表现为限流变慢。

课程 API request 为 50m 与 96Mi，内存 limit 为 256Mi，只是小实验起点，没有宣称适合生产。资源可用量还要扣掉系统与节点预留。应用容器自己报的工作集、进程指标和节点内存压力也要结合看。

## 查看实际资源声明和退出原因

先读取已部署的资源声明，再检查 Pod Events、上次退出状态。`kubectl top` 需要 metrics-server；没安装时返回 Metrics API not available 不说明应用已经坏了，自动伸缩章节会说明这层依赖。

~~~powershell
kubectl -n container-course get deployment course-api -o yaml
kubectl -n container-course get pods -l app=course-api
$coursePod = kubectl -n container-course get pod -l app=course-api -o jsonpath="{.items[0].metadata.name}"
kubectl -n container-course describe pod $coursePod
kubectl top pods -n container-course
~~~

## 把资源申请和节点余量放在一起看

Pod 资源清单说明调度器预留多少 CPU 和内存；节点详情能看到可分配容量。OOMKilled 事件出现时，再对照 requests、limits 和实际峰值，不要只为消除告警盲目加大限制。

~~~powershell
kubectl -n container-course get pods -l app=course-api -o custom-columns='POD:.metadata.name,CPU_REQUEST:.spec.containers[0].resources.requests.cpu,MEMORY_REQUEST:.spec.containers[0].resources.requests.memory'
kubectl describe nodes
kubectl -n container-course get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp
~~~

## requests 和 limits 分别参与不同决策

requests 是调度器放置 Pod 时用于估算资源需求的声明，也影响节点上的资源预留和超卖判断；它不代表容器持续占用同等 CPU。CPU limit 是运行时可用 CPU 时间上限，过低时程序会被 throttling；memory limit 是内存上限，越界时容器可能被 OOMKilled。

| 资源字段 | 主要作用 | 超出或不足时常见现象 |
|---|---|---|
| requests.cpu | 调度和资源记账 | 可用节点装不下时 Pod Pending |
| limits.cpu | 限制 CPU 时间 | 延迟上升、CPU throttling |
| requests.memory | 调度和节点资源预留判断 | 资源紧张时影响驱逐优先级 |
| limits.memory | 容器内存硬边界 | OOMKilled、重启次数增加 |

一个 Pod 里多个容器的 requests 会合并参与调度。节点还要留资源给系统守护进程、kubelet、网络和存储插件，因此 allocatable 才是工作负载可申请的主要参考，不是机器总内存。

## 把三个常见状态与资源字段对应起来

- Pending 且事件有 Insufficient cpu/memory：调度器找不到满足 requests 和约束的节点。
- Running 但响应慢：检查 CPU limit 是否造成节流，同时看应用等待和下游服务。
- OOMKilled：容器超过 memory limit 或节点内存压力导致终止；扩大 limit 前先确定是正常峰值、内存泄漏还是读入数据过大。

~~~powershell
kubectl -n container-course describe pod -l app=course-api
kubectl -n container-course top pods --containers
kubectl describe nodes
kubectl get events -A --field-selector type=Warning --sort-by=.metadata.creationTimestamp
~~~

kubectl top 需要 Metrics API；若显示 Metrics API not available，先检查 Metrics Server，不要据此判定应用没有 CPU。describe node 的 Allocated resources 显示 requests/limits 的汇总，能看出节点是否已经被声明得很满。

## QoS 等级会影响节点压力下的驱逐顺序

Kubernetes 根据 Pod 内所有容器的请求和限制计算 QoS：Guaranteed 要求每个容器的 CPU、内存 requests 与 limits 都设置且相等；BestEffort 没有请求和限制；其他一般属于 Burstable。QoS 影响节点资源压力下的处理优先级，但不等同于应用 SLA，也不会阻止 OOM。

不要机械地把 limits 全设成很高或与 requests 完全相等。先测实际峰值、基线和并发，给节点系统组件留余量，再逐步调整并观察 throttling、OOM 和 Pending。生产容量还要按故障时剩余节点数计算，而不是只看平时平均 CPU。

## 参考资料

- [资源管理](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [节点压力驱逐](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/)
