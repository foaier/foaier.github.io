---
title: GitOps：让集群跟着 Git 走，而不是记住谁敲过命令
date: '2026-11-24'
summary: 安装 Argo CD，同步一个固定版本的公开示例，制造副本漂移并观察自动修复，再解释真实发布流程。
series: Docker 与 Kubernetes
order: 54
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-helm-kustomize
  - k8s-rollouts
  - k8s-private-registry
goals:
  - 安装 Argo CD，同步一个固定版本的公开示例，制造副本漂移并观察自动修复，再解释真实发布流程。
---
人手执行 kubectl 很适合学习，但多人管理时很难回答“现在集群到底对应哪次改动”。GitOps 把期望配置放进 Git，由控制器持续比较 Git 与集群状态。Git 记录发布意图，控制器负责把意图同步到集群。

## CI 和 GitOps 控制器各做什么

CI 编译、测试、扫描并推镜像；部署仓库记录目标镜像版本和 YAML；Argo CD 拉取配置并同步。Argo CD 不会因为应用源码变了就自动替你构建镜像，镜像更新也需要配置中实际出现新 tag 或 digest。

本课使用固定提交的公开示例完成无凭证实验，不需要先把自己的仓库访问令牌交给集群。它只是一个演示网页，不能作为生产镜像选型。

## 安装 Argo CD，只在本机访问

在 kind-course 执行，预留足够内存；先卸载前面的 Harbor、监控等重型组件。

~~~bash
kubectl config use-context kind-course
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply --server-side --force-conflicts -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/v3.2.0/manifests/install.yaml
kubectl -n argocd rollout status deployment/argocd-server --timeout=300s
kubectl -n argocd rollout status deployment/argocd-repo-server --timeout=300s
kubectl -n argocd rollout status statefulset/argocd-application-controller --timeout=300s
kubectl -n argocd port-forward service/argocd-server 8444:443
~~~

浏览器打开 `https://127.0.0.1:8444`。这是本地自签名证书的管理界面；不要把端口转发监听改为 0.0.0.0 向公网开放。初次安装的 admin 密码在专用 Secret 中，另开终端读取，仅在自己电脑使用：

~~~bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode
printf '\n'
~~~

server-side apply 用于大型 CRD；force-conflicts 只针对这里的全新学习安装，不要把它当成接管别人生产字段的常用手段。

## 声明 Git 仓库、路径、版本和目标位置

文件 `gitops/application.yaml` 指向固定提交，避免示例默认分支变化影响这次实验：

~~~yaml file=gitops/application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: lesson-guestbook
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: 8088f4c0d970abb09e250248cc97e35623447cb5
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: gitops-lab
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
~~~

~~~bash
kubectl apply -f gitops/application.yaml
kubectl -n argocd get application lesson-guestbook
kubectl -n argocd patch application lesson-guestbook --type=merge -p '{"operation":{"sync":{"prune":false}}}'
kubectl -n argocd wait --for=jsonpath='{.status.sync.status}'=Synced application/lesson-guestbook --timeout=300s
kubectl -n argocd wait --for=jsonpath='{.status.health.status}'=Healthy application/lesson-guestbook --timeout=300s
kubectl -n gitops-lab get deployments,services,pods
~~~

Application 是 Argo CD 提供的 CRD。Synced 表示期望配置已同步，Healthy 表示控制器判断资源健康，两者都不替代业务请求测试。若 ComparisonError，先看 repo-server 的仓库网络访问；ImagePullBackOff 则查示例镜像拉取，不把两者混为 Git 同步故障。

## 访问网页，再制造配置漂移

~~~bash
kubectl -n gitops-lab port-forward service/guestbook-ui 8089:80
~~~

浏览器打开 `http://127.0.0.1:8089`，或另终端 `curl -I http://127.0.0.1:8089`。随后 Ctrl+C 停止这个转发，启用自动同步和自动修复，再把副本临时改为 3：

~~~bash
kubectl -n argocd patch application lesson-guestbook --type=merge -p '{"spec":{"syncPolicy":{"automated":{"prune":false,"selfHeal":true}}}}'
kubectl -n gitops-lab scale deployment guestbook-ui --replicas=3
kubectl -n gitops-lab get deployment guestbook-ui -w
~~~

等待控制器检测差异，副本会回到 Git 文件定义的数量。按 Ctrl+C 退出观察。紧急手改后“怎么又变回去了”往往就是 selfHeal；真实修复应提交配置变更，或有意识地暂停同步并记录临时处理。

## prune 为什么单独关闭

selfHeal 修复漂移，prune 允许删除 Git 中已移除的资源。后者可能影响数据和服务，所以本课先关闭，用实际理解再决定是否开启。数据库 PVC、namespace、CRD 的删除策略不能只靠一个全局开关决定。

正式项目要建立受限 AppProject，约束可读仓库、目标集群、namespace 和资源种类；默认 project 适合本机体验，不适合把所有团队放在一起。私有仓库凭证、生产审批、镜像 digest、回滚和审计也需单独配置。

## 清理时保留谁来删除资源的明确责任

本课 Application 没设置级联删除 finalizer，先删 Application 停止管理，再明确删除专用 namespace。不要把这套行为推断成所有 Argo CD 应用都一样。

~~~bash
kubectl -n argocd delete application lesson-guestbook
kubectl delete namespace gitops-lab
kubectl delete namespace argocd
~~~

最后停止管理界面的转发终端。共享 CRD 可以保留到最终删 kind 集群时清理。下一次正式发布的核心仍是：构建可追溯镜像、修改期望版本、审核、同步、验证业务，而不是在界面上点一次绿色按钮就结束。

## 继续阅读

- [Argo CD 入门](https://argo-cd.readthedocs.io/en/stable/getting_started/)
- [自动同步与自动修复](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/)
