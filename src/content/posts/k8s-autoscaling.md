---
title: "副本能自动调吗？HPA 也得先看 Metrics API 和容量上限"
date: "2026-11-24"
summary: "理解 HPA 的指标依赖，以及 Pod 扩容与节点扩容的区别。"
series: "Docker 与 Kubernetes"
order: 38
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-observability"]
goals: ["检查 Metrics API 与 HPA，并设计有数据库容量约束的扩缩容策略。"]
---

给 API 多加几个副本不难，难的是高峰时及时扩、低峰时平稳收回，而且新副本能处理更多工作。HPA 是起点，不是让集群无成本无限增长的开关。

## 概念讲透：它负责什么，不负责什么

HPA 根据 CPU、内存或自定义指标调节工作负载副本；CPU 利用率通常相对 request 计算，所以没有合理 request 就难以解释目标百分比。扩副本只能应对应用横向可扩展且下游有余量的压力；节点不足还需要集群自动扩容，队列消费可考虑基于队列长度的指标。

## 运行过程拆解：从输入到结果

HPA 周期性读指标，与目标比较后更新 Deployment 的 scale 子资源，控制器随后按新副本数创建 Pod。Pod 若 Pending，说明调度容量或约束没解决；Pod 已多但数据库耗尽，说明扩容目标超过下游能力。扩缩策略还要考虑未就绪副本、采样延迟和稳定窗口，用端到端请求延迟验证收益，而不只看副本数量变化。

## 扩副本之前先弄清指标和容量

HorizontalPodAutoscaler 根据 CPU、内存或自定义指标调整 Deployment 副本数。CPU 百分比基于 requests 计算；Metrics Server 不在场时资源指标目标就不可用。队列长度等业务信号需专门的 metrics adapter。

新增 Pod 没有节点可放，扩容仍会 Pending。Cluster Autoscaler 或云节点自动供给是另一层，需要云权限、配额和预算。横向扩容还要约束数据库连接池、状态共享与最大副本数。

## 检查 Metrics API 是否真的可用

先只读检查当前 Metrics API、HPA 和 API requests。kind 默认通常没有 Metrics Server，所以这节不创建一个看起来能运行却没有指标的 HPA。动态练习需要在独立集群里安装与其 Kubernetes 版本兼容的指标服务。

~~~powershell
kubectl get apiservices v1beta1.metrics.k8s.io
kubectl top nodes
kubectl -n container-course get hpa
kubectl -n container-course get deployment course-api -o jsonpath="{.spec.template.spec.containers[0].resources.requests}"
~~~

## 怎么确认做对了

有 Metrics Server 时 top 与 HPA 才能获取资源信号；没有时 top 报 Metrics API 未注册，HPA 的 current 指标会是 unknown。Deployment 的 requests 和限制仍有效，但自动扩容并未因此开启。

## 案例推演

CPU 已高，HPA 仍显示 unknown。先检查 Metrics API 和 metrics-server，再核对 Pod 是否声明 CPU request、HPA 的 scaleTargetRef 和指标名称。指标正常后制造受控负载，观察副本数和扩容延迟；同时确认数据库连接数上限，避免 API 扩容把数据库压垮。

## 留一个小练习

设计 API 的扩缩容范围：最小副本数怎样覆盖节点故障，最大副本数对数据库连接意味着什么，指标目标来自什么压测数据，缩容要留多少缓冲。每个数字都需要容量和成本依据。

## 没跑通时先查什么

HPA 不动，先看 Conditions、指标 API、requests 和 Events。副本增加后仍慢，检查数据库连接池、锁、CPU throttling 和新副本是否真的接到流量。HPA 不会自动增加节点。

自动扩容本身也有延迟：指标采样、控制器决策、调度、镜像拉取和应用预热都会花时间。高峰到来前需要合适的容量余量；队列型系统还应监控积压和消费速度，不能只盯 CPU 百分比。

## 指标可用之后，跑一次真正的扩缩容

先按 Metrics Server 官方兼容表安装到独立练习集群，直到 kubectl top pods -n container-course 能读到数值。若 kubelet 证书校验失败，应按集群证书和地址配置排查；不要把关闭 TLS 校验当成生产标准配置。

课程包已提供 labs/hpa.yaml，目标是 API，最少 2 个副本、最多 4 个、CPU 平均利用率目标 60%，缩容观察窗口为 300 秒。当前 API CPU request 为 50m，因此 60% 对应每副本平均 30m，而不是宿主机总 CPU 的 60%。这是演示值，真正上线需重新做容量估计。

~~~powershell
kubectl apply -f labs/hpa.yaml
kubectl -n container-course get hpa course-api -w
# 看完按 Ctrl+C，查看条件与事件
kubectl -n container-course describe hpa course-api
~~~

简化估算为：目标副本数 = 向上取整（当前副本数 × 当前平均利用率 ÷ 目标利用率）。例如两个副本当前平均 120%，目标 60%，粗算就是 4 个副本。实际控制器还会考虑容差、尚未就绪的 Pod、缺失指标和伸缩行为，不能要求每个采样点都完全符合这个算式。

要产生一点课程负载，可启动下面的集群内临时客户端，只请求不依赖数据库的根路径；另一个终端观察 HPA。实验限制十分钟，结束后主动删除客户端。

~~~powershell
kubectl -n container-course run course-load --image=busybox:1.37 --restart=Never --command -- sh -c 'end=$(( $(date +%s) + 600 )); while [ $(date +%s) -lt $end ]; do wget -q -O /dev/null http://course-api/; done'
kubectl -n container-course get hpa,pods
kubectl -n container-course delete pod course-load
~~~

单个客户端不保证把 CPU 压到阈值。没扩容时先看实际指标：利用率没有超过目标，保持原副本数才是正常行为。停止负载后也不会立刻缩容，稳定窗口就是用来减少抖动的。

练完删除 HPA，再恢复 YAML 中的副本数。HPA 存在期间别反复 apply 含固定 replicas 的 Deployment，避免两个来源轮流改数量。

~~~powershell
kubectl -n container-course delete hpa course-api
kubectl apply -f k8s/20-api.yaml
~~~

## 观察 HPA 如何逐步调整副本

HPA 根据指标周期性地调整 Deployment 副本，不会立即响应每个请求。下面持续观察 HPA 和 Pod 数量，看到变化后按 Ctrl+C；若指标显示未知，先修 Metrics API 与 CPU requests。

~~~powershell
kubectl -n container-course get hpa course-api --watch
kubectl -n container-course get pods -l app=course-api --watch
~~~

## 生产里怎么用、怎么排障

HPA 有采样和稳定窗口，尖峰来得太快时扩容可能赶不上；扩缩容过于激进又会造成抖动。配置行为策略、最小副本和最大副本，按业务延迟与队列积压调优。负载生成实验只在本地或授权环境执行，并监控下游容量；副本变多不等于吞吐必然变大。

## 参考资料

- [HPA](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/)
- [自动伸缩概念](https://kubernetes.io/docs/concepts/workloads/autoscaling/)
- [Metrics Server](https://github.com/kubernetes-sigs/metrics-server)
