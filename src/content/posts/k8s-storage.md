---
title: 数据放哪里：emptyDir、hostPath、PV、PVC 和 StorageClass
date: '2026-11-24'
summary: 写入一条记录，删除并重建 Pod，验证 PVC 中的数据是否还在，再解释存储绑定和回收行为。
series: Docker 与 Kubernetes
order: 36
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-config-secrets
  - k8s-resources
goals:
  - 写入一条记录，删除并重建 Pod，验证 PVC 中的数据是否还在，再解释存储绑定和回收行为。
---
容器重建后能重新下载镜像，用户数据却不能靠下载镜像找回来。存储这一课不先背缩写，先做一个实验：写一个文件，删 Pod，再创建同名 Pod，文件还在不在？

## 几种存储各活多久

| 方式 | 数据在哪里 | 主要边界 |
| --- | --- | --- |
| 容器可写层 | 容器文件系统 | 容器被替换后不应依赖它保留数据 |
| emptyDir | Pod 使用的临时目录或内存 | 同 Pod 容器重启可保留，Pod 删除则丢失 |
| hostPath | 特定节点上的目录 | 调到别的节点后不再是同一份数据，且会暴露宿主机文件 |
| PVC 对应的持久卷 | 由存储实现决定 | 独立于 Pod，但不保证跨节点可用或自动备份 |

PV 是集群中的卷资源，PVC 是某个 namespace 对存储的申请，StorageClass 描述如何动态提供卷。应用通常引用 PVC，存储插件负责满足申请。kind 的 standard 类用节点容器里的本地目录提供卷，适合练习，不是跨机器复制存储。

## 先检查本机已有的存储能力

~~~bash
kubectl config use-context kind-course
kubectl get storageclass
kubectl -n local-path-storage get pods
kubectl get storageclass standard -o yaml
~~~

本课固定 kind 环境应有 `standard`，provisioner 为 local-path，绑定模式 WaitForFirstConsumer。它会等消费者 Pod 出现、确定节点之后再创建合适的卷，所以只创建 PVC 时 Pending 不一定是坏事。别看到 Pending 就再安装一个 provisioner。

## 申请卷，挂到一个工具 Pod

~~~yaml file=storage/claim.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: notes-data
  namespace: lab
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: standard
  resources:
    requests:
      storage: 1Gi
~~~

~~~yaml file=storage/writer.yaml
apiVersion: v1
kind: Pod
metadata:
  name: disk-writer
  namespace: lab
spec:
  containers:
    - name: shell
      image: busybox:1.37
      command: ["sleep", "86400"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: notes-data
~~~

~~~bash
kubectl apply -f storage/claim.yaml
kubectl -n lab get pvc notes-data
kubectl apply -f storage/writer.yaml
kubectl -n lab wait --for=condition=Ready pod/disk-writer --timeout=180s
kubectl -n lab get pvc notes-data
kubectl -n lab exec disk-writer -- sh -c 'echo first-note > /data/note.txt'
kubectl -n lab exec disk-writer -- cat /data/note.txt
~~~

PVC 应从 Pending 变成 Bound，文件输出 first-note。`mountPath` 是容器内路径，不是电脑上的文件夹。ReadWriteOnce 指单节点读写，不是严格“只允许一个 Pod”；同节点多个 Pod 可能共享，真正单 Pod 访问还涉及 ReadWriteOncePod 和 CSI 支持。

## 删除 Pod，再读同一个文件

~~~bash
kubectl -n lab delete pod disk-writer
kubectl apply -f storage/writer.yaml
kubectl -n lab wait --for=condition=Ready pod/disk-writer --timeout=180s
kubectl -n lab exec disk-writer -- cat /data/note.txt
kubectl get pv
~~~

仍然输出 first-note，说明数据不属于原 Pod 的生命周期。因为这里使用本地卷，新 Pod 需要调度到符合卷节点约束的地方；节点故障时不能假装换台机器就能读取本地目录。

## PVC Pending 和挂载失败分别查什么

~~~bash
kubectl -n lab describe pvc notes-data
kubectl -n lab describe pod disk-writer
kubectl -n local-path-storage logs deployment/local-path-provisioner --tail=50
~~~

没有 StorageClass、容量或访问模式不匹配、provisioner 报错，都要从 PVC 事件看；FailedMount 则继续检查 Pod 事件、卷权限和驱动。动态卷绑定后，storageClassName 等字段不能随意修改。旧课程若已有 local-path 类的 PVC，不要强行改成 standard；先备份数据，保持旧卷或另建新卷迁移。

## 删除 PVC 不是清理一个空标签

PV 的 reclaimPolicy 若是 Delete，删 PVC 往往会连后端数据一起删；Retain 则保留底层数据等待管理员处理。PVC 保护机制可能让仍被 Pod 使用的卷停在 Terminating，这是避免误删的机制，不应首先强拆 finalizer。

本课数据只有 first-note，确认不需要后再执行：

~~~bash
kubectl -n lab delete pod disk-writer
kubectl -n lab delete pvc notes-data
kubectl get pv
~~~

数据库备份要能恢复并验证，PVC、云盘快照、etcd 快照解决的是不同问题。后面的综合项目会备份 PostgreSQL，而不是把“用了 PVC”当作备份方案。

## 继续阅读

- [持久卷](https://kubernetes.io/zh-cn/docs/concepts/storage/persistent-volumes/)
- [StorageClass](https://kubernetes.io/zh-cn/docs/concepts/storage/storage-classes/)
