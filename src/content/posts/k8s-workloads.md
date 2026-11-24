---
title: 不同任务用不同控制器：DaemonSet、Job 和 CronJob
date: '2026-11-24'
summary: 分别运行每节点任务、一次性计算和定时作业，学习完成状态、重试、超时以及幂等处理。
series: Docker 与 Kubernetes
order: 37
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-deployment
  - k8s-pod-lifecycle
goals:
  - 分别运行每节点任务、一次性计算和定时作业，学习完成状态、重试、超时以及幂等处理。
---
网页需要长期运行，Deployment 合适；导出报表需要运行后结束，用 Deployment 就可能被一遍遍拉起来。选择控制器之前先问：程序应该一直活着，还是完成工作就退出？是否要求每台节点都有一份？

## 四类工作先分清

| 控制器 | 目标 | 例子 |
| --- | --- | --- |
| Deployment | 维持一组可替换的副本 | 无状态 API、网页 |
| DaemonSet | 在符合条件的节点上运行副本 | 日志采集、节点代理 |
| Job | 达到指定成功完成次数 | 数据导入、一次性计算 |
| CronJob | 按时间表创建 Job | 定时报表、定期清理 |

StatefulSet 留到下一课，处理稳定身份和逐副本存储。HPA 是调整规模的控制器，不是用来替代这些工作负载的另一种容器类型。

## 在每个工作节点放一个观察进程

~~~yaml file=workloads/daemonset.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-note
  namespace: lab
spec:
  selector:
    matchLabels: {app: node-note}
  template:
    metadata:
      labels: {app: node-note}
    spec:
      containers:
        - name: note
          image: busybox:1.37
          command: ["sh", "-c", "echo running-on-$NODE_NAME; sleep 86400"]
          env:
            - name: NODE_NAME
              valueFrom:
                fieldRef: {fieldPath: spec.nodeName}
~~~

~~~bash
kubectl apply -f workloads/daemonset.yaml
kubectl -n lab rollout status daemonset/node-note --timeout=120s
kubectl -n lab get pods -l app=node-note -o wide
kubectl -n lab logs -l app=node-note --prefix
~~~

三节点 kind 通常在两个 worker 上各有一个，控制平面有污点，不一定也运行。DaemonSet 并非无条件忽略所有污点；是否运行仍取决于选择条件、容忍和资源。

## 一个会成功结束的 Job

~~~yaml file=workloads/job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: count-demo
  namespace: lab
spec:
  backoffLimit: 2
  activeDeadlineSeconds: 60
  ttlSecondsAfterFinished: 600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: counter
          image: busybox:1.37
          command: ["sh", "-c", "for n in 1 2 3; do echo item-$n; done"]
~~~

~~~bash
kubectl apply -f workloads/job.yaml
kubectl -n lab wait --for=condition=Complete job/count-demo --timeout=90s
kubectl -n lab logs job/count-demo
kubectl -n lab get jobs,pods
~~~

日志应有 item-1 到 item-3，Pod 是 Completed，不是异常退出。backoffLimit 限失败重试，activeDeadlineSeconds 限总运行时间，TTL 让完成后的对象在一段时间后清理。没有日志归集时清理太快会影响排错。

## 每分钟运行一次，且不重叠

~~~yaml file=workloads/cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: clock
  namespace: lab
spec:
  schedule: "*/1 * * * *"
  timeZone: Asia/Shanghai
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 30
  successfulJobsHistoryLimit: 2
  failedJobsHistoryLimit: 2
  jobTemplate:
    spec:
      backoffLimit: 1
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: clock
              image: busybox:1.37
              command: ["sh", "-c", "date; echo report-finished"]
~~~

~~~bash
kubectl apply -f workloads/cronjob.yaml
kubectl -n lab get cronjobs
kubectl -n lab create job clock-manual --from=cronjob/clock
kubectl -n lab wait --for=condition=Complete job/clock-manual --timeout=120s
kubectl -n lab logs job/clock-manual
~~~

手工触发能立即验证模板，不必等一分钟。Forbid 阻止同一 CronJob 的计划任务重叠，不会阻止你另外手动创建 Job；timeZone 决定调度时区，容器内 date 的显示时区可以不同。

## 定时任务不能假设绝对只执行一次

调度延迟、重试、控制器恢复可能带来漏执行或重复执行风险。扣款、发券、结算要用业务唯一键、事务或幂等记录兜住，不能因为 CronJob 名字里有 Cron 就相信“每分钟恰好一次”。Job 的成功退出码只证明进程报告成功，业务验收仍要检查目标数据。

~~~bash
kubectl -n lab patch cronjob clock --type=merge -p '{"spec":{"suspend":true}}'
kubectl delete -f workloads/cronjob.yaml -f workloads/daemonset.yaml
kubectl -n lab delete job clock-manual count-demo --ignore-not-found
~~~

暂停只阻止后续计划，不中止已创建 Job。删除 CronJob 通常级联删除所属 Job；手工任务单独清理。若修改 Job 模板时提示 immutable，创建一个新名字的 Job，不要强行修改已经运行的任务。

## 继续阅读

- [Job](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/job/)
- [CronJob](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/cron-jobs/)
