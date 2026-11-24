---
title: 进程活着，服务却不能用：三种探针分别在问什么
date: '2026-11-24'
summary: 用数据库断开实验区分 startup、liveness 和 readiness。
series: Docker 与 Kubernetes
order: 26
tags:
  - Kubernetes 入门
  - Docker
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-config-secrets
goals:
  - 观察 API 失去数据库连接时只退出就绪后端，而不被反复重启。
---

最难排的故障之一，是 Pod 显示 Running，用户却一直拿到 500。Kubernetes 不知道你的一次业务请求需要数据库，它只能按你给的探针判断状态。问错问题，就可能在数据库短暂故障时把所有 API 一起重启。

## 三种探针各自问一个问题

startup 判断程序是否启动完成，它成功前会压住另外两种探针。liveness 判断进程是否到了需要重启的地步；readiness 判断此刻是否该接业务流量。readiness 失败通常会让该 Pod 不再作为就绪 Service 后端，但不会因此重启容器。

课程 `/health/live` 只看进程响应，`/health/ready` 会查询数据库。不要把数据库连不上写成必定 liveness 失败，否则数据库出问题时 API 重启风暴只会加重负担。阈值、超时和周期要结合启动时间、依赖耗时以及故障恢复目标。

## 停掉数据库，看看 API 的反应

先开着 API 的 port-forward，另一个终端仅在 kind-course 中把数据库降为零，观察 API readiness。实验会中断课程服务，请确保当前只有虚构数据；做完立即恢复数据库。

~~~powershell
$context = kubectl config current-context
if ($context -ne 'kind-course') { throw "当前 context 是 $context；只在本地 kind-course 中练习" }
kubectl -n container-course scale deployment/postgres --replicas=0
kubectl -n container-course get pods -l app=course-api -w
# 观察 API READY 变为 0/1 后按 Ctrl+C，恢复数据库
kubectl -n container-course scale deployment/postgres --replicas=1
kubectl -n container-course rollout status deployment/postgres --timeout=180s
kubectl -n container-course wait --for=condition=Ready pod -l app=course-api --timeout=180s
~~~

## 观察 readiness 失败时端点如何变化

仅在本地课程集群执行数据库故障实验。readiness 失败时 API 仍可能 Running，但会从就绪端点暂时移除；它本身不应导致容器重启。describe 中 Events 显示探针失败原因。恢复数据库后等 Pod Ready，再确认地址重新加入。

~~~powershell
kubectl -n container-course get pods -l app=course-api
kubectl -n container-course get endpointslice -l kubernetes.io/service-name=course-api -w
kubectl -n container-course describe pod -l app=course-api
~~~

## 三种探针的后果完全不同

| 探针 | 它在问什么 | 失败后 Kubernetes 做什么 |
|---|---|---|
| startupProbe | 程序是否完成启动 | 启动期间先不执行 liveness/readiness；超过阈值后按启动失败处理 |
| livenessProbe | 进程是否已经无法自愈 | 达到失败阈值后重启该容器 |
| readinessProbe | 这个副本此刻能否接流量 | 从 Service 的可用 EndpointSlice 后端中移除，容器通常继续运行 |

把“依赖数据库是否通”加进 liveness，可能让数据库短暂故障时所有 API 一起重启，反而制造雪崩。数据库依赖通常属于 readiness 或业务层故障响应；liveness 应只检查进程无法自行恢复的状态。

## 参数决定故障检测速度，也决定误报概率

periodSeconds 是检查间隔，timeoutSeconds 是单次超时，failureThreshold 是连续失败阈值，successThreshold 是恢复所需连续成功次数。startupProbe 的失败预算大约是 periodSeconds × failureThreshold；例如启动需要 40 秒，就不能只给 5 次、每次间隔 3 秒的启动预算。

HTTP 检查要求目标容器在 Pod 网络中能通过指定端口和路径响应。TCP 检查只证明连接能建立，不证明业务请求成功；exec 检查在容器内运行命令，但会增加节点负担。优先选择与应用真实就绪条件接近、又不会依赖外部偶发故障的检查。

## 参考资料

- [探针配置](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [容器探针](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)
