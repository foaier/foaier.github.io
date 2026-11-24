---
title: 探针：进程还活着，为什么服务不能接请求
date: '2026-11-24'
summary: 对同一个网页实验 startup、readiness 和 liveness，主动制造未就绪与重启，并观察后端变化。
series: Docker 与 Kubernetes
order: 33
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-config-secrets
  - k8s-service
goals:
  - 对同一个网页实验 startup、readiness 和 liveness，主动制造未就绪与重启，并观察后端变化。
---
进程存在，不代表业务能用。程序可能还在加载数据，也可能卡死，或者暂时失去数据库连接。探针让 Kubernetes 按不同目的检查容器，不用把所有故障都用“重启”处理。

## 三种探针分别决定什么

| 探针 | 失败后主要动作 | 适合检查什么 |
| --- | --- | --- |
| startupProbe | 超过阈值后重启容器；成功前暂停另外两种探针 | 慢启动阶段是否完成 |
| readinessProbe | 将容器标为未就绪，通常停止向它分配新的 Service 流量 | 是否可以接业务请求 |
| livenessProbe | 超过阈值后按重启策略重启容器 | 进程是否进入无法自行恢复的状态 |

数据库短暂掉线就让所有 API liveness 失败，会引发重启风暴。依赖故障常适合反映在 readiness，liveness 尽量关注进程自身。HTTP、TCP、exec 和 gRPC 探测各有适用范围；TCP 连得上，只说明端口接受连接。

## 启动一个可手动控制健康状态的网页

~~~yaml file=health/probes.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: probe-web
  namespace: lab
spec:
  replicas: 1
  selector:
    matchLabels: {app: probe-web}
  template:
    metadata:
      labels: {app: probe-web}
    spec:
      containers:
        - name: nginx
          image: nginx:1.28-alpine
          command: ["sh", "-c"]
          args: ["touch /tmp/ready /tmp/alive; exec nginx -g 'daemon off;'"]
          ports:
            - {name: http, containerPort: 80}
          startupProbe:
            httpGet: {path: /, port: http}
            periodSeconds: 2
            failureThreshold: 30
          readinessProbe:
            exec: {command: ["test", "-f", "/tmp/ready"]}
            periodSeconds: 2
            failureThreshold: 1
          livenessProbe:
            exec: {command: ["test", "-f", "/tmp/alive"]}
            periodSeconds: 2
            failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: probe-web
  namespace: lab
spec:
  selector: {app: probe-web}
  ports:
    - {port: 80, targetPort: http}
~~~

~~~bash
kubectl apply -f health/probes.yaml
kubectl -n lab rollout status deployment/probe-web --timeout=180s
kubectl -n lab get pods -l app=probe-web
~~~

`periodSeconds` 是检查间隔；`failureThreshold` 是连续失败次数；没有写的 timeoutSeconds 默认 1 秒。启动探针在这里给出约一分钟的失败预算，不是严格保证总启动时间恰好等于两数相乘。exec 检查的是文件是否存在，不是生产推荐的健康接口，只是让现象可控。

## 删除 ready 文件，看未就绪但不重启

~~~bash
kubectl -n lab exec deployment/probe-web -- rm /tmp/ready
kubectl -n lab get pods -l app=probe-web -w
~~~

几秒后看到 `0/1 Running`，RESTARTS 不应因为 readiness 失败而增加。按 Ctrl+C，再检查后端条件：

~~~bash
kubectl -n lab get endpointslices -l kubernetes.io/service-name=probe-web -o yaml
kubectl -n lab exec deployment/probe-web -- touch /tmp/ready
kubectl -n lab rollout status deployment/probe-web --timeout=120s
~~~

未就绪时 EndpointSlice 的地址可能仍在，但 `conditions.ready` 是 false，不要仅凭地址存在就说流量会转过去。恢复文件后等待它重新 Ready。

## 删除 alive 文件，看容器重启

~~~bash
kubectl -n lab exec deployment/probe-web -- rm /tmp/alive
kubectl -n lab get pods -l app=probe-web -w
~~~

经过数次失败和退出过程后 RESTARTS 增加；启动命令重新建立两个文件，容器恢复就绪。Pod 的名字通常不变，因为这是同一 Pod 内重启容器。按 Ctrl+C，再看 describe 中的 Unhealthy、Killing 和重启记录。

## 正式服务怎样选阈值

按应用启动时长、正常请求耗时和可接受摘流延迟决定参数，先观测再调。启动可能要两分钟，就不要给十秒预算；健康接口不应每次扫描整张数据库表；检查超时要有边界。readiness 也不能替代连接排空，旧连接和已经进入处理的请求不会神奇消失。

~~~bash
kubectl -n lab describe pod -l app=probe-web
kubectl -n lab logs deployment/probe-web --previous --tail=20
kubectl delete -f health/probes.yaml
~~~

`--previous` 查看前一次容器实例的日志，只有发生过重启才有。清理只删 probe-web，基础网页不受影响。生产排错时先保留日志和事件，再决定是否重启，避免刚好把失败证据清掉。

## 继续阅读

- [配置存活、就绪和启动探针](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Pod 就绪状态](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/pod-lifecycle/#pod-readiness)
