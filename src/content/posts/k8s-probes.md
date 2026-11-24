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

## 留一个小练习

打开 `20-api.yaml` 对照三个探针的路径与周期。把 startup 的失败预算算出来：periodSeconds 乘 failureThreshold 只是粗略窗口，还要考虑执行时间和初始延迟。不要把课上一个阈值当成所有服务通用答案。

## 没跑通时先查什么

探针报 connection refused 看端口和监听地址；报 timeout 看 CPU、数据库超时和网络。readiness 失败的 Events 与应用日志一起看。当前 API 就绪检查会访问真实数据库，生产要控制开销并给连接超时留合理预算。

## 参考资料

- [探针配置](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [容器探针](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)
