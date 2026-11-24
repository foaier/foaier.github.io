---
title: "刚才的 YAML 是怎么变成程序的？顺着一次部署看 Kubernetes"
date: "2026-11-24"
summary: "结合刚才创建的 Deployment，看 API、控制器、调度器和节点各自做了什么。"
series: "Docker 与 Kubernetes"
order: 23
tags: ["Kubernetes 入门", "Docker"]
level: "Kubernetes 入门"
prerequisites: ["k8s-deployment"]
goals: ["按先后顺序说清楚提交 Deployment 后，集群如何创建并运行 Pod。"]
---

你刚才提交一份 Deployment 配置，几秒后却出现了新的 Pod。中间发生了什么？先把路径记成一句话：**Kubernetes 收到你的要求，记录下来，安排机器，再让机器启动程序。** 每一步由不同组件负责，出错时也就能按步骤找原因。

## 从刚才的 Deployment 找到相关对象

在课程示例目录中运行下面命令。第一条看你现在操作的集群；后面列出 Deployment、ReplicaSet 和 Pod。名称会因集群生成而不同，但 namespace 都是 `container-course`。

~~~powershell
kubectl config current-context
kubectl -n container-course get deployment,replicaset,pods -o wide
kubectl -n container-course describe deployment course-api
~~~

你会看到一个 Deployment、一个 ReplicaSet 和两个 API Pod。Deployment 保存“要两个副本”的要求；ReplicaSet 负责维持两个副本；Pod 是实际运行容器的对象。删掉一个 Pod 后，ReplicaSet 又创建一个新的，这就是刚才观察到的过程。

## 配置交上去之后发生了什么

```text
你运行 kubectl apply
  -> API Server 检查权限和配置，把 Deployment 记录到集群
  -> Deployment 控制器创建/更新 ReplicaSet
  -> ReplicaSet 控制器创建 Pod
  -> 调度器为 Pod 选择一台节点
  -> 节点上的 kubelet 下载镜像并启动容器
  -> 容器状态回报给集群，Pod 变成 Running/Ready
```

API Server 可以先理解成 Kubernetes 集群的办事窗口；控制器是不断核对任务有没有完成的后台程序；调度器负责挑一台合适的机器；节点上的 kubelet 负责照配置启动容器。现在先记住这些工作，不必背组件缩写。

## 为什么 apply 成功，网页仍可能打不开

`kubectl apply` 成功通常只表示配置被集群接受，不等于程序已经准备好。镜像可能正在下载，节点可能没有足够内存，应用也可能启动后连不上数据库。遇到这种情况先查对象状态和事件：

~~~powershell
kubectl -n container-course get pods -o wide
kubectl -n container-course get events --sort-by=.metadata.creationTimestamp
kubectl -n container-course logs deployment/course-api --tail=50
~~~

Pod 还没分到节点，看 Events 中有没有资源不足；Pod 已运行但不 Ready，看应用日志和健康检查；API Server 本身不可访问，则先检查当前集群和网络。排错时先定位“哪一步没有完成”，比一上来重启集群有效。

## 在哪里能看到控制面

kind 在 Docker 容器里模拟节点，课程用户通常不需要直接进控制面容器。云厂商的托管 Kubernetes 也可能不让用户看 API Server 或数据库进程，但 Kubernetes API 仍可以正常工作。记住组件的职责，比去机器里找同名进程更重要。

练习：删除一个 API Pod，再运行 `kubectl -n container-course get deployment,replicaset,pods`。把输出中的对象名称和上面的流程对起来。你看到的状态可能很快变化；如果错过了，就再运行一次查看当前结果。

## 参考资料

- [Kubernetes 集群组件](https://kubernetes.io/docs/concepts/overview/components/)
- [Deployment 控制器](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
