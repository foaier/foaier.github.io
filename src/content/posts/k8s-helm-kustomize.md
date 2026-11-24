---
title: YAML 越来越多怎么办：先 Kustomize，再 Helm
date: '2026-11-24'
summary: 给同一个网页生成两套环境配置，再创建自己的 Helm Chart，完成安装、升级、回滚和卸载。
series: Docker 与 Kubernetes
order: 39
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-rollouts
goals:
  - 给同一个网页生成两套环境配置，再创建自己的 Helm Chart，完成安装、升级、回滚和卸载。
---
复制一份测试 YAML 再改成生产 YAML，很容易漏改镜像或副本数。Kustomize 适合在基础配置上打补丁，Helm 适合用模板和 values 打包一组资源。两者都不替你判断业务配置正确与否，提交前要看最终生成的清单。

## Kustomize：保留基础文件，只写差异

下载包包含以下三个文件。复制基础 Deployment 到一个不含 namespace 的独立目录，避免把 lab 写死在模板里：

~~~yaml file=packaging/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: packaged-web
spec:
  replicas: 1
  selector:
    matchLabels: {app: packaged-web}
  template:
    metadata:
      labels: {app: packaged-web}
    spec:
      containers:
        - name: nginx
          image: nginx:1.28-alpine
~~~

~~~yaml file=packaging/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
~~~

~~~yaml file=packaging/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: package-lab
resources:
  - ../base
replicas:
  - name: packaged-web
    count: 2
~~~

~~~bash
kubectl create namespace package-lab --dry-run=client -o yaml | kubectl apply -f -
kubectl kustomize packaging/dev
kubectl apply -k packaging/dev
kubectl -n package-lab rollout status deployment/packaged-web --timeout=120s
~~~

`kubectl kustomize` 只渲染；`apply -k` 渲染后提交。输出应有 namespace package-lab、replicas 2。可以再建 prod 目录修改 replicas 和镜像标签，但不要让两个 overlay 同时管理同一 namespace 同名对象。

## 安装 Helm，弄清 Chart、Release、Values

Chart 是模板包；Release 是某次安装在集群里的实例；values 是传给模板的参数。同一 Chart 可以安装多份，但名称、资源和端口不能互相冲突。以下命令在前面同一个 Bash 环境中执行：

~~~bash
case "$(uname -s)" in Linux) lab_os=linux ;; Darwin) lab_os=darwin ;; esac
case "$(uname -m)" in x86_64) lab_arch=amd64 ;; arm64|aarch64) lab_arch=arm64 ;; esac
lab_tmp=$(mktemp -d)
curl -fL --retry 3 "https://get.helm.sh/helm-v3.19.0-${lab_os}-${lab_arch}.tar.gz" -o "$lab_tmp/helm.tgz"
tar -xzf "$lab_tmp/helm.tgz" -C "$lab_tmp"
mkdir -p "$HOME/.local/bin"
install -m 755 "$lab_tmp/${lab_os}-${lab_arch}/helm" "$HOME/.local/bin/helm"
export PATH="$HOME/.local/bin:$PATH"
helm version --short
~~~

后面的入口和监控实验都会用 Helm。下载内容位于系统临时目录，先保留它，不需要复制到博客仓库。

## 从自己的 Chart 开始，不先堆第三方配置

~~~bash
mkdir -p scratch
helm create scratch/web-chart
helm lint scratch/web-chart
helm template study scratch/web-chart --namespace package-lab --set replicaCount=2
helm upgrade --install study scratch/web-chart --namespace package-lab --set replicaCount=2 --wait --timeout 3m
helm list -n package-lab
kubectl -n package-lab get deployments,services
~~~

`helm create` 生成一套 Nginx 示例 Chart，templates 放模板、values.yaml 放默认参数、Chart.yaml 记录包版本。`template` 输出最终 YAML，不部署。`upgrade --install` 表示存在就升级，不存在就安装；`--wait` 等待适用资源就绪，而不是完整业务测试。

## 升级、记录和回退

~~~bash
helm upgrade study scratch/web-chart -n package-lab --set replicaCount=3 --wait --timeout 3m
helm history study -n package-lab
helm rollback study 1 -n package-lab --wait --timeout 3m
helm get values study -n package-lab
~~~

这个全新 release 的 revision 1 是本课第一次安装的两副本版本；已有 release 必须先查 history，不能照抄 1。Helm 回滚恢复发布的资源配置，不会逆转数据库迁移，也不保证清理所有钩子创建的外部副作用。

## 下载第三方 Chart 要检查什么

先查看 values、渲染结果、所用镜像、权限和持久卷。固定 Chart 版本与镜像版本，升级时读变更说明。Secret 放 values 里仍可能进入 Helm release 记录；不要把真实凭证写入公开 values 或 Git。Kustomize 和 Helm 都不是秘密管理系统。

~~~bash
helm uninstall study -n package-lab
kubectl delete -k packaging/dev
kubectl delete namespace package-lab
~~~

Helm 卸载后 CRD、某些 PVC 或标记保留的对象可能仍在，需要按组件自己的数据生命周期处理。清理当前课程的命名空间，不去删除全局 CRD 来“确保干净”。

## 继续阅读

- [Kustomize 管理对象](https://kubernetes.io/zh-cn/docs/tasks/manage-kubernetes-objects/kustomization/)
- [Helm 使用指南](https://helm.sh/docs/intro/using_helm/)
