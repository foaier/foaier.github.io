---
title: Pod 删除后日志去哪了：用 Loki 和 Alloy 集中查日志
date: '2026-11-24'
summary: 安装一个本地日志存储和采集器，从 Nginx 产生请求，再通过 LogQL 查询已采集记录。
series: Docker 与 Kubernetes
order: 49
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-helm-kustomize
  - k8s-observability
goals:
  - 安装一个本地日志存储和采集器，从 Nginx 产生请求，再通过 LogQL 查询已采集记录。
---
`kubectl logs` 很适合查眼前问题，但 Pod 被删除、节点日志轮转后，记录不保证还在。集中日志把记录从工作负载里搬出去，再按时间、namespace 和 Pod 查询。它和 Prometheus 指标存储不是同一件事。

## 三个角色先分清

应用把日志写到 stdout/stderr；采集器读取记录并附加标签；日志存储接收和查询。这里用 Alloy 通过 Kubernetes API 采集 lab 的 Pod 日志，用 Loki 保存，先通过 HTTP API 查询，不要求先安装 Grafana。真实大集群需要根据规模选择节点采集和分片，不能把本课单采集器无限放大。

## 本地 Loki 的完整配置

实验包 `logging/loki.yaml` 使用单实例和 emptyDir，目的是验证链路，删除部署会丢日志。没有开放公网，也没有配置生产身份认证。

~~~yaml file=logging/loki.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: logging
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: logging
data:
  config.yaml: |
    auth_enabled: false
    server:
      http_listen_port: 3100
    common:
      path_prefix: /loki
      replication_factor: 1
      ring:
        kvstore:
          store: inmemory
      storage:
        filesystem:
          chunks_directory: /loki/chunks
          rules_directory: /loki/rules
    schema_config:
      configs:
        - from: "2024-01-01"
          store: tsdb
          object_store: filesystem
          schema: v13
          index:
            prefix: index_
            period: 24h
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
  namespace: logging
spec:
  replicas: 1
  selector:
    matchLabels: {app: loki}
  template:
    metadata:
      labels: {app: loki}
    spec:
      securityContext:
        runAsUser: 10001
        runAsGroup: 10001
        fsGroup: 10001
      containers:
        - name: loki
          image: grafana/loki:3.5.7
          args: ["-config.file=/etc/loki/config.yaml"]
          ports:
            - {name: http, containerPort: 3100}
          readinessProbe:
            httpGet: {path: /ready, port: http}
            initialDelaySeconds: 10
          resources:
            requests: {cpu: 100m, memory: 256Mi}
            limits: {memory: 1Gi}
          volumeMounts:
            - {name: config, mountPath: /etc/loki}
            - {name: data, mountPath: /loki}
      volumes:
        - name: config
          configMap: {name: loki-config}
        - name: data
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: loki
  namespace: logging
spec:
  selector: {app: loki}
  ports:
    - {port: 3100, targetPort: http}
~~~

~~~bash
kubectl apply -f logging/loki.yaml
kubectl -n logging rollout status deployment/loki --timeout=180s
~~~

schema 的 from 是数据 schema 生效日期，早于当前日期；不要每次重启随意改。replication_factor=1 对应单实例，不能宣称高可用。emptyDir 也没有配置持续保留策略，实验结束要及时清理。

## Alloy 发现 Pod，添加可查询标签

~~~yaml file=logging/alloy-values.yaml
controller:
  type: deployment
  replicas: 1
alloy:
  configMap:
    content: |
      discovery.kubernetes "pods" {
        role = "pod"
        namespaces {
          names = ["lab"]
        }
      }
      discovery.relabel "pods" {
        targets = discovery.kubernetes.pods.targets
        rule {
          source_labels = ["__meta_kubernetes_namespace"]
          target_label = "namespace"
        }
        rule {
          source_labels = ["__meta_kubernetes_pod_name"]
          target_label = "pod"
        }
        rule {
          source_labels = ["__meta_kubernetes_pod_container_name"]
          target_label = "container"
        }
      }
      loki.source.kubernetes "pods" {
        targets = discovery.relabel.pods.output
        forward_to = [loki.write.local.receiver]
      }
      loki.write "local" {
        endpoint {
          url = "http://loki.logging.svc.cluster.local:3100/loki/api/v1/push"
        }
      }
~~~

~~~bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm upgrade --install collector grafana/alloy --version 1.5.2 -n logging -f logging/alloy-values.yaml --wait --timeout 5m
kubectl -n logging get pods
kubectl -n logging logs deployment/collector-alloy --tail=30
~~~

Chart 创建采集所需的 ServiceAccount 与权限；只发现 lab 日志。查询标签选 namespace、服务和容器等稳定字段，别把每条日志不同的 request ID 直接做 Loki 索引标签，避免流数量过高。request ID 可保留在日志正文里筛选。

## 产生一条能认出来的请求

~~~bash
kubectl apply -f basics/deployment.yaml -f basics/service.yaml
kubectl -n lab rollout status deployment/web --timeout=120s
kubectl -n lab run log-client --image=busybox:1.37 --restart=Never -- sh -c 'wget -S -O- http://web/lesson-log-marker || true'
kubectl -n lab logs -l app=web --tail=10
kubectl -n logging port-forward service/loki 3100:3100
~~~

请求路径不存在，所以 Nginx 返回 404 是预期；我们用 lesson-log-marker 查这次访问日志。保持转发终端，另开终端查询：

~~~bash
curl -fsSG http://127.0.0.1:3100/loki/api/v1/query_range --data-urlencode 'query={namespace="lab"} |= "lesson-log-marker"' --data-urlencode 'since=10m' --data-urlencode 'limit=20'
~~~

应返回 status success，result 中有带 Pod 标签的日志行。等待几秒再查询，让采集器有机会发送；空结果先看时间窗口、标签、Alloy 日志和 Loki 是否 ready。要接 Grafana，可把 Loki 数据源 URL 设为 `http://loki.logging.svc.cluster.local:3100`，然后在 Explore 使用同一条 LogQL。

## 验证集中日志的意义

确认查询到记录后，滚动重启 web，等新 Pod 就绪，再执行刚才的查询。新 Pod 名字变了，旧记录仍由 Loki 返回；这是记录被采集后的效果，并不保证“Pod 一删除，最后一毫秒的日志必然全部送达”。采集延迟、缓冲和故障恢复策略仍影响丢失窗口。

~~~bash
kubectl -n lab rollout restart deployment/web
kubectl -n lab rollout status deployment/web --timeout=120s
kubectl -n lab delete pod log-client
~~~

正式日志还应约定结构、时间戳、级别、request ID、脱敏和保留期。不要把 Token、密码、身份证号完整打进日志，再寄希望于日志平台帮你隐藏。

停止转发后清理：`helm uninstall collector -n logging`，再 `kubectl delete -f logging/loki.yaml`。Loki 的实验日志随 namespace 删除，不是持久化归档。

## 继续阅读

- [集群日志架构](https://kubernetes.io/zh-cn/docs/concepts/cluster-administration/logging/)
- [LogQL](https://grafana.com/docs/loki/latest/query/)
