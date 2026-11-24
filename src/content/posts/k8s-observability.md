---
title: 看见集群在做什么：Metrics Server、Prometheus 和 Grafana
date: '2026-11-24'
summary: 安装资源指标与监控栈，查询真实指标、检查采集目标，并验证一条测试告警。
series: Docker 与 Kubernetes
order: 47
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-helm-kustomize
  - k8s-troubleshooting
goals:
  - 安装资源指标与监控栈，查询真实指标、检查采集目标，并验证一条测试告警。
---
日志告诉你某次请求发生了什么，指标告诉你一段时间的趋势，事件记录调度、拉镜像等集群动作。三者都要看。Metrics Server 主要提供短期资源指标给 top 和 HPA，它不是长期监控数据库。

## 先让 kubectl top 有数据

在 kind-course 执行。固定安装 Metrics Server；kind 的 kubelet 证书在这套本地实验中可能不满足验证要求，所以只对这套学习集群加跳过 kubelet 证书校验的参数。

~~~bash
kubectl config use-context kind-course
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.8.0/components.yaml
kubectl -n kube-system patch deployment metrics-server --type=json -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
kubectl -n kube-system rollout status deployment/metrics-server --timeout=180s
kubectl get apiservice v1beta1.metrics.k8s.io
kubectl top nodes
kubectl top pods -n lab
~~~

第一次采样需要几十秒，刚就绪就查询可能返回指标尚不可用。APIService 应 Available=True。若仍失败，查 metrics-server 日志中的证书、连接和授权错误。生产环境应配置正确 kubelet 服务证书和访问网络，不能照搬 insecure 参数掩盖证书问题。

## Prometheus 抓指标，Grafana 把指标画出来

Prometheus 定时抓取目标的 `/metrics`，存为带标签的时间序列；Grafana 查询并展示；Alertmanager 处理告警分组和通知；kube-state-metrics 把 Deployment、Pod 等对象状态变成指标。应用的 QPS、业务错误率还要应用自身暴露，不能仅靠安装监控就自动获得全部业务指标。

本课约需额外几 GiB 内存，先卸载不用的入口或仓库实验。实验包监控 values 关闭单控制平面下不便直接采集的几个端点，避免把目标 DOWN 混成应用故障：

~~~yaml file=monitoring/values.yaml
grafana:
  adminPassword: local-grafana-only
  persistence:
    enabled: false
prometheus:
  prometheusSpec:
    retention: 6h
    resources:
      requests: {cpu: 100m, memory: 512Mi}
kubeControllerManager:
  enabled: false
kubeScheduler:
  enabled: false
kubeEtcd:
  enabled: false
kubeProxy:
  enabled: false
~~~

~~~bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install monitor prometheus-community/kube-prometheus-stack --version 79.0.0 -n monitoring --create-namespace -f monitoring/values.yaml --wait --timeout 10m
kubectl -n monitoring get pods
kubectl -n monitoring get services
kubectl -n monitoring port-forward service/monitor-kube-prometheus-st-prometheus 9090:9090
~~~

浏览器打开 `http://127.0.0.1:9090`。这是临时本机访问，不向公网开放。去 Targets 查看哪些采集目标 UP，再到查询页执行以下 PromQL：

~~~promql
up
sum(kube_pod_info{namespace="lab"})
kube_deployment_status_replicas_available{namespace="lab",deployment="web"}
sum(rate(container_cpu_usage_seconds_total{namespace="lab",container!="",container!="POD"}[5m]))
~~~

up 为 1 说明采集成功，不代表业务健康；CPU rate 需要积累样本，不能刚安装就期望完整五分钟曲线。高基数标签如用户 ID、订单号会撑爆时间序列数量，别把每个业务字段都加到指标标签里。

## 看 Grafana，再制造一个可控告警

另开终端执行：

~~~bash
kubectl -n monitoring port-forward service/monitor-grafana 3000:80
~~~

访问 `http://127.0.0.1:3000`，实验账号 admin，密码 local-grafana-only；在 Dashboards 中找 Kubernetes 工作负载看板。这个公开密码只用于本机临时练习，正式安装需要换成受保护凭证。

~~~yaml file=monitoring/alert.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: lesson-alert
  namespace: monitoring
  labels:
    release: monitor
spec:
  groups:
    - name: lesson
      rules:
        - alert: LessonAlwaysFiring
          expr: vector(1)
          for: 1m
          labels: {severity: info}
          annotations:
            summary: 本地告警链路实验，请在完成后删除
~~~

~~~bash
kubectl apply -f monitoring/alert.yaml
kubectl -n monitoring get prometheusrule lesson-alert
~~~

在 Prometheus Alerts 页应先 Pending 后 Firing。规则带 release=monitor，才能被本安装默认规则选择器选中。这里验证规则评估和告警状态，没有配置邮箱或聊天通知，不会给任何人发消息。

## 查不到数据，先确认采集链路

应用指标不存在就查应用是否暴露；目标 DOWN 就看 Targets 的 Last Error；ServiceMonitor 没生效就查 label selector、namespace 和命名端口。Grafana 空图不一定是 Grafana 坏了，先在 Prometheus 查相同指标。

用完停止两个转发终端，然后：

~~~bash
kubectl delete -f monitoring/alert.yaml
helm uninstall monitor -n monitoring
kubectl delete namespace monitoring
~~~

保留 Metrics Server 给下一课 HPA 使用。实验监控不持久化，卸载会丢历史；生产要另外决定保留周期、磁盘、备份和通知策略，不应照抄这个轻量 values。

## 继续阅读

- [资源指标管道](https://kubernetes.io/zh-cn/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/)
- [Prometheus 查询](https://prometheus.io/docs/prometheus/latest/querying/basics/)
