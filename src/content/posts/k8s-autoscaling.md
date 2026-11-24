---
title: HPA 怎么扩容：先有 requests，再用压力把副本拉起来
date: '2026-11-24'
summary: 运行 CPU 消耗服务，安装 HPA，持续施压观察扩容，再停压观察稳定窗口与缩容。
series: Docker 与 Kubernetes
order: 48
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-observability
  - k8s-resources
goals:
  - 运行 CPU 消耗服务，安装 HPA，持续施压观察扩容，再停压观察稳定窗口与缩容。
---
“CPU 到 50% 就加副本”里，50% 到底相对什么？基于 CPU utilization 的 HPA 通常看实际 CPU 使用量相对 requests 的百分比。请求 100m，平均用了 50m，就是 50%，不是整台服务器 CPU 的 50%。

## 开始前必须有资源指标

上一课已安装 Metrics Server。先确认数据正常，否则 HPA 显示 `<unknown>` 时加再多压力也无法正确计算。

~~~bash
kubectl config use-context kind-course
kubectl top nodes
kubectl get apiservice v1beta1.metrics.k8s.io
~~~

HPA 调的是工作负载副本，不会自动买服务器。节点装不下新增 Pod 时仍会 Pending，节点自动扩缩容是另一套机制。内存泄漏也不会靠加副本得到根治。

## 创建一个有 CPU 工作量的演示服务

使用 Kubernetes 演示镜像；它处理请求时计算，便于观察 CPU 变化。它不是业务生产镜像。

~~~yaml file=autoscaling/app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cpu-web
  namespace: lab
spec:
  replicas: 1
  selector:
    matchLabels: {app: cpu-web}
  template:
    metadata:
      labels: {app: cpu-web}
    spec:
      containers:
        - name: app
          image: registry.k8s.io/hpa-example:latest
          ports:
            - {name: http, containerPort: 80}
          resources:
            requests: {cpu: 100m, memory: 32Mi}
            limits: {cpu: 500m, memory: 128Mi}
---
apiVersion: v1
kind: Service
metadata:
  name: cpu-web
  namespace: lab
spec:
  selector: {app: cpu-web}
  ports:
    - {port: 80, targetPort: http}
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cpu-web
  namespace: lab
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cpu-web
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 60
~~~

~~~bash
kubectl apply -f autoscaling/app.yaml
kubectl -n lab rollout status deployment/cpu-web --timeout=180s
kubectl -n lab get hpa cpu-web
kubectl -n lab describe hpa cpu-web
~~~

第一次要等待采样。教学镜像沿用它公开的 latest 标签，正式应用应记录镜像 digest；若新架构无法拉取，先看镜像平台和事件，不要误诊为 HPA 算法问题。

## 开四个临时客户端持续施压

~~~bash
for i in 1 2 3 4; do
  kubectl -n lab run "load-$i" --image=busybox:1.37 --labels=purpose=hpa-load --restart=Never -- sh -c 'while true; do wget -qO- http://cpu-web >/dev/null; done'
done
kubectl -n lab get hpa cpu-web -w
~~~

看 TARGETS 从低值上升，REPLICAS 可能逐步增加到上限。不同电脑和负载速度会影响结果，不保证固定几秒后恰好是 5。按 Ctrl+C 只停止观察，不会停止负载 Pod。

~~~bash
kubectl -n lab get deployment cpu-web
kubectl top pods -n lab -l app=cpu-web
kubectl -n lab describe hpa cpu-web
~~~

HPA 的基础估算类似“当前副本数 × 当前平均值 / 目标值”再取整，实际还有容忍区间、未就绪 Pod、缺失指标、稳定窗口和扩缩速率处理，不能只套一条乘法解释所有结果。

## 停压，观察为什么不会立刻缩回去

~~~bash
kubectl -n lab delete pod -l purpose=hpa-load
kubectl -n lab get hpa cpu-web -w
~~~

本例缩容稳定窗口设为 60 秒，加上指标采样与控制周期，通常需要再等一段时间。生产默认窗口和策略应按业务抖动调整，避免流量一波动就频繁增删实例。稳定窗口不是精确倒计时。

## 扩不起来时先查这些

`<unknown>` 查 Metrics Server、requests 和 HPA conditions；desired 增加但 Pod Pending 查节点容量；达到 maxReplicas 仍慢查瓶颈是否在数据库、锁或外部服务。HPA 接管后，持续 apply 带固定 replicas 的文件可能把规模改回去，GitOps 也要避免争抢这个字段。

完成观察后按 Ctrl+C，再清理：

~~~bash
kubectl -n lab delete pod -l purpose=hpa-load --ignore-not-found
kubectl delete -f autoscaling/app.yaml
~~~

自动扩容要结合压测和业务指标，不是给配置加一段 HPA 就完成容量规划。

## 继续阅读

- [HPA](https://kubernetes.io/zh-cn/docs/tasks/run-application/horizontal-pod-autoscale/)
- [HPA 实战](https://kubernetes.io/zh-cn/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/)
