---
title: "Pod 地址总在变，别的服务怎么找它？用 Service 给它一个稳定入口"
date: "2026-11-24"
summary: "沿着 Service、标签选择器、EndpointSlice 和 DNS 走一遍访问链路。"
series: "Docker 与 Kubernetes"
order: 24
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-deployment"]
goals: ["找到 API Service 对应的就绪后端，并在集群内通过 DNS 访问。"]
---

刚记下 Pod IP，滚动更新一做地址就变了。Service 就像一个相对稳定的通讯录入口：客户端找服务名，具体可接流量的 Pod 由集群维护。它不负责让程序变快，也不会给任意标签自动找到正确进程。

## 概念讲透：它负责什么，不负责什么

Pod IP 会随重建变化，Service 用稳定虚拟地址和 DNS 名称把请求转给匹配的就绪 Pod。selector 找到候选 Pod，EndpointSlice 保存当前可转发的后端。ClusterIP 主要用于集群内部；NodePort 和 LoadBalancer 提供不同外部接入方式。Service 不会替应用实现登录会话、限流或数据库连接池。

## 运行过程拆解：从输入到结果

Service 的 selector 找到标签匹配的 Pod，readiness 状态影响 Pod 是否进入服务后端，EndpointSlice 记录可转发的地址与端口。集群 DNS 把服务名解析到 ClusterIP，转发组件再把连接送到后端。DNS、Service 端口、targetPort、容器监听端口必须逐一对应；当后端列表为空时，改 CoreDNS 通常帮不上忙，应该先核对选择器与就绪条件。

## 用稳定服务名找到会变化的 Pod

课程 Service `course-api` 的 port 是 80，targetPort 是名为 http 的容器端口，最终落到 API 的 8080。selector `app: course-api` 选择对应 Pod；EndpointSlice 记录这些后端与就绪条件。数据库用 `postgres:5432`，这个名字由同 namespace 内的集群 DNS 解析。

ClusterIP 用于集群内部；NodePort 借节点端口暴露；LoadBalancer 通常依赖云或其他实现分配入口。在 kind 里只写 LoadBalancer，不保证电脑立刻得到一个可用公网 IP。先用 port-forward 练习，再学 Gateway。

## 核对服务地址与就绪后端

先看 Service 与 EndpointSlice，再启动一个用完即删的 curl 调试 Pod。首次需要拉取 curl 镜像。它和 API 在同一个 namespace，因此短名字就够；跨 namespace 需使用 `course-api.container-course.svc.cluster.local` 一类完整名称，集群域也可被管理员修改。

~~~powershell
kubectl -n container-course get service course-api -o wide
kubectl -n container-course get endpointslice -l kubernetes.io/service-name=course-api -o yaml
kubectl -n container-course run course-curl --rm -i --restart=Never --image=curlimages/curl:8.12.1 -- http://course-api/health/ready
~~~

## 怎么确认做对了

Service 有 ClusterIP，EndpointSlice 有 API Pod 地址与 ready 条件，curl 返回 ready。如果 Service 存在而后端为空，请求仍然可能失败：对象存在只是入口存在，不代表背后已有健康的程序。

## 案例推演

Service DNS 能解析，但请求超时。先看 EndpointSlice 是否有后端；为空就核对 selector 标签与 readiness。若有后端，再从同 namespace 的临时客户端访问 Service DNS 和端口，逐层验证路由和容器监听端口。不要把 Pod IP 写入调用方配置，重建后它会变化。

## 留一个小练习

在 `20-api.yaml` 中先读清 selector 与 template labels 如何对应，暂时不用改文件。想一想把 selector 写成 course-ap 会发生什么；若要验证，只在本地练习集群改完立刻恢复，并重新查看 EndpointSlice。

## 没跑通时先查什么

按 DNS 能否解析、Service 端口、后端地址、Pod 监听端口、readiness 的顺序排查。port-forward 直达 Pod 成功，并不能证明集群内 Service 网络也通；两者走的路径不同。namespace 写错是最常见的小问题之一。

Service 的稳定性建立在 selector 和就绪后端上。将来加一支同标签的调试 Pod，它也可能被 Service 选中并接到真实流量；修改标签前先理解选择器范围，不要拿宽泛的 `app=api` 让不相干程序误入业务池。

## 从标签和 Service 描述定位空后端

Service 没有可用后端时，先看 API Pod 的标签是否匹配 selector，再看 Service 事件和端口映射。下面这些命令不会重建服务，适合先收集证据；Endpoints 为空时回到标签和 readiness 修正。

~~~powershell
kubectl -n container-course get pods -l app=course-api --show-labels
kubectl -n container-course describe service course-api
kubectl -n container-course get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp
~~~

## 生产里怎么用、怎么排障

外部 Service 类型会产生云资源和费用；内部 ClusterIP 虽不可直接从集群外访问，仍要配合网络策略和身份校验。长连接、会话粘滞和客户端连接池会影响流量切换，滚动发布时需验证旧连接如何结束。发现部分用户错误时要比较各后端版本和就绪状态，而不是只测一次 DNS。

## 参考资料

- [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- [EndpointSlice](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/)
