---
title: "CPU 500m、内存 256Mi 是什么意思？把 requests 和 limits 算明白"
date: "2026-11-24"
summary: "区分调度资源承诺、CPU 限流与内存 OOM，避免凭感觉填资源。"
series: "Docker 与 Kubernetes"
order: 27
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-probes"]
goals: ["读取课程资源配置，并从事件区分 Pending、CPU throttling 与 OOMKilled。"]
---

服务在开发机飞快，放进 Pod 后突然慢了；还有一种情况是看着 CPU 不忙，Pod 却总重启。先别急着加机器，检查资源声明。requests 和 limits 不是两个随便抄来的数字，它们影响不同环节。

## 概念讲透：它负责什么，不负责什么

requests 是调度器预留和容量计算的参考，limit 是运行时限制。CPU 超限通常被节流，表现为延迟升高；内存超过限制可能被 OOMKilled。没有合理 request，调度器可能把过多 Pod 放到同一节点，HPA 的 CPU 使用率目标也会失去可靠基准。容量要按实际负载和峰值测量，而不是凭感觉填数字。

## 运行过程拆解：从输入到结果

调度器比较节点剩余可分配资源与 Pod 的 requests，而不是实时 CPU 使用率；容器启动后 CPU limit 可限制调度时间，内存 limit 超出后可能被内核终止。节点容量还要给系统组件留空间。排查慢请求要区分 CPU throttling、节点资源紧张、内存增长和下游等待，因为只把 limit 调大可能把拥塞移到整台节点。

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

## 怎么确认做对了

能找到 requests/limits 和 Conditions。若 top 无数据，先记录缺少 metrics-server。Pending 且 Events 出现 Insufficient memory，与容器启动后 Last State 为 OOMKilled 不同：前者还没放下，后者跑起来后被杀。

## 案例推演

接口在高峰变慢，但 Pod 没重启。看 CPU throttling 指标、容器 request/limit 与节点压力；若是 CPU 节流，调高 limit 不一定解决节点整体饱和。另一种现象是 OOMKilled，要对照内存曲线、工作集和 limit。通过逐步压测找到延迟拐点，再设请求值、上限和告警。

## 留一个小练习

只在练习集群把 API memory request 临时改成高于单节点可分配内存的值，观察新 Pod Pending，再 `kubectl apply -f k8s/20-api.yaml` 恢复。不要刻意让数据库触发 OOM，练习也应保护数据。

## 没跑通时先查什么

应用慢先结合 CPU 限流、依赖延迟和线程池，不要只靠 top 瞬时数字。Pod 被 Evicted 不必然是容器超过自己的 limit，也可能是节点压力。真实配置应根据负载测试、观测到的峰值和扩容余量调整。

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

## 生产里怎么用、怎么排障

request 过大容易造成 Pending 和资源浪费，过小会让调度过密；内存 limit 过低会反复 OOM，完全不设上限也可能挤压节点上的其他服务。给关键工作负载留节点余量，并用历史分位数和增长趋势调整。配额与 LimitRange 控制 namespace 总量，不能代替单个服务的容量测试。

## 参考资料

- [资源管理](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [节点压力驱逐](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/)
