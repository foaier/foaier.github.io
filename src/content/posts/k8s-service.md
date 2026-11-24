---
title: Service：Pod 换了 IP，为什么网站还能访问
date: '2026-11-24'
summary: 亲手创建 ClusterIP 服务，用 DNS 和 EndpointSlice 检查后端，再制造一次标签不匹配故障。
series: Docker 与 Kubernetes
order: 31
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-deployment
goals:
  - 亲手创建 ClusterIP 服务，用 DNS 和 EndpointSlice 检查后端，再制造一次标签不匹配故障。
---
Deployment 能补回 Pod，但新 Pod 的 IP 不一定等于旧 IP。如果前端配置写死 Pod IP，后端重建后前端就找不到它。Service 给这组 Pod 一个稳定的访问入口。

## 先分清三个端口

Service 的 `port` 是客户端访问 Service 的端口；`targetPort` 是后端容器实际监听的端口；NodePort 类型还有 `nodePort`，是节点上对外提供入口的端口。它们可以不同。不要把电脑端口、Service 端口和容器端口都叫“应用端口”，排错时很容易查错地方。

Service 不会启动应用，也不会把不监听 80 的程序变成能监听 80。它依靠 selector 选择同一命名空间里的 Pod，再由 EndpointSlice 记录后端地址和就绪情况。

## 给两个 Nginx 建一个稳定入口

先确保上课的 Deployment 存在。实验包文件 `basics/service.yaml`：

~~~yaml file=basics/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: lab
spec:
  selector:
    app: web
  ports:
    - name: http
      port: 80
      targetPort: http
  type: ClusterIP
~~~

`targetPort: http` 引用容器端口的名字；上课 Deployment 已定义名为 http 的 80 端口。用名字可以在修改容器端口号时少改一处配置。

~~~bash
kubectl apply -f basics/deployment.yaml -f basics/service.yaml
kubectl -n lab rollout status deployment/web --timeout=120s
kubectl -n lab get service web
kubectl -n lab get endpointslices -l kubernetes.io/service-name=web -o wide
kubectl -n lab run client --image=busybox:1.37 --restart=Never -- sleep 86400
kubectl -n lab wait --for=condition=Ready pod/client --timeout=120s
kubectl -n lab exec client -- wget -qO- http://web
~~~

最后应返回 Nginx HTML。client 是临时工具 Pod，位于同一 namespace，所以 `web` 就能解析。跨 namespace 使用 `web.lab`，完整名字是 `web.lab.svc.cluster.local`。ClusterIP 一般只能从集群内部访问，不要在电脑浏览器直接输入它后断言 Service 坏了。

## DNS 和负载均衡各做哪件事

~~~bash
kubectl -n lab exec client -- nslookup web.lab.svc.cluster.local
kubectl -n lab get pods -l app=web -o wide
kubectl -n lab get service web -o wide
~~~

普通 ClusterIP Service 的名字通常解析到 Service IP。数据包再由节点上的 Service 实现转到后端 Pod。调度器不参与每一次 HTTP 请求，CoreDNS 也不是 HTTP 反向代理。TCP 连接复用可能让连续请求一直落在同一个后端，不要拿“连续两次返回一样”判断负载均衡失效。

## 故意把标签写错，练一次定位

~~~bash
kubectl -n lab patch service web --type=merge -p '{"spec":{"selector":{"app":"missing"}}}'
kubectl -n lab get endpointslices -l kubernetes.io/service-name=web -o yaml
kubectl -n lab exec client -- wget -T 3 -qO- http://web
~~~

最后一条应失败，可能连接拒绝或超时。Service 和 DNS 仍存在，但可用后端为空。修复不是重启 DNS，而是把选择器改回来：

~~~bash
kubectl apply -f basics/service.yaml
kubectl -n lab get endpointslices -l kubernetes.io/service-name=web
kubectl -n lab exec client -- wget -T 3 -qO- http://web
~~~

等待 EndpointSlice 出现两个就绪地址后再访问。排错顺序是：Service 是否存在、selector 是否匹配、后端是否 Ready、targetPort 是否指向应用监听端口。

## 其他 Service 类型什么时候用

| 类型 | 用途 | 本机实验里要注意 |
| --- | --- | --- |
| ClusterIP | 集群内部稳定访问 | 最常见的默认值 |
| NodePort | 通过节点 IP 和固定端口进入 | kind 节点在 Docker 内，宿主机未必能直接访问节点 IP |
| LoadBalancer | 请求平台创建外部负载均衡入口 | 没有云控制器或本地实现时 EXTERNAL-IP 会 Pending |
| ExternalName | 把服务名映射到另一个 DNS 名 | 只是 DNS 别名，不代理请求，HTTP Host 和证书仍要匹配 |
| Headless | `clusterIP: None`，直接发现后端地址 | 常用于 StatefulSet 成员发现，并非第五种 type |

Service 的默认转发以连接为单位，也不按 URL 路径区分网页和 API；域名、路径和 HTTPS 要在入口控制器一课处理。

## 在电脑访问，以及本课清理

~~~bash
kubectl -n lab delete pod client
kubectl -n lab port-forward service/web 8080:80
~~~

另一终端 `curl -I http://127.0.0.1:8080` 应返回 200。port-forward 到 Service 实际会选择一个 Pod，并不测试完整的 Service 数据转发链路，因此前面的集群内 wget 不能省。用完按 Ctrl+C，保留 web Deployment 和 Service。

## 继续阅读

- [Service](https://kubernetes.io/zh-cn/docs/concepts/services-networking/service/)
- [EndpointSlice](https://kubernetes.io/zh-cn/docs/concepts/services-networking/endpoint-slices/)
