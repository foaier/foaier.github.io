---
title: kubectl logs 只看得到眼前：生产日志和指标还要往哪里送
date: '2026-11-24'
summary: 区分日志、指标、链路追踪与事件，理解 Kubernetes 自带能力的边界。
series: Docker 与 Kubernetes
order: 37
tags:
  - Kubernetes 进阶
  - Docker
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-troubleshooting
goals:
  - 取课程 API 的结构化日志与资源指标，并设计进入集中平台的路径。
---

Pod 重建后本机还能看到哪些旧日志？用户说页面慢，我们能知道是数据库还是外部请求在等吗？临时 `kubectl logs` 适合开始排查，服务长大后就需要持续保存、可关联的数据。

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

## 集群监控通常由几种组件拼起来

| 组件/数据源 | 提供什么 | 不能单独替代什么 |
|---|---|---|
| kubelet / cAdvisor | 节点和容器资源样本 | 应用业务成功率与完整调用链 |
| Metrics Server | 近期资源指标 API，供 kubectl top、部分 HPA 使用 | 历史时序库和长期容量分析 |
| kube-state-metrics | Kubernetes 对象状态的 Prometheus 指标 | 容器 CPU/内存采集 |
| Prometheus | 抓取并保存时序指标、按规则告警 | 日志全文检索和分布式追踪 |
| Grafana | 查询与展示数据源中的面板 | 数据采集与告警路由本身 |
| OpenTelemetry Collector | 接收、处理和转发 traces/metrics/logs | 自动替应用生成正确埋点 |

这张表回答“指标从哪来”，不是一份可直接安装的生产架构。生产部署还需为控制器和采集器安排资源、持久存储、升级策略、访问控制和多副本；监控系统自身也要监控。

## 从节点采集到告警大致怎么走

~~~text
API/节点/容器 -> exporter 或 OpenTelemetry SDK
             -> collector / Prometheus scrape
             -> 时序库和日志存储
             -> Grafana 查询 / Alertmanager 路由
             -> 值班人按 runbook 处理
~~~

Metrics Server 的数据保留时间短，适合近期资源查询；Prometheus 通过 scrape 与规则做历史趋势；应用要加 SDK 或 exporter 才能提供请求延迟、错误率和 trace。只安装 Grafana 而没有数据源，仪表盘不会凭空产生指标。

## 先看资源，再定义一次可行动的告警

在资源 API 可用的课程集群中看 Pod 和 Node 指标，再对照 Warning Events。若后续接 Prometheus，常见的 PromQL 形态是按时间窗口计算请求错误比例或容器 CPU 使用率；指标名取决于安装的 exporter 和应用埋点，先在 Prometheus 中查实际序列再写规则。

~~~powershell
kubectl top pods -n container-course --containers
kubectl top nodes
kubectl -n container-course get pods -o wide
kubectl -n container-course get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp
~~~

一个有用的告警应说明用户影响、触发窗口、值班人和止损步骤。例如“API 5xx 比例连续 5 分钟超过 SLO”比“某 Pod CPU 大于 80%”更直接；CPU 适合作为原因线索，不一定代表用户正在受影响。

避免把用户 ID、完整 URL 或请求 ID 放进 Prometheus 标签，这些高基数维度会让时间序列数量快速增长。它们更适合结构化日志或 trace 属性，并且仍需脱敏与访问控制。

## 参考资料

- [Kubernetes 日志架构](https://kubernetes.io/docs/concepts/cluster-administration/logging/)
- [系统指标](https://kubernetes.io/docs/concepts/cluster-administration/system-metrics/)
- [Prometheus](https://prometheus.io/docs/introduction/overview/)
