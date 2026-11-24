---
title: "用 kind 搭一个本地集群：先在自己的电脑上把第一条链路跑通"
date: "2026-11-24"
summary: "安装 kind 和 kubectl，载入本地 API 镜像，再部署 API 与 PostgreSQL。"
series: "Docker 与 Kubernetes"
order: 21
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-architecture"]
goals: ["在 kind-course 上启动课程环境，并从本机访问就绪接口。"]
---

刚学 Kubernetes，先不用租云服务器。kind 会把节点放在 Docker 容器里，一台电脑就能练部署、服务发现和重启恢复。它适合学习与 CI；把笔记本盖上就停的集群，当然不是生产高可用方案。

## 概念讲透：它负责什么，不负责什么

kind 用容器模拟 Kubernetes 节点，适合练习 YAML、控制器、服务发现和发布流程；节点容器内部仍有自己的集群配置。它不是云集群的缩小复制：负载均衡、云盘、真实节点故障、生产证书和网络性能可能都不同。kubectl context 决定命令发往哪里，每次破坏性实验前都要确认当前上下文。

## 运行过程拆解：从输入到结果

本地链路由几份状态组成：kubectl context 选集群，kind 集群提供 API Server 和节点容器，镜像需出现在节点可访问的仓库或被手工加载，清单声明目标 namespace 与工作负载。哪一项对不上，都会出现“本机明明有镜像”或“apply 成功却找不到 Pod”。每次实验前后都核对 context、namespace、镜像名和实际节点。

## 准备工具与同一份课程源码

需要 Docker 已能运行 Linux 容器、kind、kubectl。Windows x64 可按 kind 官方 Quick Start 下载可执行文件并加入 PATH；macOS/Linux 选择对应架构安装。Docker Desktop 给足几 GB 可用内存，避免节点和数据库挤在一起。kubectl 与服务端版本按官方兼容范围配套，通常只支持相邻一个次版本。

先[下载课程源码](/downloads/container-course.zip)并解压，所有相对路径都以解压后的 `container-course` 目录为准。终端示例使用 PowerShell；浏览器调用用 Invoke-RestMethod，macOS/Linux 可用 curl 访问相同地址。先停掉前面的 Compose 环境以腾出 8080：`docker compose down`，不加 -v。

## 创建本地集群并部署服务

创建名为 course 的独立集群，再切到 kind-course。不要朝已有云端或公司集群运行课程命令。下面先构建 API 镜像，载入节点，再创建 namespace、课程用 Secret、数据库和 API。Secret 命令只需第一次创建时执行。数据库先等 rollout 完成，方便新手缩小故障范围。

~~~powershell
kind create cluster --name course
kubectl config use-context kind-course
kubectl get nodes
docker build -t container-course-api:local .
kind load docker-image container-course-api:local --name course
kubectl apply -f k8s/00-namespace.yaml
kubectl -n container-course create secret generic course-db --from-literal=password=course-local-only
kubectl apply -f k8s/10-database.yaml
kubectl -n container-course rollout status deployment/postgres --timeout=180s
kubectl apply -f k8s/20-api.yaml
kubectl -n container-course rollout status deployment/course-api --timeout=180s
kubectl -n container-course port-forward service/course-api 8080:80
~~~

## 怎么确认做对了

nodes 应是 Ready；数据库一个 Pod，API 两个 Pod，READY 列都完整。最后一条命令保持运行，另开终端请求 `Invoke-RestMethod http://localhost:8080/health/ready`，应见 ready 与 connected。port-forward 是本机调试通道，默认只绑定回环地址，不是正式对外入口。

## 案例推演

镜像在本机 docker images 能看到，kind Pod 仍报 ImagePullBackOff。宿主机 Docker 镜像存储与 kind 节点的镜像存储不是同一处；要用 kind load docker-image 把镜像送入目标集群，或者推到节点可访问的仓库。随后核对镜像名、tag、pull policy 和 context，避免去错误集群找问题。

## 留一个小练习

另开终端执行 `kubectl -n container-course get pods -o wide`，看看 Pod 分配到了哪台节点。在浏览器访问根路径的 JSON，记下 host。两个 API 副本共用数据库，但此刻 port-forward 不适合用来演示每次请求均匀分发。

## 没跑通时先查什么

ImagePullBackOff 先查本地镜像是否准确命名并 load 到 course；kind 节点不会自动共享宿主机镜像库。PVC Pending 查 StorageClass。8080 被占用时停 Compose 或改为 `8081:80`。重建集群会丢掉该集群状态，没做完课程先别执行 delete cluster。

## 生产里怎么用、怎么排障

本地实验容易把公网集群的资源误删，建议使用专用 namespace、清晰 context 名和脚本里的显式 namespace。kind 节点共享本机 CPU 和内存，Pending 可能是电脑资源不足，不代表生产集群容量配置正确。云上验证还要单独检查云负载均衡、CSI 存储、证书、权限和节点网络。

## 参考资料

- [kind Quick Start](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [安装 kubectl](https://kubernetes.io/docs/tasks/tools/)
