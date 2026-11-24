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

## 先让 API Server 校验 YAML，再创建 Pod

--dry-run=server 让集群校验字段但不保存；确认成功再正式 apply。列表显示 Pod、IP 和节点。若字段不被当前版本支持，先读服务器错误并核对 apiVersion，不要不理解就删掉 spec 中的字段。

~~~powershell
kubectl config current-context
kubectl apply --dry-run=server -f k8s/pod-demo.yaml
kubectl apply -f k8s/pod-demo.yaml
kubectl -n container-course get pod pod-demo -o wide
~~~



## 每一组字段解决的是什么问题

| 字段 | 读写目的 | 容易混淆的点 |
|---|---|---|
| apiVersion / kind | 选 API 对象类型和字段版本 | 版本应以集群支持的 API 为准 |
| metadata.name / namespace | 给对象命名并划定逻辑范围 | namespace 不是网络防火墙 |
| metadata.labels | 给对象分类并供 selector 选择 | 同一个标签可能被多个 selector 使用 |
| spec.containers | 声明镜像、命令、端口、环境和挂载 | containerPort 不会创建主机端口映射 |
| spec.restartPolicy | 决定容器退出后的 Pod 行为 | 不等于 Deployment 的副本自愈 |
| status | 控制面和节点报告的观察结果 | 由系统更新，不是期望配置 |

同一 Pod 内的多个容器共享 Pod IP 和端口命名空间，也可以共享声明的 volume；这适合主容器和紧密耦合的 sidecar，不适合把无关微服务塞在一起。容器应有明确的职责和生命周期。

## 用 explain 学会查字段，而不靠复制陌生 YAML

kubectl explain 根据当前集群 API schema 展示字段说明，可以递归查看子字段。先 dry-run 服务器校验，再读对象最终状态与 Events。get -o yaml 中的 status、默认值和系统标签可能不是自己写的。

~~~powershell
kubectl explain pod.spec.containers
kubectl explain pod.spec.containers.resources
kubectl apply --dry-run=server -f k8s/pod-demo.yaml
kubectl -n container-course get pod pod-demo -o yaml
kubectl -n container-course describe pod pod-demo
~~~

explain 显示当前目标集群的 schema；本地 kubectl 版本与服务端版本有差异时，不要假设网上另一个版本的字段完全相同。生产变更应先用 dry-run 和 diff 看 API Server 将接受的内容，再在经过审批的流程里提交。

## Pod 状态读的是过程，不只是最终成败

Pending 通常表示尚未完成调度或卷绑定；ContainerCreating 表示节点正准备镜像、网络或挂载；Running 表示容器进程已运行，但未必 Ready；Succeeded/Failed 对一次性容器更常见。重启次数增加时查看 previous logs 和 termination reason，而不是只看当前一轮。

~~~powershell
kubectl -n container-course get pod pod-demo -o wide
kubectl -n container-course get pod pod-demo -o jsonpath='{.status.phase} {.status.containerStatuses[*].state}'
kubectl -n container-course logs pod-demo --previous
kubectl -n container-course get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp
~~~

如果容器从未成功启动，logs --previous 可能没有上一轮日志；ImagePullBackOff 也没有应用日志可看，因为应用进程尚未运行。此时要回到 Pod Events 和镜像引用排查。

## 生产里怎么用、怎么排障

YAML 可以通过代码审查，但“可读”不等于安全。生产清单要校验命名空间、镜像来源、资源请求、探针、权限和 Secret 引用；先用 diff/服务器端 dry-run 看变更，再 apply。删除清单要确认对象所有权和级联影响，尤其不要把有状态卷随手一起删掉。

## 参考资料

- [Pod](https://kubernetes.io/docs/concepts/workloads/pods/)
- [Kubernetes 对象](https://kubernetes.io/docs/concepts/overview/working-with-objects/)
