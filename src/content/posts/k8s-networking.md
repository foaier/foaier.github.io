---
title: 从 Pod 连不上开始：集群网络、CoreDNS 和 NetworkPolicy
date: '2026-11-24'
summary: 分开检查 Pod 网络、Service DNS、入口路由和网络策略。
series: Docker 与 Kubernetes
order: 35
tags:
  - Kubernetes 进阶
  - Docker
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-scheduling
goals:
  - 查询集群里的 Service DNS，并说明 NetworkPolicy 需要 CNI 支持。
---

“两个服务连不上”经常被一句网络故障带过。究竟是程序没监听、Service 没后端、DNS 查不到，还是策略拦了？先按流量路径拆开，比乱加一条 NetworkPolicy 更快。

## 名字解析与实际通信各走哪一层

集群网络模型允许 Pod 按集群规则通信；CNI 插件负责 Pod 网络。Service 提供稳定虚拟地址，CoreDNS 解析 Service 名称，入口 controller 处理外部流量，NetworkPolicy 表达 Pod 流量访问规则。职责不同，不能互相代替。

策略是否生效取决于 CNI。kind 默认网络配置不提供完整的 NetworkPolicy 执行；光创建对象可能成功，却没有过滤效果。生产要查插件的策略支持并实际测试。

## 从一次 DNS 查询开始检查

在课程 namespace 启动临时 BusyBox，查询 API 的完整 DNS 名，再检查 CoreDNS 和 Service 后端。不修改网络策略。首次使用会拉取小型调试镜像。

~~~powershell
kubectl -n container-course run dns-check --rm -i --restart=Never --image=busybox:1.37 -- nslookup course-api.container-course.svc.cluster.local
kubectl -n kube-system get pods -l k8s-app=kube-dns
kubectl -n container-course get service,endpointslice
~~~

## 让数据库只接收 API 的连接

在支持 NetworkPolicy 的 CNI 上，课程包的 labs/database-policy.yaml 可以限制数据库入站。默认 kind 的网络实现不能用来证明隔离有效，因此下面是有策略执行能力后的练习。它的关键配置是：

~~~yaml
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: course-api
      ports:
        - protocol: TCP
          port: 5432
~~~

外层 podSelector 选的是被保护的数据库；from 中的 podSelector 选的是允许访问的 API，两者范围都是本策略的命名空间。写反了，就会保护错对象。这里只限制入站，数据库的出站没有被这份策略隔离。

~~~powershell
kubectl apply -f labs/database-policy.yaml
kubectl -n container-course describe networkpolicy postgres-from-api
kubectl -n container-course run blocked-db-check --rm -i --restart=Never --image=postgres:17-alpine -- pg_isready -h postgres -p 5432 -t 3
~~~

这个临时 Pod 没有 app=course-api 标签，预期无法连接数据库。已有 API 的 /health/ready 应仍然成功。两个方向都验证，才说明“拦住该拦的、放行该放的”。若两边都成功，先查 CNI 是否支持策略，以及是否有其他策略放行了数据库；只看到资源创建成功不算验证。

规则是允许集合的叠加，不是按文件顺序逐条覆盖。一个更宽的策略仍可能放行这次连接。测试完成运行以下命令撤销本课新增的规则，名称明确限定到课程资源：

~~~powershell
kubectl -n container-course delete networkpolicy postgres-from-api
~~~

如果以后再加默认拒绝出站，要同时考虑 DNS 的 UDP/TCP 53、数据库端口及外部依赖。不要把一次入站练习直接扩成全命名空间双向拒绝。

## 从 Pod 网络配置继续查 DNS 与 Service 选择器

DNS 查询成功只能证明名称能解析。接下来核对 Pod 标签、数据库 Service 选择器和容器内 DNS 配置；如果 DNS 正确但 TCP 仍不通，再检查 NetworkPolicy 和 CNI 是否支持策略执行。

~~~powershell
kubectl -n container-course get pods --show-labels -o wide
kubectl -n container-course describe service postgres
kubectl -n container-course exec deployment/course-api -- cat /etc/resolv.conf
~~~

## 一次 HTTP 请求可以拆成五个可验证的点

假设 API 请求数据库：先确认调用方是否能查到 Service DNS；然后确认 Service 有 EndpointSlice 后端；之后检查目标端口、CNI 路径和 NetworkPolicy；最后才是数据库认证与 SQL。每个阶段的错误形态不同，抓住第一个失败点能缩小范围。

| 检查点 | 命令或证据 | 说明 |
|---|---|---|
| DNS | nslookup 服务名 | 只证明名字能解析 |
| Service 后端 | get endpointslice | 空后端通常是 selector 或 readiness |
| TCP 端口 | 临时客户端连接目标端口 | 通不通与 HTTP/数据库认证无关 |
| Policy/CNI | NetworkPolicy 与插件状态 | 创建策略对象不证明数据面执行 |
| 应用协议 | readiness、HTTP 响应、数据库日志 | 在连接后查认证和应用错误 |

CoreDNS 处理集群服务名，CNI 连接 Pod 网络，Service 维护稳定虚拟入口，Gateway/Ingress 处理外部请求。它们不是一个“集群网络组件”可以互相替换。

## 从临时客户端验证 DNS 和 HTTP

课程 API 同 namespace 有稳定服务名。用短期 BusyBox 查 DNS，再用 curl 镜像访问健康接口。临时 Pod 退出后会删除，不需要修改课程 Deployment。

~~~powershell
kubectl -n container-course run dns-lab --rm -i --restart=Never --image=busybox:1.37 -- nslookup course-api
kubectl -n container-course run http-lab --rm -i --restart=Never --image=curlimages/curl:8.12.1 -- http://course-api/health/ready
kubectl -n container-course get endpointslice -l kubernetes.io/service-name=course-api -o wide
~~~

DNS 输出返回 ClusterIP；curl 返回 ready 且数据库连接可用；EndpointSlice 应列出就绪 API Pod。若镜像拉取失败，先看临时 Pod Events，不能把这次失败直接归咎于网络策略。

## NetworkPolicy 为什么容易把 DNS 一起拦掉

NetworkPolicy 默认采用允许集合语义；当某 Pod 被某类方向策略隔离后，只能通过匹配规则的流量。默认拒绝 egress 后，如果没有允许访问 kube-dns 的 UDP/TCP 53，应用可能连服务名都解析不了。策略作用于 Pod 标签和 namespace 标签，维护标签权限也是策略边界的一部分。

课程数据库策略只限制入站到 5432，没有限制数据库出站，也没有为整个 namespace 建立默认拒绝。生产环境要先列出 DNS、入口、监控、数据库和外部 API 的必要流量，再分阶段启用，逐条测允许和拒绝场景。

## 参考资料

- [集群网络](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- [Service DNS](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
