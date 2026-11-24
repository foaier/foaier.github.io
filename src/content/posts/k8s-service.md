---
title: Pod 地址总在变，别的服务怎么找它？用 Service 给它一个稳定入口
date: '2026-11-24'
summary: 沿着 Service、标签选择器、EndpointSlice 和 DNS 走一遍访问链路。
series: Docker 与 Kubernetes
order: 24
tags:
  - Kubernetes 入门
  - Docker
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-architecture
goals:
  - 找到 API Service 对应的就绪后端，并在集群内通过 DNS 访问。
---

刚记下 Pod IP，滚动更新一做地址就变了。Service 就像一个相对稳定的通讯录入口：客户端找服务名，具体可接流量的 Pod 由集群维护。它不负责让程序变快，也不会给任意标签自动找到正确进程。

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

## 从标签和 Service 描述定位空后端

Service 没有可用后端时，先看 API Pod 的标签是否匹配 selector，再看 Service 事件和端口映射。下面这些命令不会重建服务，适合先收集证据；Endpoints 为空时回到标签和 readiness 修正。

~~~powershell
kubectl -n container-course get pods -l app=course-api --show-labels
kubectl -n container-course describe service course-api
kubectl -n container-course get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp
~~~

## Service 类型决定的是入口范围

| 类型 | 入口范围 | 依赖与注意点 |
|---|---|---|
| ClusterIP | 集群内部虚拟地址，默认类型 | 常用于 API 调用数据库或其他服务 |
| NodePort | 每个节点上一个端口 | 端口范围受集群配置约束，外部防火墙仍需放行 |
| LoadBalancer | 由外部实现分配入口 | 常依赖云控制器或 MetalLB，可能产生费用 |
| ExternalName | DNS CNAME 到外部域名 | 不代理流量，不会生成 Pod EndpointSlice |
| Headless（clusterIP: None） | DNS 返回后端地址而非 ClusterIP | 常用于 StatefulSet 身份发现，不是普通负载均衡入口 |

服务类型不是“从不安全到安全”的等级。对外提供 HTTP 常用受维护的 Gateway/入口实现；数据库通常只用 ClusterIP，并由网络策略控制哪些 Pod 可以连接。NodePort 和 LoadBalancer 也不会自动加 TLS、身份认证或 WAF。

## 端口映射必须沿着名字和数字读到底

Service 的 port 是客户端访问 Service 的端口，targetPort 是 Pod 上接收流量的端口；targetPort 可以写数字，也可以引用 Pod 声明的命名端口。课程 API 的 Service 暴露 :80，并把它转到容器的命名端口 http，即 :8080。

~~~yaml
ports:
  - name: http
    port: 80
    targetPort: http
selector:
  app: course-api
~~~

这段需和 Pod template 中的 labels 对照；Pod 声明 ports.name 为 http、containerPort 为 8080 时，Service 才能按名字找到目标端口。containerPort 是元数据，不会替进程监听端口，也不会创建 NodePort。

## CoreDNS 返回 ClusterIP，不代表后端已经可用

Service DNS 的短名在同 namespace 可用；跨 namespace 可以用 service.namespace，完整名称通常是 service.namespace.svc.cluster.local，但集群域可能被管理员改过。DNS 返回地址后还需 EndpointSlice 有就绪后端、CNI 连通和容器正确监听。排障时把解析、服务端口、后端端口和应用协议分开验证。

~~~powershell
kubectl -n container-course get service course-api -o jsonpath='{.spec.clusterIP}{" : "}{.spec.ports[0].port}{" -> "}{.spec.ports[0].targetPort}{"\n"}'
kubectl -n container-course get endpointslice -l kubernetes.io/service-name=course-api -o yaml
kubectl -n container-course run service-dns-lab --rm -i --restart=Never --image=busybox:1.37 -- nslookup course-api.container-course.svc.cluster.local
~~~

EndpointSlice 是由控制器维护的后端分片，不应手工把 Pod IP 固定进去。selectorless Service 可以配合手工 EndpointSlice 指向集群外服务，但要自行负责地址更新、健康检查和安全边界。

## 参考资料

- [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- [EndpointSlice](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/)
