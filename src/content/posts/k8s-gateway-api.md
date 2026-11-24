---
title: 用域名访问服务：Ingress、HTTPS 与 Gateway API
date: '2026-11-24'
summary: 安装入口控制器，实际配置域名路由和本地 HTTPS，再把同一服务接到 Gateway API。
series: Docker 与 Kubernetes
order: 40
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-service
  - k8s-helm-kustomize
goals:
  - 安装入口控制器，实际配置域名路由和本地 HTTPS，再把同一服务接到 Gateway API。
---
Service 能按端口把连接转给后端，但“访问 blog.test 打开网页，访问 api.test 进入接口”需要 HTTP 层路由。Ingress 描述路由规则，入口控制器负责执行。只创建 Ingress，不安装控制器，就像写了配置却没启动程序。

## 实验选择和访问路径

本课使用 Traefik 同时演示 Ingress 和 Gateway API。社区 ingress-nginx 已进入退休后的状态，不再作为新环境安装示例；Ingress 这个 Kubernetes API 仍然存在，不要把某个控制器的维护状态和 API 本身混淆。

请求路径是：电脑 → 本机端口转发 → Traefik → web Service 的后端。为了不引入云负载均衡，实验使用 ClusterIP 加 port-forward；正式环境再按平台配置 LoadBalancer、DNS 和公网证书。

## 安装控制器，先确认它真的运行

前置是 Helm 课，命令在实验包根目录、kind-course 执行。下载包 `gateway/values.yaml`：

~~~yaml file=gateway/values.yaml
service:
  type: ClusterIP
providers:
  kubernetesGateway:
    enabled: true
gateway:
  enabled: false
gatewayClass:
  enabled: false
~~~

~~~bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/standard-install.yaml
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm upgrade --install edge traefik/traefik --version 37.0.0 -n edge-system --create-namespace -f gateway/values.yaml --wait --timeout 5m
kubectl -n edge-system get deployments,services
kubectl get ingressclass
kubectl apply -f basics/deployment.yaml -f basics/service.yaml
kubectl -n lab rollout status deployment/web --timeout=120s
~~~

应看到 edge-traefik Deployment 就绪、edge-traefik Service，以及名为 edge-traefik 的 IngressClass。Gateway API CRD 先安装，控制器再启动，避免未知资源类型错误。固定版本便于复现实验，上生产前仍要按当前维护版本重新验证。

## 一个完整的 Ingress 域名规则

~~~yaml file=gateway/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web
  namespace: lab
spec:
  ingressClassName: edge-traefik
  rules:
    - host: blog.test
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port: {number: 80}
~~~

~~~bash
kubectl apply -f gateway/ingress.yaml
kubectl -n edge-system port-forward service/edge-traefik 8088:80 8443:443
~~~

保持转发终端运行，另开终端：

~~~bash
curl -i -H 'Host: blog.test' http://127.0.0.1:8088/
curl -i -H 'Host: unknown.test' http://127.0.0.1:8088/
~~~

第一个应是 Nginx 200，第二个通常是控制器 404，因为 Host 没匹配。`-H` 只在这次请求指定域名，不改电脑 DNS；也不用购买 blog.test。Prefix 按路径元素匹配，并不自动去掉 /api 前缀；需要重写时用对应控制器的功能，别凭空认为后端收到的是另一条路径。

## 加本地 HTTPS，不用跳过证书验证

需要 openssl：WSL Ubuntu 没有时运行 `sudo apt-get install openssl`。在临时目录生成只用于实验的自签名证书：

~~~bash
lab_tls=$(mktemp -d)
openssl req -x509 -nodes -newkey rsa:2048 -days 1 -keyout "$lab_tls/tls.key" -out "$lab_tls/tls.crt" -subj '/CN=blog.test' -addext 'subjectAltName=DNS:blog.test'
kubectl -n lab create secret tls web-tls --cert="$lab_tls/tls.crt" --key="$lab_tls/tls.key" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n lab patch ingress web --type=merge -p '{"spec":{"tls":[{"hosts":["blog.test"],"secretName":"web-tls"}]}}'
curl --cacert "$lab_tls/tls.crt" --resolve blog.test:8443:127.0.0.1 https://blog.test:8443/
~~~

`--resolve` 同时让请求使用正确域名、SNI 和本机地址；`--cacert` 明确信任这张实验自签名证书。不要养成所有 HTTPS 都加 `-k` 的习惯。Secret 要和 Ingress 在同一 namespace，证书 SAN 要匹配域名；HTTP 成功不代表 TLS 配置正确。

## Gateway API 把入口和业务路由分开

GatewayClass 代表控制器实现，Gateway 声明监听入口，HTTPRoute 描述业务路由。这里另用 gateway.test，避免与 Ingress 争同一路由。文件中监听 8000 对应 Traefik 容器内部 web 入口，外部 Service 仍是 80。

~~~yaml file=gateway/routes.yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: lab-traefik
spec:
  controllerName: traefik.io/gateway-controller
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: web-gateway
  namespace: lab
spec:
  gatewayClassName: lab-traefik
  listeners:
    - name: web
      protocol: HTTP
      port: 8000
      allowedRoutes:
        namespaces: {from: Same}
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: web-route
  namespace: lab
spec:
  parentRefs:
    - name: web-gateway
  hostnames: [gateway.test]
  rules:
    - matches:
        - path: {type: PathPrefix, value: /}
      backendRefs:
        - name: web
          port: 80
~~~

~~~bash
kubectl apply -f gateway/routes.yaml
kubectl -n lab get gateway web-gateway -o yaml
kubectl -n lab get httproute web-route -o yaml
curl -i -H 'Host: gateway.test' http://127.0.0.1:8088/
~~~

检查 status 的 Accepted、ResolvedRefs 等条件，而不是看到对象创建就算完成。跨 namespace 引用还需要 allowedRoutes 和适用的 ReferenceGrant，不能随便写别的 namespace 服务名就获得访问权。

## 404、503、证书错误各查哪层

404 先查 Host、path、IngressClass；503 查 Service 后端、端口和就绪状态；TLS 错误查 SAN、Secret 和客户端信任。控制器日志用 `kubectl -n edge-system logs deployment/edge-traefik --tail=50`，后端用 EndpointSlice 和 Pod 日志确认。别把所有问题都归给 DNS。

用完 Ctrl+C 停转发，然后清理本课资源：

~~~bash
kubectl delete -f gateway/routes.yaml -f gateway/ingress.yaml
kubectl -n lab delete secret web-tls
helm uninstall edge -n edge-system
kubectl delete namespace edge-system
~~~

保留共享 Gateway API CRD，其他控制器可能仍使用它们；最终删除整个 kind 练习集群时再统一清理。

## 继续阅读

- [Ingress](https://kubernetes.io/zh-cn/docs/concepts/services-networking/ingress/)
- [Gateway API 概念](https://gateway-api.sigs.k8s.io/concepts/api-overview/)
