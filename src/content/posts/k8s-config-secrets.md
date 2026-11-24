---
title: "配置和密码别烘焙进镜像：ConfigMap 与 Secret 怎么用"
date: "2026-11-24"
summary: "拆开普通配置和敏感值，搞清环境变量更新与 Secret 的保护边界。"
series: "Docker 与 Kubernetes"
order: 25
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-service"]
goals: ["通过 ConfigMap 注入日志配置，并解释 Secret base64 不等于加密。"]
---

同一份镜像在测试用测试库，在生产用生产库，通常不该为了换连接串重打一份镜像。把普通配置放 ConfigMap、敏感值放 Secret，再由部署清单引用，镜像才能只关注程序和依赖。

## 配置对象更新后，进程未必重读

Secret 并不是“放进去就绝对安全”的保险柜。API 返回的 data 常见是 base64 编码；能读取 Secret 的账号仍能还原明文。生产需要合适的 RBAC、控制面静态加密、审计和密钥轮换，或对接外部秘密管理服务。课程密码只是虚构值，不能照搬到外网。

ConfigMap 的环境变量在容器创建时读取，更新对象不会让现有进程的环境变量自动改变。挂载文件的更新机制又不同，应用还得支持重新加载，subPath 挂载有额外限制。不要把“配置对象已更新”和“程序已使用新配置”画等号。

## 给 API 注入一项日志配置

基础清单已从 Secret 引用数据库密码。这次创建普通 ConfigMap，给 API 注入 .NET 标准日志级别键，并显式触发一次 rollout，让新进程拿到配置。每条命令都限定在课程 namespace。

~~~powershell
kubectl -n container-course create configmap course-settings --from-literal=Logging__LogLevel__Default=Warning --dry-run=client -o yaml | kubectl apply -f -
kubectl -n container-course set env deployment/course-api --from=configmap/course-settings
kubectl -n container-course rollout status deployment/course-api
kubectl -n container-course get configmap course-settings
kubectl -n container-course get secret course-db
~~~

## 怎么确认做对了

ConfigMap 能列出来；Secret 的 get 列表只显示类型和键数量，不必输出明文检查。新 Pod 的日志更少。这个命令式实验要进入长期配置时，应把非敏感引用写回 YAML；真实 Secret 只提交受保护的加密形式或外部引用。

## 留一个小练习

把 ConfigMap 日志级别改回 Information 后观察现有 Pod：不会仅因 ConfigMap 内容变化就重建。执行 `kubectl -n container-course rollout restart deployment/course-api` 再检查。练完用 `kubectl -n container-course set env deployment/course-api Logging__LogLevel__Default-` 移除实验变量。

## 没跑通时先查什么

CreateContainerConfigError 先查引用的 Secret 名与 key，注意大小写。更新 PostgreSQL 的 POSTGRES_PASSWORD 环境变量不会替已有数据目录自动更改数据库用户密码，需要数据库端轮换并协调应用更新。别因为认证失败就直接删卷。

## 参考资料

- [ConfigMap](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Secret](https://kubernetes.io/docs/concepts/configuration/secret/)
