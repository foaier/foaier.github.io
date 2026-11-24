---
title: 集群升级和 etcd 备份：控制面维护前先想能不能恢复
date: '2026-11-24'
summary: 从 etcd 角色、版本偏差和节点排空讲清集群维护的前后条件。
series: Docker 与 Kubernetes
order: 40
tags:
  - Kubernetes 进阶
  - Docker
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-helm-kustomize
goals:
  - 检查集群版本信息并形成升级检查单，分清 etcd 与业务数据库备份。
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

## 升级前筛出 Pending 工作负载和控制面组件

版本清单和 Ready 节点状态已在前面的命令确认。升级前再检查 Pending Pod 与控制面组件状态；任何异常都先记录和处理。etcd 备份、升级和恢复命令要按集群发行版执行，kind 的容器节点不能照搬生产步骤。

~~~powershell
kubectl get pods -A --field-selector=status.phase=Pending -o wide
kubectl -n kube-system get pods -o wide
~~~

## 快照成功后至少还要检查什么

etcd 备份要和集群 ID、版本、成员拓扑、证书与恢复说明一起保存。快照文件存在且大小合理，只能证明写出了文件；离线检查快照状态，再在隔离环境恢复并验证关键 API 对象，才说明恢复路径大致可行。还原不是在运行中的集群上覆盖一个文件，必须遵循对应 etcd 与 Kubernetes 的官方灾备步骤。

在 kubeadm 自建集群中，管理员常使用 etcdctl 从本机 TLS endpoint 读取快照，再用兼容版本的 etcdutl 检查文件。下面是命令形态说明，不可原样粘贴：endpoint、CA、client certificate、私钥路径必须按你自己的 kubeadm 静态 Pod 配置确认；托管集群应使用云厂商快照和恢复流程。

~~~~bash
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/path/to/etcd-ca.crt \
  --cert=/path/to/etcd-client.crt \
  --key=/path/to/etcd-client.key \
  snapshot save /secure-backup/etcd-$(date +%F-%H%M).db

etcdutl snapshot status /secure-backup/etcd-YYYY-MM-DD-HHMM.db --write-out=table
~~~~

把敏感证书放进 shell 历史或把快照放在同一控制面磁盘上，都会削弱备份价值。快照应加密并存到隔离位置，按保留期轮换；恢复环境需记录 exact Kubernetes/etcd 版本和数据目录策略。

## 节点升级时一次只推进一个故障域

升级前确认版本偏差和插件兼容，确保剩余节点能承载当前 requests。维护一个节点时，先 cordon 阻止新 Pod 调度，再按 PDB 和 DaemonSet 情况 drain，完成节点升级并验证 kubelet、CNI、CSI 和业务请求后再继续下一台。单节点 kind 不适合练 drain，因为它没有可承接 Pod 的备用节点。

PDB 保护 Eviction API 路径中的自愿中断，不是机器故障保险；节点数量不足、PDB 配成 minAvailable 等于当前副本数时，drain 可能一直被阻止。不要使用 --disable-eviction 绕过保护，除非经过变更审批并明确承受中断。

## 参考资料

- [etcd 运维](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/)
- [kubeadm 升级](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/)
- [版本偏差策略](https://kubernetes.io/releases/version-skew-policy/)
