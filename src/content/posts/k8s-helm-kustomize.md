---
title: "清单多了怎么维护？Helm 和 Kustomize 按问题选"
date: "2026-11-24"
summary: "比较 Chart 模板与环境覆盖，并构造一份可重复的 kind customization。"
series: "Docker 与 Kubernetes"
order: 39
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-autoscaling"]
goals: ["用 Kustomize 构建课程本地清单，说明 Helm 与 Kustomize 的差异。"]
---

开发、测试、生产三份 YAML 手改后，常常一份补了 readiness，另外两份忘了。工具想解决的是重复和环境差异，不是把 YAML 藏进更难懂的语法。

## 概念讲透：它负责什么，不负责什么

Kustomize 通过 base 与 overlay 对现有 YAML 做结构化补丁，通常不需要模板语言；Helm 用 Chart 模板和 values 渲染一组资源，适合可配置的软件打包与版本发布。两者都要先看最终生成的清单。工具不会自动替你理解配置风险，也不会保证不同环境的差异合理。

## 运行过程拆解：从输入到结果

Helm 先按 Chart 模板与 values 渲染清单，release 还带有版本和升级历史；Kustomize 把 base、patch、namePrefix 和环境覆盖合并为一份清单。两者输出都能继续经过 API 校验。对比时问谁维护模板、如何测试升级、环境差异如何审查，而不只看哪种语法更短。先渲染并 diff，能提前发现错误副本数、镜像或 RBAC。

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

## 怎么确认做对了

`kubectl kustomize k8s` 展开为可读对象；应用后 API 与数据库照常工作。Secret 密码没有出现在最终 YAML。

## 案例推演

测试环境和生产环境手工维护两份 YAML，修复只改了测试那份。把共同部分放进 base，用 overlay 明确副本、域名和资源差异；运行 kustomize build 并检查 diff，再提交部署。若安装第三方软件且需要参数化和升级生命周期，评估 Helm Chart；不要同时引入两层模板只为替换一个端口。

## 留一个小练习

在文件末尾临时追加下面这段 patch，再运行 `kubectl kustomize k8s`。输出里 API replicas 应变为 1，数据库不变。这个实验只预览、不 apply；看完移除 patch，再次展开确认恢复为 2。

~~~yaml
patches:
  - target:
      group: apps
      version: v1
      kind: Deployment
      name: course-api
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 1
~~~

## 没跑通时先查什么

找不到资源先核对相对路径。Helm 卸载会影响它管理的对象，卸载前查 PVC 保留策略；values 更新也不表示数据库卷可重建。

文件保存位置：`examples/container-course/k8s/kustomization.yaml`。

先运行构建命令审阅最终清单，能提前发现标签覆盖、namespace 与镜像名称错误。Helm Chart 来源和版本也属于软件供应链，需要评估维护者、values 默认权限与升级记录；装第三方监控栈前，先在空集群检查它会创建哪些高权限对象。

values 文件里可能也有连接口令、镜像仓库 token 等敏感字段，不要因为 Helm 是模板工具就默认这些值安全。发布流水线应限制 values 的来源、存储和输出日志，渲染结果分享前先查一遍明文。

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

## 生产里怎么用、怎么排障

模板变化可能一次渲染出误删、权限过宽或大量滚动更新。CI 中对渲染结果做 schema、安全和策略检查，部署前审阅差异，记录 Chart/清单版本。Secret 不应因模板化就进入明文 Git；环境覆盖要尽量少，避免测试与生产逐渐变成无法比较的两套系统。

## 参考资料

- [Kustomize 使用指南](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
- [Helm 入门](https://helm.sh/docs/intro/using_helm/)
