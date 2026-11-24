---
title: Deployment、StatefulSet、Job、DaemonSet，到底该选谁
date: '2026-11-24'
summary: 按服务、固定身份、一次性任务和每节点代理区分工作负载控制器。
series: Docker 与 Kubernetes
order: 30
tags:
  - Kubernetes 入门
  - Docker
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-storage
goals:
  - 为常见任务选择合适的控制器，并运行一个可重复清理的 Job。
---

不是所有程序都适合“永远保持两个副本”。发一批账单的脚本应跑完退出；采集节点日志的代理希望每台节点各一个；有固定节点身份的服务又需要稳定编号。控制器选错，最常见的结果是完成的脚本被无限重启。

## 按程序的运行方式选择控制器

Deployment 适合能替换副本的长期服务。StatefulSet 提供稳定 Pod 名字、顺序与卷声明等机制，但不会替 PostgreSQL 配主从复制或选主。DaemonSet 通常覆盖符合条件的每个节点。Job 追求任务成功完成；CronJob 定时创建 Job。

Job 遇到失败会重试，定时任务可能延迟或重复，所以业务逻辑仍要保证幂等。数据库迁移任务尤其要防多个副本同时修改 schema，不能把“只声明一个 Job”当成绝对只执行一次的承诺。

## 运行一个做完就退出的 Job

用官方 BusyBox 镜像创建一次性任务。只打印一句话，不操作数据库。先运行下面命令，完成后查看日志与状态，再删除这个 Job。CronJob 可先读概念，不必为了演示创建一个会不停运行的后台任务。

~~~powershell
$context = kubectl config current-context
if ($context -ne 'kind-course') { throw "当前 context 是 $context；只在课程 kind-course 创建练习 Job" }
kubectl -n container-course create job course-once --image=busybox:1.37 -- /bin/sh -c "echo course-job-done"
kubectl -n container-course wait --for=condition=complete job/course-once --timeout=120s
kubectl -n container-course logs job/course-once
kubectl -n container-course get job course-once
kubectl -n container-course delete job course-once
~~~

## 运行一次 Job 并查看任务输出

apply 创建 Job，Job 控制器创建 Pod 并追踪完成状态；get 同时查看任务和执行实例；logs 读取结果。要重跑同名 Job，先删除后重新 apply。任务可能重试，真实业务需用幂等键保护外部副作用。

~~~powershell
kubectl apply -f k8s/os-check.yaml
kubectl -n container-course get jobs,pods
kubectl -n container-course logs job/os-check
~~~

## 控制器选型要看“要维持什么”

| 工作负载 | 它维持或执行什么 | 适合的任务 |
|---|---|---|
| Deployment | 一组可替换的无状态副本 | API、Web 服务 |
| StatefulSet | 有稳定序号与网络身份的副本 | 需要稳定身份的状态服务 |
| DaemonSet | 每个符合条件的节点运行一个副本 | 节点日志、监控代理 |
| Job | 直到成功完成指定次数 | 数据迁移、批处理 |
| CronJob | 按时间表创建 Job | 定时清理、对账任务 |

StatefulSet 不会自动把数据库变成高可用集群；它提供稳定的 Pod 身份和卷关联，复制协议、选主、备份仍需数据库本身或 Operator 实现。DaemonSet 也不等于“每台物理机必有一个”，节点选择、污点容忍和系统约束都会影响覆盖范围。

## CronJob 不是精确到秒的定时器

CronJob 按 schedule 创建 Job，但控制器协调、集群负载和时钟会带来延迟；长时间任务可能与下一次调度重叠。concurrencyPolicy 可设 Allow、Forbid 或 Replace，但业务仍应能处理重复执行。startingDeadlineSeconds 和历史 Job 保留数量用于控制延迟补跑与对象清理。

~~~powershell
kubectl -n container-course create cronjob clock-lab --image=busybox:1.36 --schedule='*/2 * * * *' -- /bin/sh -c 'date; echo scheduled-run'
kubectl -n container-course get cronjob
kubectl -n container-course get jobs --watch
~~~

等待下一次两分钟边界触发，按 Ctrl+C 结束 watch，再查看 Job 日志。实验结束后按对象名清理：kubectl -n container-course delete cronjob clock-lab；删除 CronJob 默认不会自动删除已创建的历史 Job，需先查看 jobs，再逐个确认清理。

## 参考资料

- [工作负载](https://kubernetes.io/docs/concepts/workloads/controllers/)
- [Job](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
