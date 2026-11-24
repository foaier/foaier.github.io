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


## 生产里怎么用、怎么排障

模板变化可能一次渲染出误删、权限过宽或大量滚动更新。CI 中对渲染结果做 schema、安全和策略检查，部署前审阅差异，记录 Chart/清单版本。Secret 不应因模板化就进入明文 Git；环境覆盖要尽量少，避免测试与生产逐渐变成无法比较的两套系统。

## 参考资料

- [Kustomize 使用指南](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
- [Helm 入门](https://helm.sh/docs/intro/using_helm/)
