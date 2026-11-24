---
title: 备份不能只看文件存在：etcd 快照恢复与升级顺序
date: '2026-11-24'
summary: 保存 kind 集群的 etcd 快照，在隔离容器中恢复并查询对象，再梳理 kubeadm 升级时的检查与回退边界。
series: Docker 与 Kubernetes
order: 53
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-architecture
  - k8s-kubeadm
goals:
  - 保存 kind 集群的 etcd 快照，在隔离容器中恢复并查询对象，再梳理 kubeadm 升级时的检查与回退边界。
---
etcd 保存集群对象状态，包括 Deployment、Service、Secret 等；它不保存镜像层，也不保存 PostgreSQL 数据卷里的业务数据。做了 etcd 快照，不能宣称数据库数据已经有备份。

## 先写一条可验证的标记

回到电脑 Bash，在 `k8s-labs` 根目录，确认 context 是 kind-course。本课读取实际运行的 etcd 镜像版本，恢复使用同一镜像，不随便下载另一个大版本。

~~~bash
kubectl config use-context kind-course
kubectl -n lab create configmap backup-proof --from-literal=message=snapshot-contains-this --dry-run=client -o yaml | kubectl apply -f -
kubectl -n kube-system get pod etcd-course-control-plane
lab_etcd_image=$(kubectl -n kube-system get pod etcd-course-control-plane -o jsonpath='{.spec.containers[0].image}')
printf '%s\n' "$lab_etcd_image"
mkdir -p backups
~~~

快照可能含 Secret，backups 目录已从下载包和 Git 忽略。不要上传快照到公开仓库，也不要把它当成普通示例附件。

## 保存在线快照并拷到电脑

~~~bash
kubectl -n kube-system exec etcd-course-control-plane -- etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /var/lib/etcd/lesson-snapshot.db
docker cp course-control-plane:/var/lib/etcd/lesson-snapshot.db ./backups/lesson-snapshot.db
docker run --rm --entrypoint etcdutl -v "$PWD/backups:/backup:ro" "$lab_etcd_image" snapshot status /backup/lesson-snapshot.db --write-out=table
~~~

etcdctl 通过 HTTPS 连接当前成员；etcdutl 查看离线快照。kind 节点把 /var/lib/etcd 挂给 etcd Pod，所以可以从节点容器 docker cp 取文件，避开精简 etcd 镜像没有 tar 导致 kubectl cp 失败的问题。看到 revision、键数量等信息说明文件可识别，还没证明能恢复。

## 恢复到隔离数据卷，不覆盖正在运行的集群

先确认没有以前留下的同名恢复容器和卷。若有，先判断是否还需要，不要直接覆盖。以下创建的是独立实验资源：

~~~bash
docker ps -a --filter name=course-etcd-check
docker volume ls --filter name=course-etcd-restore
docker volume create course-etcd-restore
docker run --rm --entrypoint etcdutl -v "$PWD/backups:/backup:ro" -v course-etcd-restore:/restore "$lab_etcd_image" snapshot restore /backup/lesson-snapshot.db --data-dir=/restore/data --name=restore --initial-cluster=restore=http://127.0.0.1:2380 --initial-advertise-peer-urls=http://127.0.0.1:2380
docker run -d --name course-etcd-check -v course-etcd-restore:/restore --entrypoint etcd "$lab_etcd_image" --name=restore --data-dir=/restore/data --listen-client-urls=http://127.0.0.1:2379 --advertise-client-urls=http://127.0.0.1:2379 --listen-peer-urls=http://127.0.0.1:2380 --initial-advertise-peer-urls=http://127.0.0.1:2380 --initial-cluster=restore=http://127.0.0.1:2380
~~~

恢复目录必须为空，重复运行会拒绝已有数据目录。容器没有 `-p` 映射，且只监听其内部回环地址；它不会成为当前 Kubernetes 的新 etcd 成员，也不会接管生产状态。

## 查询恢复的对象，才算完成这次演练

~~~bash
docker exec course-etcd-check etcdctl --endpoints=http://127.0.0.1:2379 endpoint health
kubectl -n lab delete configmap backup-proof
docker exec course-etcd-check etcdctl --endpoints=http://127.0.0.1:2379 get /registry/configmaps/lab/backup-proof --count-only
kubectl -n lab get configmap backup-proof
~~~

恢复容器应健康，键数量应为 1；当前集群查询 ConfigMap 则 NotFound。两者共同说明：旧快照确实含标记，恢复的是过去状态。这里验证到 etcd 数据恢复，没有完成整套控制平面灾难切换；实际恢复还涉及 API Server 指向、证书、加密配置、成员关系和 revision 处理。

~~~bash
docker stop course-etcd-check
docker rm course-etcd-check
docker volume rm course-etcd-restore
~~~

本机快照保留用于查看，实验结束后按自己的备份保留策略删除。真实备份还需要异地保存、加密、保留周期、恢复演练频率和明确的 RPO/RTO。

## 升级要按层，而不是所有节点一起 apt upgrade

kubeadm 集群通常先升级控制平面上的 kubeadm，运行 upgrade plan，升级控制平面，再逐节点排空、升级 kubelet/kubectl、重启 kubelet、恢复调度。跨小版本升级必须遵守版本偏差策略，不能一次跳多个小版本；先核对 CNI、CSI、入口和 CRD/webhook 的兼容性。

在上一课虚拟机控制平面上，先做只读检查：

~~~bash
kubeadm version -o short
kubectl version
sudo kubeadm certs check-expiration
sudo kubeadm upgrade plan
kubectl get nodes
~~~

真正升级的目标版本必须从 plan 和所选仓库确认，再按相应版本步骤执行，不把文章中的示例版本盲目覆盖到真实集群。worker 维护时使用上一课的 cordon/drain/PDB 流程，确认业务恢复后再处理下一台。

“回退 apt 包”不是完整回退方案：API 存储版本、etcd、插件和业务迁移可能已经变化。升级前应明确能否回退，必要时用重建集群与迁移方式恢复，并在测试集群走完一遍。

## 继续阅读

- [etcd 灾难恢复](https://etcd.io/docs/v3.6/op-guide/recovery/)
- [kubeadm 升级集群](https://kubernetes.io/zh-cn/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/)
