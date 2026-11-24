---
title: 容器能跑不代表适合上线：Pod 安全先从这几处检查
date: '2026-11-24'
summary: 检查默认 ServiceAccount、运行身份、能力、镜像标签和 Secret 暴露风险。
series: Docker 与 Kubernetes
order: 33
tags:
  - Kubernetes 进阶
  - Docker
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-rbac
goals:
  - 对课程 API 使用最小权限思路，并指出几个常见的运行时风险。
---

开发机上容器能启动，只证明路径通了一遍。生产还要问：进程是不是 root，容器能不能提权，为什么应用要访问 Kubernetes API，镜像能不能追到源码版本？

## 先收紧进程和集群访问权限

课程 API 不需要访问 Kubernetes API，可以创建专用 ServiceAccount 并关闭自动 token。保持非 root、默认 seccomp、禁止提权并删掉多余 Linux capabilities，可以缩小失陷后的活动空间。Pod Security Standards 有 privileged、baseline、restricted 档位，强制 restricted 前要先验证数据库镜像的初始化行为和全部工作负载。

容器里的凭证、Kubernetes Secret 和镜像拉取密钥用途不同。Secret 的 base64 不是加密。GHCR 私有包需要 imagePullSecret 或节点身份拉取；应用需要的数据库口令再单独注入。

## 检查课程 API 的运行边界

检查课程 API 的身份与容器安全上下文；这节会先更新示例 Deployment，使用专用 ServiceAccount、关闭 token 挂载，并在容器级禁止提权、丢弃 capability、只读根文件系统，将 /tmp 显式挂到 emptyDir。

~~~powershell
kubectl apply -f k8s/20-api.yaml
kubectl -n container-course rollout status deployment/course-api
kubectl -n container-course get deployment course-api -o yaml
docker image inspect container-course-api:local --format "{{.RepoTags}} {{.Config.User}}"
~~~

## 检查 Pod 的运行身份、安全上下文和 API 权限

在 YAML 中检查 runAsNonRoot、只读根目录、capabilities 和 token 挂载；两条 can-i 预期都为 no，因为这个 API 不需要访问 Kubernetes API。若程序确实需要读取对象，应创建专用 ServiceAccount 和最小 Role，而不是给默认身份管理员权限。

~~~powershell
kubectl -n container-course get pod -l app=course-api -o yaml
kubectl auth can-i get secrets -n container-course --as=system:serviceaccount:container-course:course-api
kubectl auth can-i get pods -n container-course --as=system:serviceaccount:container-course:course-api
~~~

## Pod 安全上下文如何落到运行进程

课程 API Deployment 已展示几项常见收紧措施：runAsNonRoot 防止以 root 启动，RuntimeDefault seccomp 使用运行时默认系统调用过滤，allowPrivilegeEscalation=false 阻止进程提升权限，capabilities.drop: [ALL] 移除不需要的 Linux capabilities，readOnlyRootFilesystem 减少容器根文件系统写入。

这些选项会影响应用能否写临时目录、绑定低端口或启动辅助进程。收紧前先盘点实际需要的文件路径和系统调用，再显式挂载 tmp 等可写目录；不能通过 privileged: true 一把打开所有权限来“修复”兼容问题。

## 把安全检查按层做，而不是只检查镜像

| 层 | 关键问题 |
|---|---|
| 镜像和供应链 | 来源可信、版本可追溯、依赖有更新、扫描结果已评估 |
| 进程身份 | 非 root、只给必要 capability、只读根文件系统是否可行 |
| 集群 API | ServiceAccount 是否需要 token，RBAC 是否最小 |
| 网络 | Pod 间是否需要 NetworkPolicy，入口是否有 TLS 和身份校验 |
| 数据 | Secret 加密和轮换，PVC 访问控制，备份隔离与恢复 |
| 准入 | 是否拒绝特权容器、未批准镜像和危险 hostPath |

NetworkPolicy 是否生效取决于 CNI 插件支持；对象创建成功并不证明数据面正在实施策略。Secret 对象也不因为 Base64 表示就变得安全。生产安全要同时检查 API 权限、etcd 加密、节点访问、审计日志和备份副本。

## 参考资料

- [Pod 安全标准](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Kubernetes Secret](https://kubernetes.io/docs/concepts/configuration/secret/)
- [安全检查清单](https://kubernetes.io/docs/concepts/security/security-checklist/)
