---
title: 第一个 YAML：把 Pod 的每一行写明白
date: '2026-11-24'
summary: 学会 apiVersion、kind、metadata、spec、标签和命名空间，用文件创建并检查一个 Nginx Pod。
series: Docker 与 Kubernetes
order: 27
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-local-cluster
goals:
  - 学会 apiVersion、kind、metadata、spec、标签和命名空间，用文件创建并检查一个 Nginx Pod。
---
上一课用一条命令创建了网页。命令可以试验，但过两周谁还记得当时用了哪个镜像、哪些参数？YAML 把这些设置保存成文件。我们先写一个只有一个容器的 Pod，再用命令检查它。

## YAML 是配置文件，不是另一种脚本

它用缩进表示层级，使用空格，不使用 Tab；`-` 表示列表元素；冒号后通常留一个空格。下面的 `containers` 是列表，虽然只有一个容器，也要写 `- name`。在实验包根目录打开 `basics/pod.yaml`：

~~~yaml file=basics/pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: first-web
  namespace: lab
  labels:
    app: first-web
spec:
  containers:
    - name: nginx
      image: nginx:1.28-alpine
      ports:
        - name: http
          containerPort: 80
~~~

## 这几行分别给谁看

| 字段 | 表达的意思 | 改错会怎样 |
| --- | --- | --- |
| apiVersion | 资源使用的 API 版本，Pod 属于核心组 v1 | 不能把所有资源都写成 apps/v1 |
| kind | 资源种类，此处是 Pod | 大小写不能随便换 |
| metadata.name | 这个 Pod 的名字 | 同一 namespace 中同类资源不能重名 |
| metadata.namespace | 放进 lab | lab 要先存在 |
| labels | 你定义的标签，供选择器查找 | 标签不匹配时 Service 找不到它 |
| spec | 你希望它怎样运行 | 由系统尝试实现 |
| containers[].name | Pod 内部的容器名 | logs、exec 可用它指定容器 |
| containerPort | 声明容器预期监听的端口 | 不会让程序自动监听，也不会在电脑开端口 |

程序有没有监听 80，由 Nginx 自己的配置决定。`status` 是系统记录的观察结果，创建文件里不用自己编 `Running`；写了也不能把一个坏程序变成正常程序。

## 提交前先让 API 检查格式

~~~bash
kubectl config use-context kind-course
kubectl apply --dry-run=server -f basics/pod.yaml
kubectl apply -f basics/pod.yaml
kubectl -n lab wait --for=condition=Ready pod/first-web --timeout=120s
kubectl -n lab get pods -l app=first-web -o wide
~~~

`--dry-run=server` 让 API 做字段和准入检查，但不保存对象，需要连接集群。`apply -f` 中的 f 是文件。`-l` 是标签选择器；如果返回空列表，先比较 YAML 的标签和值。第二次 apply 没改文件，应显示 unchanged。

## 进入容器，确认真正运行的是什么

~~~bash
kubectl -n lab exec first-web -c nginx -- nginx -v
kubectl -n lab exec first-web -c nginx -- cat /usr/share/nginx/html/index.html
kubectl -n lab logs first-web -c nginx --tail=20
kubectl -n lab get pod first-web -o yaml
~~~

`exec` 在已运行的容器内执行命令；`--` 之后是容器命令，不是 kubectl 参数。`logs` 读取标准输出、标准错误，不会自动查所有磁盘日志。最后一条会多出 UID、创建时间、status 等系统字段，别把整段导出结果原样当成日常模板维护。

## 不认识字段时，直接查当前集群

~~~bash
kubectl api-resources --namespaced=true
kubectl explain pod.spec.containers.image
kubectl explain pod.spec.restartPolicy
~~~

`api-resources` 列出服务端支持的资源；`explain` 根据 API 文档解释字段。Pod 默认 `restartPolicy: Always`，容器进程退出后 kubelet 通常会重启容器；但是删除整个独立 Pod 后，没有控制器替你新建 Pod。这两种“重启”必须分开理解。

## 改文件为什么有时提示不允许更新

Pod 的很多字段创建后不能原地修改，例如随意添加普通容器或改变卷配置。为了练习可以删除再创建，但生产服务应交给 Deployment 等控制器，通过更新 Pod 模板替换实例。下一课就做这个动作。

~~~bash
kubectl -n lab delete pod first-web
kubectl apply -f basics/pod.yaml
kubectl -n lab wait --for=condition=Ready pod/first-web --timeout=120s
kubectl -n lab delete pod first-web
~~~

两次创建虽然名字相同，UID 已经不同。最后删除本课 Pod，让下一课从干净状态开始。遇到 YAML 报错先看行号和缩进；遇到 `Forbidden` 再看权限；字段校验失败和权限不足不是同一种问题。

## 继续阅读

- [Pod 概念](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/)
- [对象管理](https://kubernetes.io/zh-cn/docs/concepts/overview/working-with-objects/)
