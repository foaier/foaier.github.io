---
title: "删掉一个 Pod，它为什么又回来了？用 Deployment 维持副本"
date: "2026-11-24"
summary: "亲自删除 API 副本、观察自动补齐，再把临时改动恢复成清单里的设置。"
series: "Docker 与 Kubernetes"
order: 22
tags: ["Kubernetes 入门", "Docker"]
level: "Kubernetes 入门"
prerequisites: ["k8s-pod-yaml"]
goals: ["观察 Deployment 补齐副本，能查看副本数并恢复部署配置。"]
---

上一课的 Pod 被删除后就消失了。现在看课程 API 的 Deployment：它记着“我要两个 API 副本”，发现少了一个就会安排新的 Pod。新 Pod 名字会变，这是正常的；你要关注的是副本数和服务状态。

## 先确认自己连的是练习集群

~~~powershell
kubectl config current-context
kubectl -n container-course get deployment,pod
~~~

第一条必须是 `kind-course`。第二条应看到 `course-api` 的 READY 是 `2/2`。如果没有这项 Deployment，回到本课集群安装章节把示例应用部署成功，不要临时在别的集群上继续。

## 删除一个 API 副本，观察它回来

下面命令会从课程 API 中挑一个 Pod 删除，不会删除数据库。`-w` 会持续显示状态变化；看到新 Pod 出现并变成 Running 后，在终端按 Ctrl+C 停止观察。

~~~powershell
$coursePod = kubectl -n container-course get pod -l app=course-api -o jsonpath="{.items[0].metadata.name}"
kubectl -n container-course delete pod $coursePod
kubectl -n container-course get pods -l app=course-api -w
~~~

再检查 Deployment 和 Pod 数量，应该重新有两个 API 副本：

~~~powershell
kubectl -n container-course get deployment course-api
kubectl -n container-course get pods -l app=course-api -o wide
~~~

负责补副本的叫控制器。它反复比较“当前有几个”和“配置要求几个”，少了就补，多了就删。你只要把期望写清楚，它会继续尝试把现状拉回去。

## 暂时扩到三个，再恢复

先做一次临时扩容，确认 Ready 数量变成 3/3；然后重新应用课程文件，让副本数回到清单中写的 2。

~~~powershell
kubectl -n container-course scale deployment/course-api --replicas=3
kubectl -n container-course rollout status deployment/course-api
kubectl -n container-course apply -f k8s/20-api.yaml
kubectl -n container-course rollout status deployment/course-api
kubectl -n container-course get deployment course-api
~~~

这是在本机练习集群中操作。生产环境扩容前要先确认机器容量和数据库连接数；增加 API 副本不会自动增加数据库容量。

## 一张图看懂 Deployment 管理谁

Deployment 记住副本数和 Pod 模板；它创建一个 ReplicaSet 来维持指定模板的副本；ReplicaSet 再创建 Pod。删掉一个 Pod 后，由 ReplicaSet 发现数量不足并补一个。通常改 Deployment 清单，不手工去改它下面的 ReplicaSet。

## 新 Pod 没起来时看这里

执行 `kubectl -n container-course get pods`，若状态是 ImagePullBackOff，先查镜像名称和 kind 镜像是否已加载；若是 Pending，运行下面命令看集群给的原因：

~~~powershell
kubectl -n container-course describe deployment course-api
kubectl -n container-course get events --sort-by=.metadata.creationTimestamp
kubectl -n container-course logs deployment/course-api
~~~

完成练习后确认 Deployment 回到 2/2。课程的 API 副本共用数据库，所以这次删 Pod 不会删数据库记录；只写在容器本地的文件则可能随 Pod 一起消失。

## 参考资料

- [Deployment 管理应用](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [扩展 Deployment](https://kubernetes.io/docs/tasks/run-application/scale-deployment/)
