---
title: 清单多了怎么维护？Helm 和 Kustomize 按问题选
date: '2026-11-24'
summary: 比较 Chart 模板与环境覆盖，并构造一份可重复的 kind customization。
series: Docker 与 Kubernetes
order: 39
tags:
  - Kubernetes 进阶
  - Docker
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-autoscaling
goals:
  - 用 Kustomize 构建课程本地清单，说明 Helm 与 Kustomize 的差异。
---

开发、测试、生产三份 YAML 手改后，常常一份补了 readiness，另外两份忘了。工具想解决的是重复和环境差异，不是把 YAML 藏进更难懂的语法。

## 重复配置和环境差异怎么管理

Kustomize 随 kubectl 提供，用 base、overlay 和 patch 修改现有资源，部署前可展开最终 YAML。Helm 用 Chart 模板与 values 打包应用，release 记录安装和升级状态，第三方软件常用 Chart。二者能一起用，但要先确定最终对象由谁管理。

将示例保存为 `k8s/kustomization.yaml`。它引用 namespace、数据库和 API 清单。Secret 仍由本地命令创建，不把密码放进 Git。

## 用 Kustomize 展开课程清单

先运行 build 展开最终清单，再 apply 到本地 kind。首次前先 build/load API 镜像；前置课程已创建 `course-db` Secret。保存文件后执行 `kubectl kustomize k8s` 预览，再用 `kubectl apply -k k8s` 部署。

~~~yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - 00-namespace.yaml
  - 10-database.yaml
  - 20-api.yaml
images:
  - name: container-course-api
    newName: container-course-api
    newTag: local
~~~

## 先渲染最终 YAML，再看实际差异

第一条只打印合并后的清单；第二条对比当前集群并标出待改字段；第三条让 API Server 校验但不保存。发现错误副本数、镜像或明文秘密时先停下来修。Helm 可用 helm template 和 helm diff 做类似的发布前检查。

~~~powershell
kubectl kustomize k8s
kubectl diff -k k8s
kubectl apply --dry-run=server -k k8s
~~~

## 用 Helm 建立本地 Chart 并看懂 Release

Helm 的 Chart 是模板和默认值；Release 是某个 Chart 在指定 namespace 的一次安装记录；values 覆盖模板输入。Chart.yaml 记录名称、版本和应用版本，values.yaml 放可配置默认值，templates/ 中的模板渲染成 Kubernetes 对象。

确认本机安装了 Helm，kubectl 指向本地 kind-course，而且前面已将 container-course-api:local 载入该集群。先生成一个练习 Chart；lint 检查结构，template 展开最终 YAML。渲染结果才是 API Server 最终要接收的对象。

~~~powershell
helm version
helm create helm-lab-chart
helm lint helm-lab-chart
helm template demo helm-lab-chart --namespace helm-lab --set replicaCount=2
~~~

生成的默认模板包含 Deployment、Service、ServiceAccount 等示例，先逐个看清镜像、权限和可选 Ingress，再决定是否安装。不要把陌生第三方 Chart 直接装进生产集群；先检查模板最终会创建哪些对象。

## 安装、升级、回滚和卸载是一条 Release 生命周期

将练习 Chart 安装到独立 namespace，并把默认 Nginx 镜像改为课程 API 镜像。生成的模板默认 Service 端口是 80；课程应用监听 8080，所以把 Chart 的 service.port 也设为 8080。Release 名称 demo 可以用于后续查询和升级。

~~~powershell
$context = kubectl config current-context
if ($context -ne 'kind-course') { throw "当前 context 是 $context；只在课程 kind-course 安装练习 Chart" }
helm upgrade --install demo helm-lab-chart --namespace helm-lab --create-namespace --set fullnameOverride=helm-lab --set replicaCount=2 --set image.repository=container-course-api --set image.tag=local --set containerPorts.http=8080 --set service.port=8080 --set image.pullPolicy=IfNotPresent
helm status demo --namespace helm-lab
helm history demo --namespace helm-lab
helm upgrade demo helm-lab-chart --namespace helm-lab --set fullnameOverride=helm-lab --set replicaCount=3 --set image.repository=container-course-api --set image.tag=local --set containerPorts.http=8080 --set service.port=8080 --set image.pullPolicy=IfNotPresent
helm history demo --namespace helm-lab
helm rollback demo 1 --namespace helm-lab
kubectl -n helm-lab get deployments,pods,services
~~~

helm rollback 的 revision 号应以自己的 history 输出为准；示例中的 1 假设首次安装是 revision 1。此 Chart 只创建练习 API，没有真实数据库依赖。

~~~powershell
kubectl -n helm-lab port-forward service/helm-lab 8091:8080
~~~

另开终端执行 Invoke-RestMethod http://localhost:8091/。观察成功后回到第一个终端按 Ctrl+C 停止转发；确认 Release 和 namespace 后运行 helm uninstall demo --namespace helm-lab。这个练习没有 PVC，卸载不会删除 container-course 中的数据库。

## Chart 版本、应用版本和镜像版本不是一个数字

Chart version 表示模板包版本，appVersion 是 Chart 元数据中的应用版本说明，image.tag/digest 才决定容器运行的镜像。三者可以不同。生产发布应固定 Chart 版本和镜像内容，并审阅升级渲染差异；只改 tag 不一定触发新 Pod，前提是模板最终字段确实发生变化。

Kustomize 更适合对普通 YAML 做环境差异覆盖；Helm 适合发布带参数和版本历史的应用包。二者可串用，但必须明确只有一套系统负责目标资源，否则 Helm 与 GitOps/Kustomize 可能互相覆盖。

## 参考资料

- [Kustomize 使用指南](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
- [Helm 入门](https://helm.sh/docs/intro/using_helm/)
