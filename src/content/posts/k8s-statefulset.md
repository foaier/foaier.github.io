---
title: StatefulSet：稳定名字、独立磁盘，不等于数据库高可用
date: '2026-11-24'
summary: 创建两个有固定编号和各自 PVC 的实例，删除其中一个，再验证名字与数据的关系。
series: Docker 与 Kubernetes
order: 38
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-storage
  - k8s-workloads
goals:
  - 创建两个有固定编号和各自 PVC 的实例，删除其中一个，再验证名字与数据的关系。
---
Deployment 中的两个网页副本应该可以互换。数据库集群的成员却可能需要固定身份，成员各有数据，不能任意换一块磁盘就继续用。StatefulSet 提供稳定的序号、网络身份和存储关联，但不负责实现数据库复制协议。

## 和 Deployment 最重要的区别

本课两个实例会叫 `ledger-0`、`ledger-1`，每个对应自己的 PVC。重新创建 ledger-0 时仍使用属于序号 0 的卷，而不是随机使用 ledger-1 的卷。Headless Service 为成员提供 DNS 发现；默认 OrderedReady 策略按顺序创建并等待就绪，所以第一个实例卡住，后面的也可能不会创建。

## 完整文件：服务、工作负载和卷模板

~~~yaml file=storage/statefulset.yaml
apiVersion: v1
kind: Service
metadata:
  name: ledger
  namespace: lab
spec:
  clusterIP: None
  selector: {app: ledger}
  ports:
    - {name: http, port: 80, targetPort: 80}
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ledger
  namespace: lab
spec:
  serviceName: ledger
  replicas: 2
  selector:
    matchLabels: {app: ledger}
  template:
    metadata:
      labels: {app: ledger}
    spec:
      containers:
        - name: nginx
          image: nginx:1.28-alpine
          ports:
            - {name: http, containerPort: 80}
          volumeMounts:
            - name: data
              mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        storageClassName: standard
        accessModes: [ReadWriteOnce]
        resources:
          requests: {storage: 1Gi}
~~~

~~~bash
kubectl apply -f storage/statefulset.yaml
kubectl -n lab rollout status statefulset/ledger --timeout=240s
kubectl -n lab get pods -l app=ledger -o wide
kubectl -n lab get pvc
~~~

应看到 ledger-0、ledger-1，以及 data-ledger-0、data-ledger-1 两个 PVC。卷挂在网页目录后，原镜像目录内容被遮住，初次访问可能没有首页；这是挂载覆盖视图，不是 Nginx 镜像损坏。

## 各写一份数据，看看是否相互独立

~~~bash
kubectl -n lab exec ledger-0 -- sh -c 'echo record-zero > /usr/share/nginx/html/index.html'
kubectl -n lab exec ledger-1 -- sh -c 'echo record-one > /usr/share/nginx/html/index.html'
kubectl -n lab run state-client --image=busybox:1.37 --restart=Never -- sleep 3600
kubectl -n lab wait --for=condition=Ready pod/state-client --timeout=120s
kubectl -n lab exec state-client -- wget -qO- http://ledger-0.ledger.lab.svc.cluster.local
kubectl -n lab exec state-client -- wget -qO- http://ledger-1.ledger.lab.svc.cluster.local
~~~

分别返回 record-zero 和 record-one。这证明每个成员保留自己的身份和磁盘，也说明它们**没有自动同步数据**。把 MySQL replicas 改成 3，并不会自动配置三个 MySQL 成员的复制关系。

## 删除 0 号实例，再看名字和数据

~~~bash
kubectl -n lab delete pod ledger-0
kubectl -n lab rollout status statefulset/ledger --timeout=240s
kubectl -n lab exec ledger-0 -- cat /usr/share/nginx/html/index.html
kubectl -n lab get pvc data-ledger-0
~~~

新 Pod 仍叫 ledger-0，UID 已变，记录仍是 record-zero。DNS 缓存可能让刚重建的成员短时间解析失败，客户端要有有限重试。这里本地存储仍依赖原节点，StatefulSet 不能把节点上的数据瞬移到另一台机器。

## 缩容为什么没删磁盘

~~~bash
kubectl -n lab scale statefulset ledger --replicas=1
kubectl -n lab get pods -l app=ledger
kubectl -n lab get pvc
kubectl -n lab scale statefulset ledger --replicas=2
kubectl -n lab rollout status statefulset/ledger --timeout=240s
kubectl -n lab exec ledger-1 -- cat /usr/share/nginx/html/index.html
~~~

本例没设置自动删除 PVC 的策略，缩容默认保留磁盘，再扩回两份仍能读 record-one。这有助于保护数据，也意味着长期缩容后可能遗留费用和磁盘占用，需要有明确管理策略。

## 真正上线数据库还缺什么

要另外设计复制、选主、故障切换、备份恢复、升级兼容性、读写路由和监控。可以选择成熟 Operator 或托管数据库，但仍要演练恢复。StatefulSet 只解决部分运行管理问题，不能替代数据库知识。

本课数据已验证，确认可以删除后清理：

~~~bash
kubectl -n lab delete pod state-client
kubectl delete -f storage/statefulset.yaml
kubectl -n lab delete pvc data-ledger-0 data-ledger-1
~~~

最后一条会删除本课持久数据。不要直接用标签批量清理所有 PVC，因为别的业务可能也使用相似标签。

## 继续阅读

- [StatefulSet](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/statefulset/)
- [Pod 与 Service DNS](https://kubernetes.io/zh-cn/docs/concepts/services-networking/dns-pod-service/)
