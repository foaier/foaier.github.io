---
title: Pod 之间怎么通信：CNI、DNS 与 NetworkPolicy
date: '2026-11-24'
summary: 在独立 Calico 练习集群中观察网络连通，再用允许和拒绝两组客户端验证网络策略真正生效。
series: Docker 与 Kubernetes
order: 44
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-service
  - k8s-scheduling
goals:
  - 在独立 Calico 练习集群中观察网络连通，再用允许和拒绝两组客户端验证网络策略真正生效。
---
Pod 网络、Service 转发和 DNS 是不同层。CNI 插件负责为 Pod 建立网络；Service 实现负责稳定入口到后端的转发；CoreDNS 负责名字解析。应用访问失败时，把这三层分开检查比反复重启 Pod 有用。

## 同节点与跨节点有什么不同

同 Pod 的容器共享网络空间；不同 Pod 各有 IP。同节点流量可经虚拟接口和本机网络转发，跨节点则需要底层路由或封装。VXLAN、IP-in-IP 是封装方式，BGP 可以用于路由分发，它们不是三个 Kubernetes Service 类型。

不同 CNI 对 NetworkPolicy、加密、可观测性和 Service 替代实现支持不同。默认 kindnet 不执行 NetworkPolicy，创建一个策略对象成功也不证明流量已经被隔离。

## 单独建一套能执行策略的集群

不在已有 course 集群上临时替换 CNI。使用下载包文件，新建 `course-net`；同时运行两套集群需要额外内存，资源紧张时先停止其他重型实验。

~~~yaml file=network/kind.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: true
  podSubnet: 192.168.0.0/16
nodes:
  - role: control-plane
  - role: worker
  - role: worker
~~~

~~~bash
kind create cluster --name course-net --image kindest/node:v1.35.0 --config network/kind.yaml
kubectl config use-context kind-course-net
kubectl apply --server-side -f https://raw.githubusercontent.com/projectcalico/calico/v3.33.1/manifests/operator-crds.yaml
kubectl apply --server-side -f https://raw.githubusercontent.com/projectcalico/calico/v3.33.1/manifests/tigera-operator.yaml
kubectl wait --for=condition=Established crd/installations.operator.tigera.io --timeout=60s
kubectl apply -f network/installation.yaml
kubectl -n calico-system wait --for=create daemonset/calico-node --timeout=180s
kubectl -n calico-system rollout status daemonset/calico-node --timeout=300s
kubectl wait --for=condition=Ready nodes --all --timeout=300s
kubectl create namespace net-lab
~~~

下载包中的 `network/installation.yaml` 如下，明确使用 VXLAN，避免安装后再修改已创建的 IP 池：

~~~yaml file=network/installation.yaml
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  calicoNetwork:
    bgp: Disabled
    ipPools:
      - cidr: 192.168.0.0/16
        blockSize: 26
        encapsulation: VXLAN
        natOutgoing: Enabled
        nodeSelector: all()
~~~

安装网络前节点 NotReady 是预期现象。等所有节点 Ready 再继续。kind 的 podSubnet 和这里的 cidr 保持一致；如果自己的 LAN/VPN 也使用 192.168.0.0/16，需要事先选不冲突的网段并同时修改两份文件。用 `kubectl get ippools -o yaml` 确认实际 IP 池，不能只根据安装命令猜测配置已生效。

## 准备服务端和两个客户端

~~~bash
kubectl -n net-lab create deployment backend --image=nginx:1.28-alpine
kubectl -n net-lab expose deployment backend --port=80
kubectl -n net-lab rollout status deployment/backend --timeout=120s
kubectl -n net-lab run allowed --image=busybox:1.37 --labels=access=web --restart=Never -- sleep 86400
kubectl -n net-lab run blocked --image=busybox:1.37 --restart=Never -- sleep 86400
kubectl -n net-lab wait --for=condition=Ready pod/allowed pod/blocked --timeout=120s
kubectl -n net-lab exec allowed -- wget -T 3 -qO- http://backend
kubectl -n net-lab exec blocked -- wget -T 3 -qO- http://backend
~~~

两者都应成功。先验证无策略时网络正常，否则之后的超时无法证明是策略起作用。

## 只允许带指定标签的客户端

~~~yaml file=network/policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-ingress
  namespace: net-lab
spec:
  podSelector:
    matchLabels: {app: backend}
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels: {access: web}
      ports:
        - protocol: TCP
          port: 80
~~~

~~~bash
kubectl apply -f network/policy.yaml
kubectl -n net-lab exec allowed -- wget -T 3 -qO- http://backend
kubectl -n net-lab exec blocked -- wget -T 3 -qO- http://backend
kubectl -n net-lab describe networkpolicy backend-ingress
~~~

allowed 成功、blocked 超时才符合预期。策略选择 backend 作为受保护对象，只限制它的入站；from 中的 podSelector 默认选同一 namespace。没有限制客户端出站，也没有关闭 DNS。

## 为什么多条策略越写反而越开放

NetworkPolicy 的允许规则是叠加的，不是防火墙从上到下第一条匹配。某条策略允许的流量，不会被另一条普通策略“拒绝规则”覆盖。客户端出站与服务端入站若都受限制，需要两端均允许。

同一个 from 元素里同时放 namespaceSelector 和 podSelector 表示同时满足；写成两个列表元素通常是二者任一满足。出站默认拒绝时还要单独允许实际 DNS 的 UDP/TCP 53，集群使用 NodeLocal DNS 时地址也可能不同，不能盲抄一条 CoreDNS IP。

## 改标签验证恢复，再切回主集群

~~~bash
kubectl -n net-lab label pod blocked access=web
kubectl -n net-lab exec blocked -- wget -T 3 -qO- http://backend
kubectl delete namespace net-lab
kind delete cluster --name course-net
kubectl config use-context kind-course
kubectl config current-context
~~~

删除的只是专用网络实验集群；最后输出必须是 kind-course。生产策略还要考虑节点流量、NAT、CNI 实现细节和连接跟踪；不要把一次本地 wget 实验扩大成所有流量都已被完整隔离的结论。

## 继续阅读

- [Kubernetes 网络模型](https://kubernetes.io/zh-cn/docs/concepts/cluster-administration/networking/)
- [NetworkPolicy](https://kubernetes.io/zh-cn/docs/concepts/services-networking/network-policies/)
