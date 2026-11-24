---
title: "第一份 Pod YAML：哪些是 Kubernetes 的规矩，哪些是你给程序的参数"
date: "2026-11-24"
summary: "用一个临时 Pod 理解 apiVersion、kind、metadata、spec 和标签。"
series: "Docker 与 Kubernetes"
order: 22
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-local-cluster"]
goals: ["运行独立演示 Pod，读懂 YAML 结构并观察删除后的行为。"]
---

前一课已经跑起整套服务，这次拆开看最小单位 Pod。Pod 可以容纳一个或多个紧密协作的容器，它们共享网络与卷。初学先用一个容器就好，别一看到“可以多个”就把数据库和所有业务服务塞进去。

## 概念讲透：它负责什么，不负责什么

Kubernetes 对象由 apiVersion、kind、metadata 和 spec 描述：对象种类决定字段结构，metadata 用于命名和分组，spec 写期望，status 是控制器观察到的现状。标签用于把对象关联起来，selector 必须和 Pod 标签匹配。Pod 是最小调度单元，通常应交给 Deployment 等控制器管理，直接创建的 Pod 被删后不会自动回来。

## 运行过程拆解：从输入到结果

apiVersion 与 kind 决定服务器用哪种结构校验对象，metadata.name 和 namespace 决定身份，labels 负责选择与分组，spec.template 描述控制器创建的新 Pod，status 则是控制器持续写回的观测结果。手工修改 status 不会修复工作负载；期望字段变更后还要看控制器是否接受并创建新实例。字段拼写正确也不代表配置语义正确。

## 按字段读懂一份 Pod 声明

apiVersion 与 kind 告诉 API Server 你创建哪类对象；metadata 放名字、namespace、labels；spec 写期望配置。containerPort 是声明容器监听端口的信息，不会替程序打开监听，也不会自动映射宿主机端口。Pod 的 IP 会随重建变化，所以应用不应把另一个 Pod 的 IP 硬编码进配置。

将下面 YAML 保存为 `k8s/pod-demo.yaml`。这是独立练习 Pod，只访问不依赖数据库的存活接口。镜像沿用前一课已载入的 local 标签。

## 先运行一个独立的演示 Pod

保存文件后运行 `kubectl apply -f k8s/pod-demo.yaml`，再用 `kubectl -n container-course get pod pod-demo -o wide` 观察。它刚开始可能 Pending 或 ContainerCreating，等 Ready 后执行 `kubectl -n container-course port-forward pod/pod-demo 8081:8080`，浏览器访问 http://localhost:8081/health/live。

~~~yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-demo
  namespace: container-course
  labels:
    app: pod-demo
spec:
  containers:
    - name: api
      image: container-course-api:local
      imagePullPolicy: IfNotPresent
      ports:
        - containerPort: 8080
~~~

## 怎么确认做对了

接口返回 alive。`kubectl -n container-course describe pod pod-demo` 能看到节点、镜像、状态与 Events。把 labels 改掉并 apply，观察对象更新；镜像名拼错导致拉取失败时，也在 Events 中找线索。不要为了练习直接改课程主服务。

## 案例推演

Service 没有后端，describe 显示 selector 是 app=api，而 Pod 标签实际是 app=course-api。逐字段比较 metadata.labels 与 Service spec.selector，比猜网络问题快得多。改标签前先查看引用关系；一些对象字段创建后不可变，直接 patch 可能失败，需要按迁移顺序重建相关资源。

## 留一个小练习

先结束 port-forward，再执行 `kubectl -n container-course delete pod pod-demo`，观察它不会回来。对照下一课的 Deployment：同样删一个 Pod，有控制器维护的会再补一个。独立 Pod 适合说明机制，业务长期运行应交给控制器。

## 没跑通时先查什么

YAML 缩进用空格；`metadata.name` 是对象名字，`containers[].name` 是容器名字，两者作用不同。多数 Pod spec 字段不能直接原地修改，遇到 immutable 提示要理解对象重建边界，别为了省事强制替换生产资源。

YAML 交给 API Server 后还会经过准入校验、默认值填充与控制器处理，因此 `kubectl get -o yaml` 看到的最终对象可能比自己写的清单更长。读输出时先聚焦 metadata、spec、status，理解哪些是你声明的，哪些是系统补上的。

## 生产里怎么用、怎么排障

YAML 可以通过代码审查，但“可读”不等于安全。生产清单要校验命名空间、镜像来源、资源请求、探针、权限和 Secret 引用；先用 diff/服务器端 dry-run 看变更，再 apply。删除清单要确认对象所有权和级联影响，尤其不要把有状态卷随手一起删掉。

## 参考资料

- [Pod](https://kubernetes.io/docs/concepts/workloads/pods/)
- [Kubernetes 对象](https://kubernetes.io/docs/concepts/overview/working-with-objects/)
