---
title: "在自己电脑上搭 Kubernetes 练习环境：用 kind 建一个集群"
date: "2026-11-24"
summary: "安装 kubectl 和 kind，在本机建集群并启动课程 API，所有命令只对练习集群操作。"
series: "Docker 与 Kubernetes"
order: 20
tags: ["Kubernetes 入门", "Docker"]
level: "Kubernetes 入门"
prerequisites: ["k8s-why-runtime"]
goals: ["在本机创建 kind 集群、部署课程示例并访问健康检查接口。"]
---

接下来开始动手。我们用 kind 在 Docker 里创建一套本地 Kubernetes 练习环境，不需要租云服务器。请只在自己的电脑上照着做；后面的命令会部署课程 API 和数据库，不要把它们复制到公司或云端集群。

## 先装两个命令行工具

Docker Desktop（或 Linux 上的 Docker Engine）必须已启动。Windows PowerShell 可以用 winget 安装 kind 和 kubectl；安装完成后关掉这个终端，再开一个新的终端，让系统重新读取命令路径。

~~~powershell
winget install -e --id Kubernetes.kind
winget install -e --id Kubernetes.kubectl
kind version
kubectl version --client
~~~

macOS 若已安装 Homebrew，可运行 `brew install kind kubectl`。Linux、没有 winget/Homebrew 的电脑，请按 kind 和 Kubernetes 官方安装页选择自己的系统与 CPU 架构。先确认 `kind version` 和 `kubectl version --client` 都能显示版本，再继续。

## 创建集群前先确认 Docker 可用

~~~powershell
docker version
kind get clusters
kubectl config get-contexts
~~~

`docker version` 应同时显示 Client 和 Server。如果列表里已经有名为 `course` 的 kind 集群，就跳过创建命令；不要重复创建，也不要删除不认识的集群。创建后切换到练习集群，并确认节点状态为 Ready：

~~~powershell
kind create cluster --name course
kubectl config use-context kind-course
kubectl get nodes
~~~

若创建时提示集群已经存在，就执行 `kubectl config use-context kind-course` 和 `kubectl get nodes`，不必重建。后续破坏性操作前都运行 `kubectl config current-context`；结果必须是 `kind-course`。

## 下载课程文件并启动 API 和数据库

先[下载课程示例](/downloads/container-course.zip)并解压。用文件管理器打开 `container-course` 文件夹，在该文件夹打开终端。运行 `Get-ChildItem Dockerfile, compose.yaml, k8s`，应能看到这些文件；如果提示找不到文件，说明终端开错目录。

Compose 如仍在占用本机 8080 端口，请在这个目录执行 `docker compose down`。这会停止课程容器，但不删除数据库卷；不要加 `-v`。接着构建 API 镜像，并把镜像复制到 kind 节点：kind 节点有自己的镜像存储，只在电脑上执行 docker build 还不够。

~~~powershell
docker build -t container-course-api:local .
kind load docker-image container-course-api:local --name course
kubectl apply -f k8s/00-namespace.yaml
kubectl -n container-course create secret generic course-db --from-literal=password=course-local-only
~~~

密码 `course-local-only` 只用于本地教学。若命令提示 Secret 已存在，说明之前创建过，直接继续；不要把真实密码写进命令或文章。kind 练习需要一个简单的本机存储插件，下一条安装 Rancher 的 local-path provisioner，等它启动后再部署数据库：

~~~powershell
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.31/deploy/local-path-storage.yaml
kubectl -n local-path-storage rollout status deployment/local-path-provisioner --timeout=120s
kubectl get storageclass
kubectl apply -k k8s
kubectl -n container-course rollout status deployment/postgres --timeout=180s
kubectl -n container-course rollout status deployment/course-api --timeout=180s
~~~

`kubectl apply -k k8s` 会读取课程目录里的清单，创建 API、PostgreSQL 和它们需要的配置。命令最后显示 successfully rolled out 才算服务就绪；第一次下载镜像可能要等几分钟。

## 从浏览器确认服务真的能用

在当前终端启动本机转发，这条命令会一直运行。再打开一个新的终端窗口发送请求：

~~~powershell
kubectl -n container-course port-forward service/course-api 8080:80
~~~

~~~powershell
Invoke-RestMethod http://localhost:8080/health/ready
~~~

正常应返回表示 API 与数据库已连接的 JSON。若 8080 被占用，把转发命令改为 `8081:80`，然后访问 `http://localhost:8081/health/ready`。结束实验时在运行 port-forward 的终端按 Ctrl+C；先保留集群，后续章节要继续使用。整个课程最后再学安全清理。

## 卡住时先看这一层

- `Cannot connect to Docker daemon`：先启动 Docker Desktop/Engine，再试 `docker version`。
- `kind load` 找不到镜像：确认刚才的 build 成功，并且镜像名完整是 `container-course-api:local`。
- Pod 出现 `ImagePullBackOff`：检查 kind context、镜像名称，再运行一次 `kind load docker-image ... --name course`。
- PVC 一直 Pending：检查 `local-path-storage` 部署是否 Ready，以及 `kubectl get storageclass` 是否有 `local-path`。
- API 没 Ready：先看 `kubectl -n container-course get pods` 和 `kubectl -n container-course logs deployment/course-api`，确认数据库已 Ready。

## 参考资料

- [kind 快速开始](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [安装 kubectl](https://kubernetes.io/docs/tasks/tools/)
- [local-path-provisioner](https://github.com/rancher/local-path-provisioner)
