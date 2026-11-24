---
title: Pod 没起来，别先删：按顺序把原因一层层找出来
date: '2026-11-24'
summary: 用一套稳定顺序区分授权、调度、拉镜像、进程、探针与 Service 故障。
series: Docker 与 Kubernetes
order: 36
tags:
  - Kubernetes 进阶
  - Docker
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-networking
goals:
  - 通过 Events 和容器日志定位一个可复现问题，并用外部请求验证恢复。
---

看到报警，第一反应想 delete Pod 很正常，控制器也许会重建它。但如果配置没变，新 Pod 只会原样失败。先保留现场，把范围缩小再动手。

## 先定位故障卡在哪一层

排错顺序从外往内走：先确认 context 与 namespace；再看控制器期望和 Pod 实际；检查 Events、调度、镜像；查看容器退出状态与日志；验证探针、Service 和 EndpointSlice；最后查 DNS、依赖和网络策略。CrashLoopBackOff 是重启退避状态，不是根因。

ImagePullBackOff、CreateContainerConfigError、Pending、Ready 0/1、HTTP 500 分属不同层。判断应用能否服务，最后还得从真实调用方发请求，而不是只看 Pod phase。

## 按对象、事件、日志的顺序找证据

确认 kind-course 后查看课程 API 的对象、最近事件、Pod 描述和日志。选好一只 Pod 再看 `--previous`；当前实例重启过才会有上一次容器日志。

~~~powershell
kubectl config current-context
kubectl -n container-course get deployment,replicaset,pods -o wide
kubectl -n container-course get events --sort-by=.metadata.creationTimestamp
$coursePod = kubectl -n container-course get pod -l app=course-api -o jsonpath="{.items[0].metadata.name}"
kubectl -n container-course describe pod $coursePod
kubectl -n container-course logs $coursePod --all-containers=true --tail=100
kubectl -n container-course logs $coursePod --previous --all-containers=true --tail=100
kubectl -n container-course get endpointslice -l kubernetes.io/service-name=course-api
~~~

## 快速筛告警事件和重启中的 Pod

如果集群对象很多，先把事件缩到 Warning，再看 API Pod 的阶段、重启次数和等待原因。Pending 先看调度 Events；ImagePullBackOff 看镜像引用与拉取凭证；CrashLoopBackOff 再查当前或上一轮日志。

~~~powershell
kubectl -n container-course get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp
kubectl -n container-course get pods -l app=course-api -o custom-columns='POD:.metadata.name,PHASE:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount,WAITING:.status.containerStatuses[0].state.waiting.reason'
kubectl -n container-course describe deployment/course-api
~~~

## 常见状态对应的第一条证据

| 状态或现象 | 第一处看什么 | 下一步 |
|---|---|---|
| Pending | describe Pod 的 FailedScheduling / PVC Events | 比较 requests、节点标签、taints、PVC |
| ImagePullBackOff | Pod Events 中的镜像地址与错误码 | 核对 tag、架构、imagePullSecret 和节点网络 |
| CreateContainerConfigError | Events 中缺失的 ConfigMap/Secret key | 检查对象 namespace、名字和 key |
| CrashLoopBackOff | logs --previous 和 lastState | 看进程退出码、启动参数、依赖和探针 |
| Running 但 Ready 0/1 | readiness 事件与应用响应 | 查依赖、端口、就绪路径 |
| Service 503 | EndpointSlice 与后端 Pod Ready | 再查 selector、网络策略和入口 |

这些状态不是最终诊断。比如 CrashLoopBackOff 只说明失败容器在退避后重试，根因可能是配置错误、进程启动失败、探针杀死或依赖不通。

## 一次事故收集最小可复现信息

先确定上下文、namespace、变更时间和影响范围，再收集对象、Events、当前日志与上一轮日志。命令输出可能包含内部地址或业务数据，转发给他人前要做脱敏。

~~~powershell
kubectl config current-context
kubectl -n container-course get deployment,replicaset,pods,service,endpointslice -o wide
kubectl -n container-course get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp
kubectl -n container-course describe deployment/course-api
$coursePod = kubectl -n container-course get pod -l app=course-api -o jsonpath='{.items[0].metadata.name}'
kubectl -n container-course logs $coursePod --all-containers=true --tail=100 --timestamps
kubectl -n container-course logs $coursePod --all-containers=true --previous --tail=100 --timestamps
~~~

日志中看不到启动前的拉取错误，要回到 Events；上一轮日志为空通常说明容器没有重启或没有上一实例。若对象已经被删除，先查控制器是否重建；不要用反复删 Pod 来替代根因分析。

## 从症状到修复要保留一条因果链

记录“用户看到什么 → 哪个对象异常 → 哪条事件/日志支持判断 → 哪个配置导致它 → 改了什么 → 怎么验证恢复”。只写“重启后好了”无法解释是资源耗尽、节点恢复还是偶发故障，也无法阻止问题再次出现。

修复后至少验证两层：Pod 已 Ready 且进入 EndpointSlice；真实调用方访问服务成功。涉及数据库时再验证业务读写和数据完整性。恢复后补上监控、发布前校验、容量或权限改进，使下一次能够更早发现。

## 参考资料

- [调试运行中的 Pod](https://kubernetes.io/docs/tasks/debug/debug-application/)
- [kubectl logs 命令](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_logs/)
