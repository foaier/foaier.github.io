---
title: "kubectl logs 只看得到眼前：生产日志和指标还要往哪里送"
date: "2026-11-24"
summary: "区分日志、指标、链路追踪与事件，理解 Kubernetes 自带能力的边界。"
series: "Docker 与 Kubernetes"
order: 37
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-troubleshooting"]
goals: ["取课程 API 的结构化日志与资源指标，并设计进入集中平台的路径。"]
---

Pod 重建后本机还能看到哪些旧日志？用户说页面慢，我们能知道是数据库还是外部请求在等吗？临时 `kubectl logs` 适合开始排查，服务长大后就需要持续保存、可关联的数据。

## 概念讲透：它负责什么，不负责什么

日志回答某个请求发生了什么，指标显示系统随时间如何变化，链路追踪连接一次请求经过哪些服务，Events 记录集群对象状态变化。kubectl logs 只适合短时查看，不是集中、长期、可检索的生产日志平台。要让信号可关联，应带上时间、服务名、版本、环境和 trace/request ID。

## 运行过程拆解：从输入到结果

同一请求最好通过 trace ID 关联入口、API、数据库调用和日志；指标使用服务、版本、区域等有限维度看趋势；日志保留具体错误上下文；trace 查调用耗时；Events 帮助发现调度和控制器异常。四类信号互补而不互相替代。设计告警时从用户影响出发，再链接到能验证原因的面板和日志查询。

## 四类信号分别回答什么问题

日志记录离散事件；指标聚合时间序列，用于趋势和容量；分布式追踪把一次请求跨服务的耗时串起来；Events 反映集群对象变化，保存时间通常有限。它们回答的问题不同。容器通常向 stdout/stderr 写日志，节点采集器再送集中存储。

Metrics Server 提供资源指标 API 与 HPA 所需的基础数据，不是带历史曲线的完整监控。Prometheus、OpenTelemetry 或云产品要按环境部署采集端、设置脱敏、留存和访问控制。课程 API 没有完整 trace 仪表，不要声称 `/health` 就是生产监控。

## 先看课程 API 已有的日志和指标

先读每个 API 副本最近日志，再检查 `kubectl top`。若 Metrics API 未装，只记录依赖缺失，不要为了让命令变绿就在共享集群临时安装未知 Chart。

~~~powershell
kubectl -n container-course logs deployment/course-api --all-pods=true --prefix --tail=100
kubectl -n container-course get pods -l app=course-api
kubectl -n container-course top pods
kubectl -n container-course get events --sort-by=.metadata.creationTimestamp
~~~

## 怎么确认做对了

日志前缀便于区分副本；top 能显示当前 CPU、内存采样。这两条无法给出历史延迟走势或跨服务的一次请求耗时；生产需要持久存储与明确的告警路由。

## 案例推演

告警显示 API 延迟飙高。先对照请求量、错误率和延迟分位数判断是否用户受影响；再看 CPU throttling、内存、数据库连接等待；用 trace 找出慢在 API、数据库还是外部调用；最后用结构化日志核对具体异常。不要只因 CPU 平均值正常就排除资源问题。

## 留一个小练习

为一次 API 请求设计必要日志字段：trace ID、路由模板、状态码、耗时、异常类型。哪些内容不能写入日志？再标出 5xx 升高、延迟增加、容器 OOM 分别由哪类信号发现。

## 没跑通时先查什么

先确认应用写标准输出、selector 命中正确 Pod。指标无数据查 Metrics Server/采集器和授权。密码和用户数据不记录；多节点时钟同步也影响日志排序与请求关联。

## 一个超时告警，应该怎样顺着看

假设用户请求持续变慢，先看请求量、错误比例和延迟分位数，而不是一上来找某个日志关键字。请求量突然上升、CPU 同时升高，可能需要扩容；请求量没变但数据库等待时间上升，应优先看数据库连接与慢查询。两个现象可以一起发生，要把同一个时间窗口对齐。

再挑一条慢请求的 trace ID，检查它在哪个调用上停留最久，用相同 ID 去日志中找异常和关键业务事件。若当前程序没有输出关联 ID、没有接入 tracing，这条调查链会断掉；因此要在服务正常时把采集准备好，而不是事故中临时到处加日志。

| 信号 | 适合回答的问题 | 不能独自说明什么 |
| --- | --- | --- |
| 请求延迟直方图 | 最近一段时间有多少慢请求 | 某一次慢在哪一行代码 |
| 容器 CPU/内存 | 是否接近容量、是否发生 OOM | 业务返回值是否正确 |
| 带关联 ID 的日志 | 某次请求发生了什么 | 整个系统的长期统计分布 |
| 分布式 trace | 一次请求跨服务的耗时分布 | 未采样请求的完整经历 |

监控标签要用路由模板，例如 /visits/{id}，不要把每个真实用户 ID 或完整 URL 都变成指标标签，否则时间序列会不断增长。日志留存也不是越久越好，保存成本、查询成本、访问权限和业务要求要一起算。

课程 API 目前只提供普通 ASP.NET 请求日志、健康接口和节点资源观测。接入 OpenTelemetry、Prometheus 或云监控时，要另外启用应用指标导出与 trace instrumentation；平台有采集器，不代表应用自动输出了全部信号。

## 比较节点和 Pod 的资源，再筛告警

Pod 指标回答单个工作负载用了多少，节点指标回答机器还剩多少空间。最后只筛 Warning Events；需要长期趋势时再接入指标与日志系统，因为集群 Events 会过期。

~~~powershell
kubectl top nodes
kubectl -n container-course get pods -l app=course-api -o custom-columns='POD:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount,LAST_EXIT:.status.containerStatuses[0].lastState.terminated.reason'
kubectl -n container-course get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp
~~~

## 生产里怎么用、怎么排障

监控要围绕用户体验定义 SLI/SLO 和告警阈值，避免每个内部指标都叫 P1。日志保留周期、索引字段和采样率会影响费用与隐私；高基数字段不要直接作为指标标签。告警要有值班负责人、排查链接和止损步骤，发布后观察错误率、延迟和饱和度。

## 参考资料

- [Kubernetes 日志架构](https://kubernetes.io/docs/concepts/cluster-administration/logging/)
- [系统指标](https://kubernetes.io/docs/concepts/cluster-administration/system-metrics/)
- [Prometheus](https://prometheus.io/docs/introduction/overview/)
