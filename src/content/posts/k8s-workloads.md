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

## 概念讲透：它负责什么，不负责什么

Deployment 适合可互换的无状态副本；StatefulSet 提供稳定序号、网络身份和逐个管理的卷声明；DaemonSet 通常让每个匹配节点运行一个代理；Job 执行到完成为止；CronJob 按时间创建 Job。选择看进程生命周期和状态需求，不是看它是不是数据库就机械地套 StatefulSet。

## 运行过程拆解：从输入到结果

控制器根据期望状态运行不同生命周期：Deployment 保持一组可互换副本，StatefulSet 保留有序身份和卷，DaemonSet 跟随节点集合，Job 追踪任务完成，CronJob 按计划生成 Job。选错控制器会导致重复执行、无法定位数据或滚动异常。即便 Job 显示 Complete，也还要验证任务结果和外部副作用是否符合业务预期。

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

## 案例推演

每天凌晨跑账单任务，节点重启后任务又执行一次，产生重复记录。CronJob 不承诺业务只执行一次；任务代码需要幂等键、事务约束和重复运行保护，并设置并发策略与失败历史保留。若是每台节点都要采集日志，用 DaemonSet；若是长期 API 服务则由 Deployment 管。

## 留一个小练习

列出 API、单次数据修正、每夜备份、日志代理各该用哪个控制器。给每夜备份再补三个配置思考：concurrencyPolicy 如何避免重叠、timeZone 按哪一区、失败如何告警。备份脚本若没验证恢复，定时成功也未必有用。

## 没跑通时先查什么

Job 一直重试时先看 backoffLimit、退出码和 `logs --previous` 适用范围；Job Pod 重建后的旧日志可能已不在。StatefulSet 删 Pod 不等于删数据，也不等于自动数据库故障转移，必须读应用或 Operator 的维护说明。

## 运行一次 Job 并查看任务输出

apply 创建 Job，Job 控制器创建 Pod 并追踪完成状态；get 同时查看任务和执行实例；logs 读取结果。要重跑同名 Job，先删除后重新 apply。任务可能重试，真实业务需用幂等键保护外部副作用。

~~~powershell
kubectl apply -f k8s/os-check.yaml
kubectl -n container-course get jobs,pods
kubectl -n container-course logs job/os-check
~~~


## 生产里怎么用、怎么排障

Job/CronJob 需限制并发、超时、重试次数和资源，防止失败后堆积或重跑副作用。StatefulSet 也不自动提供数据库复制与备份，单副本仍是单点；有状态服务要单独设计成员发现、升级顺序、存储恢复和仲裁。发布前验证终止信号与进程退出时间。

## 参考资料

- [工作负载](https://kubernetes.io/docs/concepts/workloads/controllers/)
- [Job](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
