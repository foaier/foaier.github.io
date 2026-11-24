---
title: "进程活着，服务却不能用：三种探针分别在问什么"
date: "2026-11-24"
summary: "用数据库断开实验区分 startup、liveness 和 readiness。"
series: "Docker 与 Kubernetes"
order: 26
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-config-secrets"]
goals: ["观察 API 失去数据库连接时只退出就绪后端，而不被反复重启。"]
---

最难排的故障之一，是 Pod 显示 Running，用户却一直拿到 500。Kubernetes 不知道你的一次业务请求需要数据库，它只能按你给的探针判断状态。问错问题，就可能在数据库短暂故障时把所有 API 一起重启。

## 概念讲透：它负责什么，不负责什么

startupProbe 解决启动慢，成功前暂缓 liveness 和 readiness；liveness 判断进程是否需要重启；readiness 判断 Pod 是否应接收流量。三者失败动作不同，不能用一个探针包打天下。尤其不要让 liveness 深度依赖数据库，否则数据库短暂抖动会触发所有 API 同时重启，进一步放大故障。

## 运行过程拆解：从输入到结果

一次请求的状态要和探针问题对应：慢启动还没初始化完用 startup 探测，线程卡死或进程失去响应才考虑 liveness，暂时无法完成业务但进程仍健康时用 readiness 摘除流量。探针的失败阈值会换成动作，不只是仪表盘颜色。端点设计要快、稳定、无副作用，并通过实验确认失败时集群到底会重启、摘流量还是继续等待。

## 三种探针各自问一个问题

startup 判断程序是否启动完成，它成功前会压住另外两种探针。liveness 判断进程是否到了需要重启的地步；readiness 判断此刻是否该接业务流量。readiness 失败通常会让该 Pod 不再作为就绪 Service 后端，但不会因此重启容器。

课程 `/health/live` 只看进程响应，`/health/ready` 会查询数据库。不要把数据库连不上写成必定 liveness 失败，否则数据库出问题时 API 重启风暴只会加重负担。阈值、超时和周期要结合启动时间、依赖耗时以及故障恢复目标。

## 停掉数据库，看看 API 的反应

先开着 API 的 port-forward，另一个终端仅在 kind-course 中把数据库降为零，观察 API readiness。实验会中断课程服务，请确保当前只有虚构数据；做完立即恢复数据库。

~~~powershell
kubectl config current-context
kubectl -n container-course scale deployment/postgres --replicas=0
kubectl -n container-course get pods -l app=course-api -w
# 观察 API READY 变为 0/1 后按 Ctrl+C，恢复数据库
kubectl -n container-course scale deployment/postgres --replicas=1
kubectl -n container-course rollout status deployment/postgres --timeout=180s
kubectl -n container-course wait --for=condition=Ready pod -l app=course-api --timeout=180s
~~~

## 怎么确认做对了

数据库不可用时 API 可能仍是 Running，但 READY 变为 0/1，RESTARTS 不因 readiness 失败持续上涨。恢复后逐渐回到 1/1。失联连接可能需要等超时，不要求你在第一秒就看到状态变化。

## 案例推演

数据库维护几分钟，API 因 liveness 连数据库失败而不断重启。Pod 重启并没有修复数据库，反而让连接重建更拥挤。把存活检查限制在进程自身，把数据库可用性放到 readiness 或业务告警；数据库恢复后检查连接池能否重新连上，再确认 EndpointSlice 重新包含 API。

## 留一个小练习

打开 `20-api.yaml` 对照三个探针的路径与周期。把 startup 的失败预算算出来：periodSeconds 乘 failureThreshold 只是粗略窗口，还要考虑执行时间和初始延迟。不要把课上一个阈值当成所有服务通用答案。

## 没跑通时先查什么

探针报 connection refused 看端口和监听地址；报 timeout 看 CPU、数据库超时和网络。readiness 失败的 Events 与应用日志一起看。当前 API 就绪检查会访问真实数据库，生产要控制开销并给连接超时留合理预算。

## 生产里怎么用、怎么排障

探针 URL、超时、period 和 failureThreshold 要按真实启动时间与故障恢复时间设置。探针端点不能执行昂贵查询，避免每秒产生数据库压力；启动慢的应用用 startupProbe 给足初始化窗口。发布前模拟依赖断连、慢启动和进程死锁，分别观察 Pod 是否被摘流量、是否重启以及事件是否清楚。

## 参考资料

- [探针配置](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [容器探针](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)
