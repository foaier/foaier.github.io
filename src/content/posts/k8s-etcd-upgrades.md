---
title: "集群升级和 etcd 备份：控制面维护前先想能不能恢复"
date: "2026-11-24"
summary: "从 etcd 角色、版本偏差和节点排空讲清集群维护的前后条件。"
series: "Docker 与 Kubernetes"
order: 40
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-helm-kustomize"]
goals: ["检查集群版本信息并形成升级检查单，分清 etcd 与业务数据库备份。"]
---

升级 Kubernetes 不是把一个版本号改掉这么简单。控制面组件、节点、客户端和插件各有兼容范围；etcd 快照又关乎集群 API 状态。先确认谁托管、谁备份，再排维护窗口。

## 控制面和业务数据各自需要恢复方案

etcd 保存 Kubernetes 集群对象状态，不保存课程 PostgreSQL 里的 visits。备份 etcd 不等于备份应用卷和数据库。kubeadm 管理者按受支持的版本路径检查 API 弃用、备份并验证还原，再逐步维护控制面和节点；托管服务则遵循厂商升级与责任边界。

版本偏差策略限制 API Server、kubelet、kubectl 和控制器的组合，不能跨很多版本跳升。cordon/drain 会影响可用性，还受 PodDisruptionBudget、DaemonSet 和存储影响。kind 的 Docker 节点不是 kubeadm 多节点环境，不做生产升级命令。

## 先收集版本和节点信息

只收集当前版本和节点信息，不执行升级。真实 kubeadm 变更要由集群管理员按目标版本官方步骤操作；托管集群还要读服务商对控制面、插件和节点池的支持说明。

~~~powershell
kubectl version
kubectl get nodes -o wide
kind version
kubectl get pods -A -o wide
~~~

## 怎么确认做对了

节点版本、镜像和系统信息可以记录，课程集群状态没有变化。`kubectl drain` 和删除 etcd 数据目录不是检查命令；还原快照前也要确认它对应正确的成员集群。

## 留一个小练习

写升级检查单：目标版本跨度、API 弃用、插件兼容、etcd 和 PostgreSQL 分别备份、还原测试、PDB、节点逐个验证、回滚判据和负责人。任何一项没有实测步骤，“有备份”都不算恢复能力。

## 没跑通时先查什么

升级后 NotReady 要检查 kubelet、容器运行时、CNI/CSI、证书、CoreDNS 和入口兼容。etcd 恢复出错影响整个控制面，生产命令必须匹配具体拓扑、endpoint 和证书，不能复制别的集群路径。

## 为什么三台控制面也不能同时重启两台

etcd 需要多数成员同意才能提交写入。3 个成员要至少 2 个在线，能容忍 1 个故障；5 个成员要至少 3 个在线，能容忍 2 个。成员增加也会增加通信成本，并不是越多越好。跨很远的网络部署会把写入延迟和网络抖动带进控制面。

已有应用可能还在跑，但 etcd 无法达成多数时，新的 API 状态写入、调度和故障恢复会受影响。这就是维护通常逐个节点进行的原因：升级一台，确认健康，再处理下一台。不要把“容器还在服务”误认为控制面也能正常工作。

## 备份恢复要分成两份作业

| 要恢复什么 | 保存什么 | 如何验证 |
| --- | --- | --- |
| 集群对象状态 | etcd 一致性快照、对应版本与集群配置 | 检查快照，再在隔离恢复环境验证 API 对象 |
| PostgreSQL 业务记录 | 数据库逻辑或物理备份、必要的 WAL 与恢复参数 | 恢复到另一个数据库，查业务记录与时间点 |

etcdctl 负责通过网络和服务通信；较新版本使用 etcdutl 处理快照文件检查、离线恢复等工作。工具版本要匹配 etcd 支持要求。看到一个 .db 文件、文件大小不为零，都不等于已经验证它能恢复。

快照可能含 Secret 等集群敏感状态，所以要加密、限制读取权限、做异地保留。还原应遵循当前 etcd 的灾备指南，包含成员配置及 Kubernetes watch 缓存相关的 revision 处理；这部分不能用另一套集群的目录和证书硬套。

## PDB 管的是主动驱逐，不是停电保险

课程包的 labs/pdb.yaml 为两个 API 副本声明 minAvailable: 1。它限制遵守 Eviction API 的主动驱逐，节点断电、内核崩溃并不会先询问 PDB。Deployment 自己的滚动发布还要靠 maxUnavailable/maxSurge 管理，PDB 不能替它决定发布策略。

~~~powershell
kubectl apply -f labs/pdb.yaml
kubectl -n container-course get pdb course-api
kubectl -n container-course describe pdb course-api
kubectl -n container-course delete pdb course-api
~~~

两个 API 都健康时通常允许一次驱逐；只有一个健康时可能显示 0。单节点 kind 不做 drain 演练：两个副本放在同一台机器，数量够了也不具有跨节点故障容错能力。真正维护前还要检查副本分布和数据库所在节点。

## 参考资料

- [etcd 运维](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/)
- [kubeadm 升级](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/)
- [版本偏差策略](https://kubernetes.io/releases/version-skew-policy/)
