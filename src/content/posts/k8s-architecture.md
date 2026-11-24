---
title: "一份 YAML 交上去后，Kubernetes 到底是怎么把程序跑起来的？"
date: "2026-11-24"
summary: "顺着一次部署请求认识 API Server、etcd、调度器、控制器和 kubelet。"
series: "Docker 与 Kubernetes"
order: 20
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-why-runtime"]
goals: ["描述从 kubectl apply 到容器启动的主要路径，知道不同故障应找谁。"]
---

Kubernetes 的组件图看着像一间复杂机房。换个入口会好懂一些：你提交了一份“请运行两个 API”的 YAML，这个请求从哪里进，又是谁把程序真正启动起来？跟着它走一圈，比先背组件全名更容易记住。

## 概念讲透：它负责什么，不负责什么

API Server 是集群对象的入口和校验点，etcd 保存对象状态，控制器计算如何逼近期望，调度器给未分配节点的 Pod 选位置，kubelet 让节点上的容器运行并汇报状态。它们通过 API 协作形成控制循环。apply 被接受只说明对象写入成功；镜像拉取、调度和健康检查还可能继续失败。

## 运行过程拆解：从输入到结果

apply 创建的是 API 对象，不是对某台机器执行一条启动命令。API Server 校验并保存对象；控制器观察到 Deployment 后创建 ReplicaSet；调度器为 Pod 选择节点；节点 kubelet 让容器运行并汇报状态；Service 控制器则根据标签和就绪状态更新后端。每个环节异步推进，因此要用 status 和 Events 判断卡在哪个控制循环。

## 沿着一次部署请求找各个组件

kubectl 把请求发给 API Server；认证、授权、校验通过后，状态存进 etcd。Deployment 控制器看到期望副本数，管理 ReplicaSet，再由它管理 Pod。调度器给未分配节点的 Pod 挑位置。目标节点上的 kubelet 通过运行时拉镜像、建容器，网络插件配置网络，状态再汇报回来。

控制面负责“决定和记录”，工作节点负责“实际运行”。组件通常通过 API Server 观察和更新对象，不是 kubectl 直接登录每台节点启动进程。控制循环反复缩小期望与现状的差距；因此 apply 返回成功时，可能还在下载镜像，甚至还没找到足够内存的节点。

## 先认清 kubectl 要连哪个集群

这一课先准备客户端，集群在下一课创建。查看本机上下文名称和客户端版本，不执行 apply。没有 kubeconfig 时 current-context 报未设置很正常；如果显示公司或云端集群，先记住名字，后面练习必须明确使用 kind-course。

~~~powershell
kubectl version --client
kubectl config get-contexts
kubectl config current-context
~~~

## 怎么确认做对了

Client Version 是本机 kubectl 的版本。context 只是连接地址、凭证、默认 namespace 的组合，不代表机器上实际有一个正在运行的集群。等下一课创建集群后，再用 `get nodes` 和 `get pods -n kube-system` 对上组件名字。

## 案例推演

kubectl apply 返回 configured，用户仍访问不到服务。按对象链路查：Deployment 是否生成 ReplicaSet，Pod 是否调度，节点是否拉到镜像，容器是否 Ready，Service 是否有 EndpointSlice，最后检查入口。这个顺序能把“配置已保存”和“应用已可用”分开，不要只看 apply 输出就宣布发布完成。

## 留一个小练习

画一条“apply → API Server → 状态变化 → 调度 → kubelet → 容器”的路径。分别标出镜像不存在、节点内存不足、请求被 RBAC 拒绝会卡在哪里。它们最后都表现成“程序没起来”，检查入口却完全不同。

## 没跑通时先查什么

别直接连 etcd 改对象，也别把它理解成存业务表的 PostgreSQL。etcd 保存集群状态；业务数据库和持久卷是别的备份对象。控制面暂时不可用时，已有容器可能仍能运行，但新的调度、扩容和对象变更会受影响。

## 从集群、节点和工作负载读当前状态

同一组对象不必在两段练习里重复查看。这里从集群入口逐层看到节点和所有命名空间的 Pod；如果节点 Ready 但业务 Pod 没启动，再回到课程命名空间检查调度与控制器事件。

~~~powershell
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -A -o wide
~~~


## 控制面组件不是一个“总管进程”

| 组件 | 主要职责 | 它不负责什么 |
|---|---|---|
| API Server | 认证请求、授权、校验对象、提供 Kubernetes API | 不直接替你启动业务容器 |
| etcd | 持久保存集群对象状态 | 不是业务数据库或日志存储 |
| Controller Manager | 运行控制器，持续比较期望与现状 | 不承诺每一步立刻完成 |
| Scheduler | 为尚未绑定节点的 Pod 过滤并选择节点 | 不创建容器进程 |
| kubelet | 在节点上执行 Pod 规格并汇报状态 | 不负责决定业务副本数 |
| Container Runtime | 拉取镜像并运行容器 | 不理解 Deployment 的滚动发布语义 |
| CNI / CSI | 配置 Pod 网络 / 挂接存储 | 插件是否可用取决于集群安装 |

Scheduler 绑定的是 Pod 与 Node 的关系，不是替用户“挑一台机器启动一个容器”。节点 kubelet 观察到已分配给本机的 Pod 后，才调用容器运行时创建容器；网络插件和存储插件还要分别完成自己的工作。

## 把一次 Deployment 拆成可观察的状态变化

控制器处理是异步的。一个成功的 apply 可能只创建了 Deployment 对象；随后 Deployment controller 创建 ReplicaSet，ReplicaSet 创建 Pod，Scheduler 分配节点，kubelet 拉镜像并启动容器。只要某一环没有推进，就能从对应对象和 Events 找证据。

~~~text
kubectl apply
  -> API Server 校验并保存 Deployment
  -> Deployment controller 生成 ReplicaSet
  -> ReplicaSet controller 创建 Pod
  -> Scheduler 选择 Node 并绑定 Pod
  -> kubelet + CRI 创建容器，CNI 配网络
  -> 探针通过，EndpointSlice 收录就绪后端
~~~

生产集群的控制面可能由云厂商托管，因此你看不到 API Server Pod 或 etcd Pod；这不代表控制面不存在。先理解服务边界，再按集群类型选择能观察的指标和日志。

## 用 API 健康、节点和 Events 找流程卡点

readyz 检查 API Server 当前就绪状态；节点与 Pod 列表说明工作节点控制循环是否正常。Warning Events 会提示调度失败、拉镜像失败、卷挂载失败等原因，但 Events 会过期，事故发生时要及时收集。

~~~powershell
kubectl get --raw='/readyz?verbose'
kubectl get nodes -o wide
kubectl get pods -A -o wide
kubectl get events -A --field-selector type=Warning --sort-by=.metadata.creationTimestamp
~~~

若只有 API 访问失败，先确认 kubeconfig、网络和认证；若 API 正常而 Pod Pending，转查调度事件；若 Pod 已分配节点却容器没起来，再查节点状态、镜像和 kubelet/runtime。不要直接操作 etcd 来“修复”对象状态。

## 生产里怎么用、怎么排障

控制面 API 不可达时，已有容器可能仍在节点运行，但新对象、调度和扩缩容无法正常推进；etcd 丢失或损坏则影响集群状态恢复。生产里要监控 API 延迟、控制器队列、节点状态和 etcd 容量，并保护管理凭证。排错不要直接修改 etcd；通过受支持的 API 操作并保留审计。

## 参考资料

- [集群组件](https://kubernetes.io/docs/concepts/overview/components/)
- [控制器](https://kubernetes.io/docs/concepts/architecture/controller/)
