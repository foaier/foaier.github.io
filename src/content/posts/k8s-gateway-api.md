---
title: 集群里的服务怎么给用户访问？从 Service 到 Gateway API
date: '2026-11-24'
summary: 厘清 ClusterIP、负载均衡器与 HTTP 路由，并先检查集群有没有 Gateway 实现。
series: Docker 与 Kubernetes
order: 31
tags:
  - Kubernetes 进阶
  - Docker
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-workloads
goals:
  - 分辨内部服务和集群入口，并说明 Gateway API 资源为什么不能单独处理流量。
---

在 kind 里 port-forward 很方便，但它是你电脑与某个服务间的临时调试通道，不是网站正式上线的方法。对外提供 HTTP，通常还需要入口实现、DNS、证书和可达的网络。

## 从内部 Service 到外部入口

Service 负责集群内稳定地址；云厂商的 LoadBalancer Service 通常对接云负载均衡；Gateway API 把入口拆为基础设施拥有的 GatewayClass/Gateway 和应用团队维护的 HTTPRoute。Kubernetes 约定了这些资源的结构，不会因此替你安装能处理流量的 controller。

Ingress 仍可用于已有受支持的控制器，但其 API 已冻结；Ingress NGINX 已于 2026 年退休，不应再作为新项目的默认实现。新平台应评估受维护的 Gateway API controller 或其他仍受支持的入口产品。

## 先确认集群有没有入口实现

先盘点集群有没有入口实现。kind 默认没有对公网的入口；课程 API 继续通过 port-forward 访问。云集群还需核对公网资源与费用，不要在不知情的集群直接创建 LoadBalancer。

~~~powershell
kubectl config current-context
kubectl get gatewayclass
kubectl get gateways.gateway.networking.k8s.io -A
kubectl get ingressclass,ingress -A
~~~

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

## 确认路由引用的 Gateway 和后端 Service

默认 kind 没有 Gateway 控制器。只有安装了 CRD 和控制器的练习集群才运行这些查询；缺少 GatewayClass 或 HTTPRoute 资源时，先准备实现，不要误以为 apply 一条路由就会自动创建入口。

~~~powershell
kubectl explain httproute.spec --api-version=gateway.networking.k8s.io/v1
kubectl -n container-course get gateway,httproute -o wide
kubectl -n container-course get endpointslice -l kubernetes.io/service-name=course-api -o wide
~~~

## 参考资料

- [Gateway API 概念](https://kubernetes.io/docs/concepts/services-networking/gateway/)
- [Gateway API 实现](https://gateway-api.sigs.k8s.io/)
- [Ingress 冻结说明](https://kubernetes.io/docs/concepts/services-networking/ingress/)
