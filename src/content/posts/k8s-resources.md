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

## 留一个小练习

只在练习集群把 API memory request 临时改成高于单节点可分配内存的值，观察新 Pod Pending，再 `kubectl apply -f k8s/20-api.yaml` 恢复。不要刻意让数据库触发 OOM，练习也应保护数据。

## 没跑通时先查什么

应用慢先结合 CPU 限流、依赖延迟和线程池，不要只靠 top 瞬时数字。Pod 被 Evicted 不必然是容器超过自己的 limit，也可能是节点压力。真实配置应根据负载测试、观测到的峰值和扩容余量调整。

## 参考资料

- [资源管理](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [节点压力驱逐](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/)
