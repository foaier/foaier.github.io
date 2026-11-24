---
title: "Deployment、StatefulSet、Job、DaemonSet，到底该选谁"
date: "2026-11-24"
summary: "按服务、固定身份、一次性任务和每节点代理区分工作负载控制器。"
series: "Docker 与 Kubernetes"
order: 30
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-storage"]
goals: ["为常见任务选择合适的控制器，并运行一个可重复清理的 Job。"]
---

不是所有程序都适合“永远保持两个副本”。发一批账单的脚本应跑完退出；采集节点日志的代理希望每台节点各一个；有固定节点身份的服务又需要稳定编号。控制器选错，最常见的结果是完成的脚本被无限重启。

## 按程序的运行方式选择控制器

Deployment 适合能替换副本的长期服务。StatefulSet 提供稳定 Pod 名字、顺序与卷声明等机制，但不会替 PostgreSQL 配主从复制或选主。DaemonSet 通常覆盖符合条件的每个节点。Job 追求任务成功完成；CronJob 定时创建 Job。

Job 遇到失败会重试，定时任务可能延迟或重复，所以业务逻辑仍要保证幂等。数据库迁移任务尤其要防多个副本同时修改 schema，不能把“只声明一个 Job”当成绝对只执行一次的承诺。

## 运行一个做完就退出的 Job

用官方 BusyBox 镜像创建一次性任务。只打印一句话，不操作数据库。先运行下面命令，完成后查看日志与状态，再删除这个 Job。CronJob 可先读概念，不必为了演示创建一个会不停运行的后台任务。

~~~powershell
kubectl -n container-course create job course-once --image=busybox:1.37 -- /bin/sh -c "echo course-job-done"
kubectl -n container-course wait --for=condition=complete job/course-once --timeout=120s
kubectl -n container-course logs job/course-once
kubectl -n container-course get job course-once
kubectl -n container-course delete job course-once
~~~

## 怎么确认做对了

Job 的 COMPLETIONS 为 1/1，日志出现 course-job-done，Pod 进入 Completed。这与 Web 服务退出后应被重启的行为不同。删除 Job 会清理它所管理的 Pod，日志保留应由外部系统解决。

## 留一个小练习

列出 API、单次数据修正、每夜备份、日志代理各该用哪个控制器。给每夜备份再补三个配置思考：concurrencyPolicy 如何避免重叠、timeZone 按哪一区、失败如何告警。备份脚本若没验证恢复，定时成功也未必有用。

## 没跑通时先查什么

Job 一直重试时先看 backoffLimit、退出码和 `logs --previous` 适用范围；Job Pod 重建后的旧日志可能已不在。StatefulSet 删 Pod 不等于删数据，也不等于自动数据库故障转移，必须读应用或 Operator 的维护说明。

## 参考资料

- [工作负载](https://kubernetes.io/docs/concepts/workloads/controllers/)
- [Job](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
