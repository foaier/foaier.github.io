---
title: 安装 kubectl 和 kind：先让一个网页跑起来
date: '2026-11-24'
summary: 在 Bash 中建立三节点本地集群，认识 context 和 namespace，并从浏览器访问第一个 Pod。
series: Docker 与 Kubernetes
order: 26
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-why-runtime
goals:
  - 在 Bash 中建立三节点本地集群，认识 context 和 namespace，并从浏览器访问第一个 Pod。
---
这一课只做一件事：在自己的电脑里建集群，打开 Nginx 默认网页。暂时不部署数据库，也不用写业务代码。

## 终端、内存和工具先对齐

整套教程使用 **Bash**。Windows 打开 WSL 2 的 Ubuntu 终端，并在 Docker Desktop 中开启这个 Ubuntu 的 WSL Integration。不要把 Bash 的反斜杠换行、`$(...)` 和 heredoc 命令粘到 PowerShell。macOS 用终端；Linux 用 Bash。

建议给 Docker 至少 4 核、8 GiB 内存；后面的监控和仓库实验需要更多内存，可以做完一个再卸载。执行：

~~~bash
docker version
uname -s
uname -m
~~~

`docker version` 必须同时出现 Client 和 Server。只有 Client 就先启动 Docker Desktop，或在 Linux 检查 `sudo systemctl status docker`。`uname -s` 在 WSL/Linux 返回 Linux，在 macOS 返回 Darwin。以下安装命令支持这两类系统的 x86_64 和 arm64/aarch64。

~~~bash
case "$(uname -s)" in
  Linux) lab_os=linux ;;
  Darwin) lab_os=darwin ;;
  *) echo '请使用 Linux、WSL Ubuntu 或 macOS 终端'; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64) lab_arch=amd64 ;;
  aarch64|arm64) lab_arch=arm64 ;;
  *) echo '当前 CPU 架构不在本教程安装范围'; exit 1 ;;
esac
mkdir -p "$HOME/.local/bin"
curl -fL --retry 3 "https://kind.sigs.k8s.io/dl/v0.31.0/kind-${lab_os}-${lab_arch}" -o "$HOME/.local/bin/kind"
curl -fL --retry 3 "https://dl.k8s.io/release/v1.35.0/bin/${lab_os}/${lab_arch}/kubectl" -o "$HOME/.local/bin/kubectl"
chmod +x "$HOME/.local/bin/kind" "$HOME/.local/bin/kubectl"
export PATH="$HOME/.local/bin:$PATH"
kind version
kubectl version --client
~~~

这里固定版本是为了统一练习环境，不表示生产环境永远停在这个补丁版本。新终端找不到命令时，再运行上面的 `export PATH=...`，或把它加入自己的 shell 配置。下载失败时先看网络和代理，不要把错误页面保存成可执行文件；`curl -f` 会让 HTTP 错误直接失败。

## 下载文件，再创建三节点集群

[下载 K8s 实验包](/downloads/k8s-labs.zip)，解压后进入 `k8s-labs` 文件夹。后文的相对路径都以这里为起点。运行 `ls kind.yaml` 能看到文件，才说明位置正确。配置如下，下载包已经包含，不必重复创建：

~~~yaml file=kind.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
~~~

~~~bash
kind get clusters
kind create cluster --name course --image kindest/node:v1.35.0 --config kind.yaml --wait 180s
kubectl config use-context kind-course
kubectl get nodes -o wide
~~~

若已有自己的 `course` 练习集群，跳过创建；旧的单节点集群能完成基础课，调度和节点维护实验需要两个 worker。不要为了重建而直接删有数据的旧集群，先导出需要的数据。新建完成应看到 `course-control-plane`、`course-worker`、`course-worker2` 三行 Ready。

`kind create` 在 Docker 中启动节点容器，节点里面再由 containerd 运行 Pod。第一次要下载较大的节点镜像。卡住时用 `docker ps`、`kind export logs ./kind-logs --name course` 看创建过程，不要只反复重试命令。

## context 和 namespace 怎么用

context 记录“连哪个集群、用哪个身份、默认哪个命名空间”。namespace 是集群里的逻辑分区，不是另一套集群，也不会自动隔断网络。每次新开终端先检查集群；本教程命令明确写 `-n lab`，避免修改默认 namespace 后自己忘了。

~~~bash
kubectl config current-context
kubectl create namespace lab --dry-run=client -o yaml | kubectl apply -f -
kubectl get namespaces
~~~

第一条必须是 `kind-course`。`--dry-run=client -o yaml` 只生成 YAML；管道右侧 `apply -f -` 从标准输入读入并提交，所以重复执行不会因为 namespace 已存在而报错。

## 启动 Nginx，再把端口转到电脑

~~~bash
kubectl -n lab run hello --image=nginx:1.28-alpine --restart=Never
kubectl -n lab wait --for=condition=Ready pod/hello --timeout=120s
kubectl -n lab get pod hello -o wide
kubectl -n lab port-forward pod/hello 8080:80
~~~

`--restart=Never` 这里创建独立 Pod；`wait` 等就绪；`-o wide` 多显示 IP 和节点；`8080:80` 表示电脑 8080 转发到 Pod 80。最后一条会一直占着终端，看到 `Forwarding from 127.0.0.1:8080 -> 80` 后，保持它运行。

另开终端：

~~~bash
curl -I http://127.0.0.1:8080
~~~

应返回 `HTTP/1.1 200 OK`，浏览器打开同一地址能看到 Nginx 欢迎页。电脑 8080 已占用时改为 `8081:80`，访问地址也改 8081。端口转发只是临时调试通道，关掉终端就断开，不是正式对外发布方式。

## 页面打不开，按结果往下查

~~~bash
kubectl -n lab describe pod hello
kubectl -n lab logs hello
kubectl -n lab get events --sort-by=.metadata.creationTimestamp
~~~

`ImagePullBackOff` 看 describe 最下面 Events，检查镜像名、网络、仓库限流；`Pending` 看节点是否 Ready、资源是否够；Pod 正常但电脑连接失败，先看转发命令是否还在运行。还没有学到 Service，所以这里不用查负载均衡器。

## 收尾，保留后续要用的集群

在转发终端按 Ctrl+C，另一个终端删除这一课的独立 Pod：

~~~bash
kubectl -n lab delete pod hello
kubectl -n lab get pods
kubectl get storageclass
~~~

lab 中没有资源是正常的。最后一条应看到 kind 自带的 `standard (default)` 存储类。kind 已有本地动态存储插件，不需要再装第二份 local-path-provisioner。后面会解释存储类、PVC 和数据保留的关系。先保留集群，不要运行删除集群的命令。

## 继续阅读

- [kind 使用说明](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [kubectl 配置集群访问](https://kubernetes.io/zh-cn/docs/tasks/access-application-cluster/configure-access-multiple-clusters/)
