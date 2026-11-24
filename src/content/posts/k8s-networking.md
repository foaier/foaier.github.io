---
title: "从 Pod 连不上开始：集群网络、CoreDNS 和 NetworkPolicy"
date: "2026-11-24"
summary: "分开检查 Pod 网络、Service DNS、入口路由和网络策略。"
series: "Docker 与 Kubernetes"
order: 35
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-scheduling"]
goals: ["查询集群里的 Service DNS，并说明 NetworkPolicy 需要 CNI 支持。"]
---

“两个服务连不上”经常被一句网络故障带过。究竟是程序没监听、Service 没后端、DNS 查不到，还是策略拦了？先按流量路径拆开，比乱加一条 NetworkPolicy 更快。

## 概念讲透：它负责什么，不负责什么

Kubernetes 网络通常由 CNI 给 Pod 配地址并实现跨节点连通，Service 提供稳定虚拟地址，CoreDNS 负责服务名解析，NetworkPolicy 描述允许哪些 Pod/方向流量。策略是否真正执行取决于网络插件。DNS 解析成功只说明名字找到地址，不保证路由、端口监听、TLS、应用认证都正常。

## 运行过程拆解：从输入到结果

一次集群内请求可以按路径拆分：调用方解析 Service DNS，得到 ClusterIP；Service 转发到就绪 EndpointSlice；CNI 负责 Pod 间网络；NetworkPolicy 可能允许或丢弃流量；最后应用完成 TLS、认证和协议处理。每层的成功信号不同。排查时从 name resolution 到 TCP，再到 HTTP 状态逐步测试，不要把“能 ping”当成应用端口正常。

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

## 怎么确认做对了

DNS 返回 course-api 的 ClusterIP，CoreDNS Pod 正常，EndpointSlice 有后端。nslookup 成功只验证解析，不能证明 HTTP 端口或数据库请求正常。

## 案例推演

API 能解析 postgres，但 TCP 连接超时。先用同 namespace 的诊断 Pod 解析完整服务名，再测试 5432 端口；同时看 Service 的 EndpointSlice、数据库监听、NetworkPolicy 与 CNI 状态。若 DNS 失败查 CoreDNS 和搜索域；若能连上却认证失败，问题在账号或连接配置，不是网络。

## 留一个小练习

画出 API 到 postgres 的 DNS 与 Service 路径，分别用 nslookup 和 `/health/ready` 验证解析与应用连库，比较两者覆盖的环节。

## 没跑通时先查什么

先查两端 Pod Ready，再看 Service selector、EndpointSlice、端口、DNS、CNI 和 NetworkPolicy。策略测试先选非生产 namespace，并准备撤销方式。

DNS 缓存、端口协议以及 NetworkPolicy 对 DNS 出站的限制都可能让排查更绕。刚添加默认拒绝策略时，先明确允许 CoreDNS、数据库和入口等必要通信，再分批启用并用真实请求验证，不要在整个 namespace 一次性封锁所有方向。

NetworkPolicy 选择的是 Pod 标签，写得过宽会把本来不相关的容器圈到同一规则里。给生产服务设计策略时也要检查 namespace 标签是谁能改，避免授权边界因标签编辑权限而失效。

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

## 生产里怎么用、怎么排障

NetworkPolicy 新规则可能默认拒绝 DNS、监控或数据库流量，造成上线后多个依赖同时不可达。先在测试 namespace 按允许列表逐条加策略并观察日志，验证策略插件支持 ingress/egress。抓包和诊断容器要经过授权，生产网络上的请求可能包含敏感数据。

## 参考资料

- [集群网络](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- [Service DNS](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
