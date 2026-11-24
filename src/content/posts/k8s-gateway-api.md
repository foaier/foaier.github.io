---
title: "集群里的服务怎么给用户访问？从 Service 到 Gateway API"
date: "2026-11-24"
summary: "厘清 ClusterIP、负载均衡器与 HTTP 路由，并先检查集群有没有 Gateway 实现。"
series: "Docker 与 Kubernetes"
order: 31
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-workloads"]
goals: ["分辨内部服务和集群入口，并说明 Gateway API 资源为什么不能单独处理流量。"]
---

在 kind 里 port-forward 很方便，但它是你电脑与某个服务间的临时调试通道，不是网站正式上线的方法。对外提供 HTTP，通常还需要入口实现、DNS、证书和可达的网络。

## 概念讲透：它负责什么，不负责什么

Service 解决集群内部稳定寻址，Gateway API 把集群入口、监听器和 HTTP 路由拆成不同对象，由 Gateway Controller 实际配置代理或负载均衡器。安装 CRD 和写 HTTPRoute 不会凭空产生入口实现；GatewayClass、实现控制器、地址分配、DNS 和 TLS 证书都要齐备。

## 运行过程拆解：从输入到结果

控制器先观察 GatewayClass，再根据 Gateway listener 创建入口实现；HTTPRoute 通过 parentRefs 请求挂到 listener，并受主机名、协议、端口和引用策略约束。控制器把被接受的规则转成数据面配置，返回 status conditions。因而检查顺序应从实现和 listener 到路由接受状态、入口地址、DNS/TLS、后端 EndpointSlice，而不是看到 YAML 存在就认为流量已通。

## 从内部 Service 到外部入口

Service 负责集群内稳定地址；云厂商的 LoadBalancer Service 通常对接云负载均衡；Gateway API 把入口拆为基础设施拥有的 GatewayClass/Gateway 和应用团队维护的 HTTPRoute。Kubernetes 约定了这些资源的结构，不会因此替你安装能处理流量的 controller。

Ingress 仍可用，但其 API 已冻结，不再增加功能；新平台设计可评估 Gateway API。入口 controller 需要由环境运营方选择和维护。

## 先确认集群有没有入口实现

先盘点集群有没有入口实现。kind 默认没有对公网的入口；课程 API 继续通过 port-forward 访问。云集群还需核对公网资源与费用，不要在不知情的集群直接创建 LoadBalancer。

~~~powershell
kubectl config current-context
kubectl get gatewayclass
kubectl get gateways.gateway.networking.k8s.io -A
kubectl get ingressclass,ingress -A
~~~

## 怎么确认做对了

kind 通常没有 GatewayClass，或显示 No resources found。这说明没有安装入口 controller，不代表 API 服务本身坏了。如果 Gateway 的 Programmed 状态为空，检查 Conditions 和所用 controller 文档。

## 案例推演

HTTPRoute 已成功 apply，浏览器仍打不开站点。先看 GatewayClass 是否有控制器接管，再看 Gateway 和 Route 的 status conditions、listener 主机名与父子引用授权，然后检查入口 IP/DNS、证书和后端 Service。对象存在不代表控制器接受路由，更不代表外网已经能到达。

## 留一个小练习

画出请求经过 DNS、入口负载均衡器、Gateway/HTTPRoute、Service、就绪 API Pod 的路径。要实际练习部署，先选择支持 Gateway API 的实现，并按它的官方教程安装到明确的本地集群。

## 没跑通时先查什么

外部域名打不开时，先用内部 Service 测试，再逐层查 Route 的 Accepted/ResolvedRefs、Gateway Programmed、Service endpoints、DNS 与防火墙。创建 HTTPRoute 不会替你购买证书或域名。

TLS 可以在入口终止，也可能通过 Gateway 与后端间再加密；具体能力取决于控制器和证书提供方式。上线时要画出证书由谁更新、过期前谁收到告警、域名切换如何验证，而不是把“配置了 HTTPS”当作一次性工作。

## 把一条路由真正读懂

假设平台已经提供一个名为 course-gateway 的 Gateway，就在 container-course 命名空间，开放 HTTP 监听并允许本命名空间的路由挂载。下面这份保存为 course-route.yaml。它不创建负载均衡器，只描述“什么请求去哪个服务”。

~~~yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: course-api
  namespace: container-course
spec:
  parentRefs:
    - name: course-gateway
  hostnames:
    - course.example.test
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: course-api
          port: 80
~~~

注意这里的 80 是 Service port，API 容器实际监听的 8080 由 Service targetPort 衔接。parentRefs 对不上现有 Gateway，路由不会凭空创建一个入口。Gateway API 需要安装 CRD 和控制器，默认 kind 尚不满足这个前提；先照[官方安装指南](https://gateway-api.sigs.k8s.io/guides/)选择兼容实现。

已有入口的练习集群再执行：

~~~powershell
kubectl apply -f course-route.yaml
kubectl -n container-course get httproute course-api -o yaml
kubectl -n container-course get gateway course-gateway -o yaml
~~~

检查 Route 的 status.parents：Accepted 为 True 表示父入口接纳了路由，ResolvedRefs 为 True 表示后端等引用解析成功。Gateway 的 Programmed 为 True 表示控制器完成了配置；这三项通过后还要发请求。如果没有安装 CRD，错误会是找不到 HTTPRoute 资源类型，而不是返回网页 404。

从入口实现提供的可达地址发请求，同时设置 Host 为 course.example.test。Windows 用 curl.exe 可以避开旧 PowerShell 中 curl 别名差异。域名只是练习匹配条件，不能假装它已在公网解析。只请求入口 IP 却不带正确 Host，常常命中默认路由，这时 API 本身明明健康，用户看到的仍是 404。

TLS 终止后到后端是否继续加密、跨命名空间是否允许引用、证书如何更新，都是额外配置。先把一条 HTTP 路由走通，再逐项增加，故障范围才不会一次扩大到整条链路。

## 生产里怎么用、怎么排障

生产入口要明确 TLS 在哪里终止、证书如何轮换、哪些团队能改公共路由、限流和超时由谁负责。控制器升级可能改变路由行为，需做兼容验证和灰度。公网入口要配防火墙、WAF 或云安全组；服务内部认证不能因为经过网关就省略。

## 参考资料

- [Gateway API 概念](https://kubernetes.io/docs/concepts/services-networking/gateway/)
- [Gateway API 实现](https://gateway-api.sigs.k8s.io/)
- [Ingress 冻结说明](https://kubernetes.io/docs/concepts/services-networking/ingress/)
