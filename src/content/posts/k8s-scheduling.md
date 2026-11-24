---
title: Pod 放哪台机器：标签、亲和性、污点和节点排空
date: '2026-11-24'
summary: 用两个 worker 完成定向调度、Pending 故障与修复，再练习 cordon、drain 和 PDB。
series: Docker 与 Kubernetes
order: 43
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-resources
  - k8s-statefulset
goals:
  - 用两个 worker 完成定向调度、Pending 故障与修复，再练习 cordon、drain 和 PDB。
---
调度器不是简单挑“CPU 当前最低”的节点。它先过滤不满足条件的节点，再给候选节点打分。资源请求、标签、污点、卷位置、亲和性都会影响结果。下面都在三节点 kind-course 做，不操作公司节点。

## 用标签指定一类节点

~~~bash
kubectl get nodes
kubectl label node course-worker disk=fast --overwrite
kubectl get nodes -L disk
~~~

给节点加标签不会改变磁盘性能，只是声明一个供规则选择的标记。生产标签应反映真实条件。文件 `scheduling/placement.yaml`：

~~~yaml file=scheduling/placement.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: placed-web
  namespace: lab
spec:
  replicas: 2
  selector:
    matchLabels: {app: placed-web}
  template:
    metadata:
      labels: {app: placed-web}
    spec:
      nodeSelector:
        disk: fast
      containers:
        - name: nginx
          image: nginx:1.28-alpine
          resources:
            requests: {cpu: 50m, memory: 32Mi}
~~~

~~~bash
kubectl apply -f scheduling/placement.yaml
kubectl -n lab rollout status deployment/placed-web --timeout=120s
kubectl -n lab get pods -l app=placed-web -o wide
~~~

两个副本应在 course-worker。副本数增加并不自动保证跨节点分散，硬性 nodeSelector 让它们都只能在同一处运行。

## 写一个不存在的标签值，观察 Pending

~~~bash
kubectl -n lab patch deployment placed-web --type=merge -p '{"spec":{"template":{"spec":{"nodeSelector":{"disk":"not-present"}}}}}'
kubectl -n lab get pods -l app=placed-web
kubectl -n lab describe pods -l app=placed-web
kubectl apply -f scheduling/placement.yaml
kubectl -n lab rollout status deployment/placed-web --timeout=120s
~~~

新 Pod 事件提示节点选择条件不匹配。修复条件后才能调度；加大重试次数、删 Pod，都不会让不存在的标签突然出现。老副本可能还在，这是滚动更新保留旧服务的结果。

## 亲和性比 nodeSelector 多了什么

nodeAffinity 支持表达式和软硬条件；required 是必须满足，preferred 是尽量满足。podAffinity 根据其他 Pod 的位置靠近，podAntiAffinity 则避开。`topologyKey` 决定按节点还是可用区分组。软反亲和遇到资源不足仍可能同节点，硬反亲和则可能直接 Pending。`topologySpreadConstraints` 适合控制副本在拓扑域间的偏斜。

规则名中的 `IgnoredDuringExecution` 表示条件变动后通常不会把已经运行的 Pod 自动驱逐，别以为去掉标签就立即迁移业务。

## 污点负责拒绝，容忍只是允许

~~~bash
kubectl taint node course-worker lab=reserved:NoSchedule
kubectl -n lab delete pod -l app=placed-web
kubectl -n lab get pods -l app=placed-web
kubectl -n lab describe pods -l app=placed-web
kubectl taint node course-worker lab=reserved:NoSchedule-
kubectl -n lab rollout status deployment/placed-web --timeout=180s
~~~

NoSchedule 不赶走已有 Pod，所以实验先删除副本，观察新副本不能进入该节点；随后移除污点恢复。NoExecute 还会影响已有 Pod，不能随手在生产节点测试。toleration 只表示“允许进入有这个污点的节点”，不代表“必须去这个节点”，定向安排还需配合选择条件。

## 维护节点前先留出副本余量

先解除本课的定向限制，再设置至少保留一个可用副本的 PDB：

~~~bash
kubectl -n lab patch deployment placed-web --type=json -p '[{"op":"remove","path":"/spec/template/spec/nodeSelector"}]'
kubectl -n lab rollout status deployment/placed-web --timeout=120s
kubectl -n lab create pdb placed-web --selector=app=placed-web --min-available=1
kubectl cordon course-worker
kubectl get nodes
kubectl drain course-worker --ignore-daemonsets --timeout=180s
~~~

cordon 阻止新 Pod 调度进来，不迁移旧 Pod；drain 尝试通过驱逐迁走符合条件的工作负载，并尊重 PDB。此时不要保留其他课的独立 Pod 或本地卷实验；若 drain 被它们阻塞，先按对应课清理，不要习惯性追加 `--force` 或删除数据的参数。PDB 约束自愿驱逐，不能防止断电，也不替代 Deployment 的更新策略。

## 确认恢复调度后再离开

~~~bash
kubectl uncordon course-worker
kubectl get nodes
kubectl -n lab delete pdb placed-web
kubectl delete -f scheduling/placement.yaml
kubectl label node course-worker disk-
~~~

状态不再有 SchedulingDisabled 才恢复。生产维护还需要容量余量、存储迁移能力、业务验证和维护窗口；本课两个 Docker worker 都在同一台电脑，不能模拟真正的机房故障隔离。

## 继续阅读

- [将 Pod 分配到节点](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/assign-pod-node/)
- [安全排空节点](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/safely-drain-node/)
