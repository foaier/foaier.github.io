---
title: "Pod 没起来，别先删：按顺序把原因一层层找出来"
date: "2026-11-24"
summary: "用一套稳定顺序区分授权、调度、拉镜像、进程、探针与 Service 故障。"
series: "Docker 与 Kubernetes"
order: 36
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-networking"]
goals: ["通过 Events 和容器日志定位一个可复现问题，并用外部请求验证恢复。"]
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

## 怎么确认做对了

先核对 context 是 kind-course，再读 Events 的 Reason 与 Message。EndpointSlice 为空时回查选择器和 readiness。没有上一次容器时 `--previous` 会提示无实例可读，不必据此认为日志系统坏了。

## 留一个小练习

只在本地把 API 镜像名改错，运行 get、describe、logs 留下证据，再用原清单恢复。不要在生产故意破坏镜像。按“现象—证据—根因—修复—验证”写成同事可以照做的记录。

## 没跑通时先查什么

Events 有保留期限，不可当长期审计。公开 issue 不贴带用户数据或密码的日志。修复后验证 API 与数据库依赖，避免只让 Pod 显示绿色。

定位后别忘了问“为什么这个故障没有更早被发现”。如果每次发布都会漏一个配置 key，修复可以包括 schema 校验或部署前测试；如果节点磁盘总满，删除 Pod 只能掩盖根因。让排错记录最终变成一条可预防的改进。

## 参考资料

- [调试运行中的 Pod](https://kubernetes.io/docs/tasks/debug/debug-application/)
- [kubectl logs 命令](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_logs/)
