---
title: 发布新版本：滚动更新、坏镜像回滚和蓝绿切换
date: '2026-11-24'
summary: 观察新旧 ReplicaSet 的变化，故意发布一个不存在的镜像，再完成回滚并理解流量切换边界。
series: Docker 与 Kubernetes
order: 35
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-deployment
  - k8s-probes
goals:
  - 观察新旧 ReplicaSet 的变化，故意发布一个不存在的镜像，再完成回滚并理解流量切换边界。
---
发布不是“把镜像名改了就完事”。你需要知道新副本有没有就绪、旧副本是否还在服务、卡住时怎么退回。先使用 lab 中已有的 web Deployment，实验前重新 apply 基础文件，把前面可能做过的改动恢复到已知状态。

## 滚动更新怎么安排新旧副本

Deployment 默认使用 RollingUpdate。`maxSurge` 控制允许多出多少期望副本，`maxUnavailable` 控制更新时允许少多少可用副本；百分比有不同取整规则，初学时直接写整数更容易观察。Recreate 则先结束旧 Pod 再创建新 Pod，会有明显空档。

~~~bash
kubectl apply -f basics/deployment.yaml -f basics/service.yaml
kubectl -n lab patch deployment web --type=merge -p '{"spec":{"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxSurge":1,"maxUnavailable":0}},"minReadySeconds":5,"progressDeadlineSeconds":90}}'
kubectl -n lab set image deployment/web nginx=nginx:1.28.0-alpine
kubectl -n lab rollout status deployment/web --timeout=180s
kubectl -n lab get rs
kubectl -n lab rollout history deployment/web
~~~

两个副本时，最多额外启动一个新 Pod，等新实例保持 Ready 一段时间再减少旧副本。没有业务 readiness 时，Ready 未必代表业务真的准备好；正式服务应结合上一课探针，而不是仅靠 minReadySeconds 猜测。

## 发布一个不存在的标签

~~~bash
kubectl -n lab set image deployment/web nginx=nginx:foaier-does-not-exist
kubectl -n lab rollout status deployment/web --timeout=110s
kubectl -n lab get pods -l app=web
kubectl -n lab describe pod -l app=web
~~~

rollout 会失败或超时，新 Pod 的事件显示拉取失败，旧 Pod 因 maxUnavailable 为 0 仍保留。这里故意失败，不要把非零退出码当成教程走不下去。集群有足够资源和正常旧副本才有这个效果，配置本身无法凭空保证业务无损。

## 回滚到上一份 Pod 模板

~~~bash
kubectl -n lab rollout undo deployment/web
kubectl -n lab rollout status deployment/web --timeout=180s
kubectl -n lab get deployment web -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
kubectl -n lab get rs
~~~

镜像恢复到上一版，失败 ReplicaSet 缩到零。`rollout undo` 回退的是 Deployment Pod 模板，不会回滚数据库结构、外部配置或用户数据。兼容性不好的数据库迁移，即便代码回滚也可能不能运行，因此迁移应尽量采用先兼容、再切换、最后清理的步骤。

## 暂停发布和指定历史版本

~~~bash
kubectl -n lab rollout pause deployment/web
kubectl -n lab set image deployment/web nginx=nginx:1.28-alpine
kubectl -n lab rollout resume deployment/web
kubectl -n lab rollout status deployment/web --timeout=180s
kubectl -n lab rollout history deployment/web
~~~

pause 可暂缓多次模板修改引起的发布，不会冻结集群所有操作。要回退某次历史，先用 history 查到真实 revision，再执行带 `--to-revision` 的 undo；不能保证读者环境里“第 2 版”一定是好版本。修复后还要更新配置仓库，否则下次 apply 可能再次发布坏镜像。

## 蓝绿与金丝雀解决不同问题

蓝绿是两套完整部署，验证绿色后把 Service selector 从蓝切到绿，失败时切回；切换不会迁移已经建立的 TCP 连接。金丝雀让少部分流量先进入新版，观察错误率、延迟等指标后扩大比例。只靠两个 Deployment 的 Pod 数量，并不能严格保证 HTTP 请求按 90/10 分配，连接复用会影响分布；精确权重通常交给入口或服务网格。

可在本地做一个简单蓝绿切换：

~~~bash
kubectl -n lab create deployment web-green --image=nginx:1.28-alpine
kubectl -n lab rollout status deployment/web-green --timeout=120s
kubectl -n lab patch service web --type=merge -p '{"spec":{"selector":{"app":"web-green"}}}'
kubectl -n lab get endpointslices -l kubernetes.io/service-name=web
kubectl apply -f basics/service.yaml
kubectl -n lab delete deployment web-green
~~~

两个版本页面相同，本实验重点看 EndpointSlice 指向改变；正式验收要用版本响应和业务请求确认。最后恢复基础 Service，清理绿色部署，保留 web。

## 继续阅读

- [Deployment 更新策略](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/deployment/)
- [kubectl rollout](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/)
