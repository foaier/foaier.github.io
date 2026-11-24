---
title: "发布新版本怎么尽量少中断？滚动更新、观察和回滚一起练"
date: "2026-11-24"
summary: "用两个可追溯镜像标签练发布，并故意制造失败看 rollout 如何卡住。"
series: "Docker 与 Kubernetes"
order: 28
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-resources"]
goals: ["执行一次 API 滚动发布并用 rollout undo 恢复上个 Pod 模板。"]
---

镜像推到仓库，只完成了交付的一半。部署时旧副本要不要等新副本就绪、失败后会不会一直卡着、回滚能恢复什么，都得想清楚。Kubernetes 的滚动更新提供机制，业务是否无中断还受连接、探针和数据库变更影响。

## 发布节奏由副本和探针一起决定

Deployment 的 RollingUpdate 用 maxSurge 控制临时多出的副本、maxUnavailable 控制更新期间允许不可用的数量。Readiness 应当真实反映接流量能力；否则新 Pod 刚起来就被当成可用。旧进程还要能优雅处理 SIGTERM，留出请求完成与连接摘除的时间。

rollout undo 回退的是历史 Pod 模板，不能把 PostgreSQL 已执行的破坏性迁移倒回去。发布前用兼容的新旧字段、分阶段迁移和可靠备份，数据库回滚需要单独设计。

## 用两个版本标签练一次回滚

先用已有课程镜像打两个练习标签，内容相同，重点观察标签与 ReplicaSet 变化。载入 kind 后部署 v1、再 v2。此时不要同时修改其他配置，便于明确此次回滚的范围。

~~~powershell
docker tag container-course-api:local container-course-api:v1
docker tag container-course-api:local container-course-api:v2
kind load docker-image container-course-api:v1 container-course-api:v2 --name course
kubectl -n container-course set image deployment/course-api api=container-course-api:v1
kubectl -n container-course rollout status deployment/course-api
kubectl -n container-course set image deployment/course-api api=container-course-api:v2
kubectl -n container-course rollout status deployment/course-api
kubectl -n container-course rollout history deployment/course-api
kubectl -n container-course rollout undo deployment/course-api
kubectl -n container-course rollout status deployment/course-api
~~~

## 怎么确认做对了

发布过程出现新的 ReplicaSet，最终两个可用副本使用指定标签；undo 后回到上一版模板。这两份标签故意内容相同，所以根路径 JSON 不会神奇改变版本，验证应看镜像引用与 ReplicaSet。真正发版应构建不同代码并用不可变 tag 或 digest。

## 留一个小练习

把 API 镜像设为一个不存在的课程标签，观察新 Pod 拉取失败、旧 Pod 是否仍服务。随后 undo，再 apply 基础清单恢复 local。progressDeadlineSeconds 超时会报告失败，但不会替你自动决定业务回滚。

## 没跑通时先查什么

rollout status 一直等时，查新 Pod 的 Events 和 readiness；不要只盯 Deployment。复用同一 local 标签时，旧节点缓存不会自动知道镜像变了；换唯一标签比反复猜 imagePullPolicy 可靠。

## 参考资料

- [Deployment 滚动发布](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Pod 生命周期与停止](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
