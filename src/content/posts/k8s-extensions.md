---
title: CRD 和 Operator：为什么安装插件会多出新资源
date: '2026-11-24'
summary: 创建一个自己的资源类型，验证字段约束，再区分 CRD、控制器和 Operator 实际负责的工作。
series: Docker 与 Kubernetes
order: 51
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-helm-kustomize
  - k8s-audit
goals:
  - 创建一个自己的资源类型，验证字段约束，再区分 CRD、控制器和 Operator 实际负责的工作。
---
安装 Prometheus Operator 后可以创建 PrometheusRule，安装 Gateway API 后可以创建 HTTPRoute。这些不是 kubectl 自带的固定命令集合，而是集群 API 增加了资源类型。CRD 就是注册这类自定义资源的一种机制。

## 类型、对象和控制器别混在一起

CRD 定义资源长什么样、属于哪个 API 组、是否分 namespace、字段如何校验；自定义资源是具体一条对象；控制器观察对象并执行动作。只有 CRD，没有控制器，你创建一个“数据库对象”也不会自动启动数据库。

Operator 通常把某种应用的运维知识写进控制器，例如建集群、备份、升级、故障恢复。Helm 则主要渲染与发布资源模板，二者可以配合，并不互相取代。

## 给集群加一个 Note 类型

本课只存一条学习笔记，不冒充数据库 Operator。文件 `extensions/note-crd.yaml`：

~~~yaml file=extensions/note-crd.yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: notes.learning.foaier.local
spec:
  group: learning.foaier.local
  scope: Namespaced
  names:
    plural: notes
    singular: note
    kind: Note
    shortNames: [lnote]
  versions:
    - name: v1alpha1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required: [title, priority]
              properties:
                title:
                  type: string
                  minLength: 1
                priority:
                  type: integer
                  minimum: 1
                  maximum: 3
      additionalPrinterColumns:
        - name: Title
          type: string
          jsonPath: .spec.title
        - name: Priority
          type: integer
          jsonPath: .spec.priority
~~~

~~~bash
kubectl config use-context kind-course
kubectl apply -f extensions/note-crd.yaml
kubectl wait --for=condition=Established crd/notes.learning.foaier.local --timeout=60s
kubectl api-resources --api-group=learning.foaier.local
kubectl explain note.spec.priority
~~~

group 和 version 构成 `learning.foaier.local/v1alpha1`；scope 表示对象位于 namespace。storage 标记存储版本，并不是要求创建一个存储卷；一个 CRD 只能有一个 storage=true 的版本。

## 创建一条对象，像内置资源一样查询

~~~yaml file=extensions/note.yaml
apiVersion: learning.foaier.local/v1alpha1
kind: Note
metadata:
  name: first-note
  namespace: lab
spec:
  title: 学会检查 EndpointSlice
  priority: 2
~~~

~~~bash
kubectl apply -f extensions/note.yaml
kubectl -n lab get notes
kubectl -n lab get note first-note -o yaml
kubectl -n lab patch note first-note --type=merge -p '{"spec":{"priority":9}}'
~~~

最后一条应被字段校验拒绝，priority 最大是 3。对象仍保持原值 2。additionalPrinterColumns 只是决定 get 表格多显示哪些字段，不会执行笔记里的工作，更不会创建 Pod。

## 控制器真正多做的是什么

一个真实数据库控制器会监听自定义对象，比较期望与实际状态，按需创建 StatefulSet、Service、Secret，执行升级或备份，再更新 status。协调循环应该能重复执行、处理中断并避免重复副作用，不能把一次 shell 脚本成功运行等同于一个可靠 Operator。

~~~bash
kubectl -n lab patch note first-note --type=merge -p '{"spec":{"priority":3}}'
kubectl -n lab get notes
kubectl -n lab get pods
~~~

Note 更新了，Pod 列表不因它变化。这个对照比记“CRD 很强大”更重要：API 扩展和自动运维逻辑是两层，出了问题要知道查哪层。

## Finalizer 为什么会让删除卡住

控制器有时给对象加 finalizer，要求先清理云盘、DNS 或外部资源再完成删除。控制器失效时对象可能长期 Terminating。先查控制器日志和外部资源状态，不能把删除所有 finalizer 当成标准修复，因为那可能留下收费资源或破坏数据。

## 卸载 CRD 前先看它管理了什么

~~~bash
kubectl -n lab delete -f extensions/note.yaml
kubectl delete -f extensions/note-crd.yaml
kubectl api-resources --api-group=learning.foaier.local
~~~

本课只删除自己的学习类型。删除 CRD 会影响该类型的所有对象，不只是当前 namespace；真实 Operator 升级还要考虑 schema、转换 webhook、存储版本、回滚和备份。不要为了卸载一个实验 release 就把其他应用共用的 CRD 全删掉。

## 继续阅读

- [自定义资源](https://kubernetes.io/zh-cn/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
- [Operator 模式](https://kubernetes.io/zh-cn/docs/concepts/extend-kubernetes/operator/)
