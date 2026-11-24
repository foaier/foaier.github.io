---
title: Kubernetes 到底管什么：从一台机器到一组机器
date: '2026-11-24'
summary: 分清容器、Pod、节点和集群，理解服务发现、自愈、扩容和滚动更新分别解决什么问题。
series: Docker 与 Kubernetes
order: 25
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - docker-commands
  - docker-network
goals:
  - 分清容器、Pod、节点和集群，理解服务发现、自愈、扩容和滚动更新分别解决什么问题。
---
你已经会用 Docker 启动网页了。现在有三个问题：网页进程退出了谁来重启？服务器坏了放到哪里运行？用户突然变多了怎么加实例？Kubernetes（通常简称 K8s）就是围绕这些问题工作的。

## 先从部署方式说起

直接在服务器安装 Java、数据库和网页服务，起步最省事，但它们会争用同一台机器的资源。虚拟机给每个系统独立的内核和运行环境，隔离边界更完整，代价是每个虚拟机都要运行操作系统。容器共享宿主机内核，用命名空间、资源限制等机制隔开进程，启动和分发更轻便。隔离并不是绝对安全保证：内核漏洞、过大的权限、错误的文件挂载都会破坏边界。

Docker 帮你把一个应用装进镜像、运行成容器。Kubernetes 再往上管一层：把多台机器组成集群，按你写的要求安排容器。两者解决的问题有交集，但并不是把 `docker run` 换个命令那么简单。

## 四个词先记住，后面都会亲手操作

| 名称 | 在实验里是什么 | 容易误会的地方 |
| --- | --- | --- |
| 镜像 Image | 打包好的 Nginx 程序和文件 | 镜像本身没有在运行 |
| Pod | K8s 调度的基本单位，里面运行一个或多个容器 | 一般不是把所有服务塞进一个 Pod |
| 节点 Node | 提供 CPU、内存和网络的机器 | 可以是物理机、虚拟机，本课用 Docker 容器模拟 |
| 集群 Cluster | 控制平面加工作节点 | 本机三个节点仍共用一台电脑，不能抵抗电脑宕机 |

同一个 Pod 里的容器共享网络空间，可以用 `localhost` 通信；不同 Pod 的 `localhost` 指向各自。Pod 会被替换，IP 可能变化，所以应用之间通常用 Service 的名字访问，别把 Pod IP 写死到配置文件。

## K8s 的功能要和实际动作对应起来

| 需求 | 用什么 | 实际行为 |
| --- | --- | --- |
| 一直运行两个网页实例 | Deployment | 实际副本少于期望时创建新 Pod |
| 后端换了地址还能访问 | Service、集群 DNS | 用固定名称找到当前可用后端 |
| 更新程序时少中断 | 滚动更新、就绪探针 | 新实例就绪后逐步替换旧实例 |
| 流量上涨时加实例 | HPA、指标服务 | 根据指标调整副本数，需要事先安装和配置 |
| 数据不随 Pod 删除 | PVC、存储插件 | 把应用数据放到独立卷中 |
| 密码和配置分别管理 | Secret、ConfigMap | 注入环境变量或文件，并配合权限控制 |

这些功能都有条件。没有空闲容量，扩容出来的 Pod 会 Pending；没有可用存储插件，PVC 不会凭空变成磁盘；Deployment 发布失败也不会默认替你自动回滚。

## 它怎样知道你想要什么

你提交“运行两个 Nginx”，控制器持续比较期望状态与实际状态，缺一个就补一个。这叫声明式管理。你不用手工指定每个进程的启动顺序，但必须写对镜像、端口、权限和资源需求。

下面是我们完成下一课环境后会执行的命令。现在先看含义，不用在尚未安装的环境里硬跑：

~~~bash
kubectl -n lab create deployment web --image=nginx:1.28-alpine --replicas=2
kubectl -n lab get pods
~~~

`kubectl` 是客户端；`-n lab` 表示操作名为 lab 的命名空间；`create deployment` 创建管理副本的对象；`--replicas=2` 是期望数量。返回两个 `1/1 Running` 才表示两个容器都已就绪。稍后会改用 YAML 保存这些设置，方便复现和版本管理。

## containerd 和 Docker 又是什么关系

K8s 节点上的 kubelet 通过 CRI 接口调用容器运行时，常见实现是 containerd 和 CRI-O。现代 Kubernetes 不内置旧的 dockershim。用 Docker 构建的标准容器镜像仍然能在 containerd 里运行；“不用 Docker Engine 作为节点运行时”和“不能用 Docker 镜像”是两回事。Podman 也不能直接当成通用的 CRI 运行时替换进去。

## 一个博客需要上 Kubernetes 吗

只有一个静态博客，用 GitHub Pages 就很好；一台机器上的几个服务，Compose 通常更省心。本教程学习 K8s，是为了理解多服务部署和平台运维，并不意味着每个项目都该搬进去。我们先在本机把一个网页完整跑通，再做权限、存储和维护练习，不用先购买服务器。

## 继续阅读

- [Kubernetes 概念](https://kubernetes.io/zh-cn/docs/concepts/)
- [容器运行时](https://kubernetes.io/zh-cn/docs/setup/production-environment/container-runtimes/)
