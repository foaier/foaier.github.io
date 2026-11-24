---
title: "第一次写 Kubernetes YAML：亲手创建一个 Pod，再把它删掉"
date: "2026-11-24"
summary: "复制一份最小 Pod 配置，运行课程 API，查看它的状态和日志。"
series: "Docker 与 Kubernetes"
order: 21
tags: ["Kubernetes 入门", "Docker"]
level: "Kubernetes 入门"
prerequisites: ["k8s-local-cluster"]
goals: ["创建 Pod，读懂 YAML 的主要字段，并从状态和事件定位问题。"]
---

上一课已经搭好了本地集群，也把 API 镜像交给 kind 节点。这一课只创建一个单独的 Pod，方便认识 Kubernetes 清单的基本样子。Pod 可以先简单理解成 Kubernetes 安排程序运行的“小盒子”；这次只有一个 API 容器。

## 先准备一份清单文件

确认终端还在解压后的 `container-course` 文件夹。用记事本或 VS Code 新建 `pod-demo.yaml`，把下面内容完整复制进去并保存。注意 YAML 的缩进只能用空格，不能用 Tab。

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

每段先知道它的用途：`kind` 说这是 Pod；`metadata` 给它起名并贴标签；`spec` 写要运行的镜像。`containerPort` 是告诉读者程序打算用 8080，不会自动把它开放给电脑访问。

## 先检查 YAML，再创建 Pod

回到同一个终端。先让集群检查文件，不保存对象；确认没有错误后再真正创建：

~~~powershell
kubectl config current-context
kubectl apply --dry-run=server -f .\pod-demo.yaml
kubectl apply -f .\pod-demo.yaml
kubectl -n container-course get pod pod-demo -o wide
~~~

第一条必须显示 `kind-course`。`dry-run` 成功会提示资源已通过服务器检查；创建后状态会从 Pending、ContainerCreating 变成 Running。若迟迟不变，后面有具体检查命令。

## 访问 API 并查看它在运行什么

打开另一个终端窗口，临时把 Pod 的 8080 端口接到本机 8081。保持这条命令运行，在新终端请求存活检查接口：

~~~powershell
kubectl -n container-course port-forward pod/pod-demo 8081:8080
~~~

~~~powershell
Invoke-RestMethod http://localhost:8081/health/live
kubectl -n container-course logs pod-demo
kubectl -n container-course describe pod pod-demo
~~~

接口正常会返回 `alive`。`logs` 看应用写出的日志；`describe` 会显示 Pod 当前状态和集群事件。完成后回到 port-forward 窗口按 Ctrl+C。

## 故意删掉它，看看发生什么

这是直接创建的 Pod，没有其他对象承诺要帮你补回来。删除后它就消失：

~~~powershell
kubectl -n container-course delete -f .\pod-demo.yaml
kubectl -n container-course get pods
~~~

列表里不应再有 `pod-demo`。下一课会让 Deployment 来管理副本，届时删掉一个 Pod，它会再创建一个新的。这就是为什么实际服务通常不直接管理孤零零的 Pod。

## 如果没成功，先看 Events

Pod 卡在 `Pending` 时运行 `kubectl -n container-course describe pod pod-demo`，看最下面 Events；`ImagePullBackOff` 通常表示节点拿不到指定镜像，本课程要先执行上一课的 `kind load docker-image`。若提示 namespace 不存在，重新执行 `kubectl apply -f k8s/00-namespace.yaml`。如果 YAML 解析失败，检查缩进、冒号和文件是否误存成 `pod-demo.yaml.txt`。

练习：把文件里的容器名 `api` 改成 `web` 再创建一次，观察 Pod 名字仍是 `pod-demo`。对象名和容器名是两个不同字段。完成后删掉 Pod，避免课程里留下孤立资源。

## 参考资料

- [Pod 是什么](https://kubernetes.io/docs/concepts/workloads/pods/)
- [创建 Pod 的任务说明](https://kubernetes.io/docs/tasks/run-application/run-single-instance-stateful-application/)
