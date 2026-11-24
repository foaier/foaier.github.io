---
title: Pod 可以重建，数据库文件怎么办？从 PVC 理解持久化
date: '2026-11-24'
summary: 拆开 PV、PVC、StorageClass，并用重建数据库 Pod 验证数据保留。
series: Docker 与 Kubernetes
order: 29
tags:
  - Kubernetes 入门
  - Docker
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-rollouts
goals:
  - 验证课程 PostgreSQL 持久卷独立于 Pod，理解本地盘与可靠备份的差别。
---

API Pod 重建后还能继续处理请求，数据库 Pod 重建后若连表都没有，那就不是同一种故障了。数据库文件不能靠容器可写层保存。PVC 是应用向集群提出的存储申请，不是备份按钮。

## 存储申请、实际卷和供应方式

PVC 写容量与访问要求，PV 代表集群中的一份卷，StorageClass 决定动态供应卷的方式。课程 PVC 申请 1Gi，访问模式 ReadWriteOnce 通常限制为同一节点读写，不等于全局只能一个 Pod 访问，更不提供数据库写入协调。

课程用单副本 PostgreSQL Deployment，更新策略为 Recreate，防止同一数据目录被新旧实例同时打开。kind 的默认存储用于本地演示，节点容器没了数据也可能没了；跨节点移动、云盘快照、数据库复制与恢复要另行设计。生产数据库通常选托管服务或成熟 Operator。

## 重建数据库 Pod，检查数据是否还在

先通过 API 写一条记录，随后删除数据库的 Pod，让 Deployment 在同一个 PVC 上重建。按课程 Readme 开 API port-forward；它若因相关 Pod 重建断开，重新运行即可。不要删除 PVC，也不要删 namespace。

~~~powershell
kubectl -n container-course get pvc
kubectl get storageclass
# API port-forward 保持运行，在另一个 PowerShell 写入
Invoke-RestMethod -Method Post -Uri http://localhost:8080/visits -ContentType "application/json" -Body '{"note":"pvc-survives-pod"}'
$context = kubectl config current-context
if ($context -ne 'kind-course') { throw "当前 context 是 $context；只在课程 kind-course 删除练习 Pod" }
kubectl -n container-course delete pod -l app=postgres
kubectl -n container-course rollout status deployment/postgres --timeout=180s
kubectl -n container-course wait --for=condition=Ready pod -l app=course-api --timeout=180s
Invoke-RestMethod http://localhost:8080/visits
~~~

## 继续追 PVC 绑定到了哪块存储

PVC Bound 只表示申请已绑定 PV，并不说明备份可恢复。接着查看集群提供的 StorageClass、实际 PV，再检查数据库 Pod 的挂载；删除 PVC 前先读存储回收策略并确认数据有独立备份。

~~~powershell
kubectl get persistentvolumes -o wide
kubectl -n container-course describe pod -l app=postgres
~~~

## PVC、PV 和 StorageClass 的关系

PVC 是应用对存储容量与访问方式的申请；PV 表示集群可绑定的一块实际存储；StorageClass 描述动态供给所用的驱动和策略。管理员可预先创建 PV，也可由 CSI provisioner 根据 PVC 自动创建。PVC 绑定成功只说明卷被分配，不代表已做备份或具备跨可用区容灾。

| 概念 | 由谁常维护 | 需要读什么 |
|---|---|---|
| PVC | 应用团队 | namespace、容量、accessModes、storageClassName |
| PV | 管理员或 provisioner | 存储来源、容量、回收策略、绑定状态 |
| StorageClass | 集群管理员 | CSI provisioner、参数、默认类、绑定时机 |
| CSI driver | 平台团队或云厂商 | 卷创建、挂载、扩容、快照能力 |

ReadWriteOnce 表示卷可由单个节点以读写方式挂载，不等同于“只有一个 Pod 能用”；同一节点上的 Pod 仍可能共享挂载，具体还受驱动支持限制。ReadWriteMany 也要底层文件系统和 CSI driver 支持。

## 回收策略和备份要分开设计

PV 的 Retain/Delete 回收策略控制 PVC 被删后的卷处理方式；Delete 可能连云盘一起删除，Retain 则需要管理员手工回收。生产数据库还需做一致性备份、异地保存、访问控制和定期恢复演练。卷快照有助于恢复，但不能自动代替业务级备份和跨账户隔离。

课程数据库是单副本示例，kind 的 PVC 不是高可用 PostgreSQL。状态型工作负载升级前先确认数据库备份、版本兼容、存储扩容和恢复路径。

## 参考资料

- [持久卷](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [StorageClass](https://kubernetes.io/docs/concepts/storage/storage-classes/)
