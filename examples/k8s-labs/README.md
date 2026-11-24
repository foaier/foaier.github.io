# Kubernetes 分课实验

按博客 `/containers/` 的 Kubernetes 路线使用。终端统一为 Bash：Windows 使用 WSL Ubuntu，macOS/Linux 使用本机终端。不要把 Bash 命令直接粘贴到 PowerShell。

## 起步

Docker 引擎必须运行。安装 kind v0.31.0、kubectl v1.35.0，进入本目录，然后执行：

```bash
kind create cluster --name course --image kindest/node:v1.35.0 --config kind.yaml --wait 180s
kubectl config use-context kind-course
kubectl create namespace lab --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f basics/deployment.yaml -f basics/service.yaml
kubectl -n lab rollout status deployment/web --timeout=120s
kubectl -n lab port-forward service/web 8080:80
```

另开终端访问 `http://127.0.0.1:8080`。已有 course 集群时跳过创建；调度课需要两个 worker。kind 自带 standard 存储类，不另装 local-path 插件。

## 文件对应

| 目录 | 对应练习 | 先读什么 |
| --- | --- | --- |
| basics | Pod、Deployment、生命周期、Service | 本地集群与 YAML |
| config | 环境变量、挂载配置、Downward API | 先按文章创建 settings 和 demo-secret |
| health | 三种探针的行为 | Service、配置 |
| resources | Pending、OOM、配额 | 文件包含故意失败的实验 |
| storage | PVC、StatefulSet | standard StorageClass |
| workloads | DaemonSet、Job、CronJob | 独立控制器及清理 |
| scheduling | 节点标签和定向调度 | 先给 course-worker 加 disk=fast |
| security | RBAC、Restricted | secure-lab 由文章创建并加准入标签 |
| packaging | Kustomize base/overlay | Helm 安装在对应文章 |
| gateway | Traefik values、Ingress、Gateway 路由 | 先安装 Gateway API CRD 与控制器 |
| network | Calico 专用集群与策略 | 使用 course-net，完成后切回 course |
| monitoring | Prometheus values 与测试告警 | 先装 Metrics Server、监控 Chart |
| autoscaling | HPA 与 CPU 演示应用 | Metrics Server 必须有指标 |
| logging | Loki 与 Alloy values | Helm；只采集 lab 的日志 |
| registry | 本地 Harbor values | Helm；不持久化，不提供生产入口 |
| audit | API 审计策略 | 文章创建专用 course-audit 集群 |
| extensions | Note CRD 与实例 | 先注册 CRD，再创建对象 |
| gitops | Argo CD Application | 先安装 Argo CD |

不要对整个目录执行递归 apply。这里既有集群配置、Helm values，也有故意失败的 Pod 和需要先安装 CRD 的对象。每课给出了准确的创建、观察、恢复与清理顺序。

## 版本和实验边界

基础环境为 kind 0.31.0 / Kubernetes 1.35.0。插件按文章固定版本安装，目的是复现实验；部署正式环境前按受支持版本和安全补丁重新评估。容器镜像的版本标签也可能变动，正式发布应记录 digest。

主集群：kind-course；网络策略：kind-course-net；审计：kind-course-audit。每次新开终端先看 `kubectl config current-context`。本文的备份、资源限制、权限与网络故障都只用于自己的学习环境。

Harbor、Grafana 的密码是公开的本地教学值；不暴露公网。不要把真实 Token、kubeconfig、etcd 快照和数据库备份放进源码。backups、scratch 和调试输出不会进入课程 ZIP。

源码与文章可以静态解析、渲染，但实际集群实验仍需要 Docker 引擎、足够内存和能访问镜像/Chart 仓库的网络。运行结果以每课的验证步骤为准。

## 综合项目

基础课不依赖 .NET 或数据库。最终的留言 API + PostgreSQL 位于单独的 `container-course.zip`，进入该目录后按综合课操作。

## 完成全部实验后

按各课说明清理专用对象与插件；确认持久数据和备份不再需要，才执行 `kind delete cluster --name course`。该命令会删除主练习集群及节点本地数据。
