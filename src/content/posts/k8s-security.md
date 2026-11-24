---
title: "容器能跑不代表适合上线：Pod 安全先从这几处检查"
date: "2026-11-24"
summary: "检查默认 ServiceAccount、运行身份、能力、镜像标签和 Secret 暴露风险。"
series: "Docker 与 Kubernetes"
order: 33
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-rbac"]
goals: ["对课程 API 使用最小权限思路，并指出几个常见的运行时风险。"]
---

开发机上容器能启动，只证明路径通了一遍。生产还要问：进程是不是 root，容器能不能提权，为什么应用要访问 Kubernetes API，镜像能不能追到源码版本？

## 概念讲透：它负责什么，不负责什么

容器安全不只靠非 root：还要控制镜像来源和漏洞、进程权限、Linux capabilities、根文件系统写权限、网络入口、ServiceAccount 和 Secret 访问。Pod Security Standards 提供基线策略，Admission 控制器可以在对象进入集群前拦截不合规配置。运行时安全还需要补丁、审计和事件响应。

## 运行过程拆解：从输入到结果

安全控制分布在构建、入集群和运行三个阶段：构建检查依赖和镜像来源，Admission 校验清单策略，运行时用身份、文件系统、系统能力和网络限制影响范围。单个 securityContext 无法修补有漏洞的依赖，也无法防止泄露的仓库密钥。上线前把镜像、身份、权限、可写目录和允许流量列出来，逐项验证正常功能仍可运行。

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

## 怎么确认做对了

强化后的 API 不使用 default 服务账号，也不会挂载 Kubernetes token。根文件系统只读；若程序确实要写其他路径，先分析原因再只挂载需要的临时目录。数据库仍用虚构课程密码，不把它误认为生产密钥管理方案。

## 案例推演

一个 API 漏洞被利用后，攻击者试图读取节点文件并调用 Kubernetes API。先限制进程为非 root、删掉不需要的 capabilities、只读根目录、关闭自动挂载 token，再用网络策略限制出站。每项都要在测试环境验证应用还能启动；安全设置若只复制清单却未验证，会在上线时造成不可用。

## 留一个小练习

应用清单并等 API Pod 完成滚动更新，再调用 `/health/live` 和 `/health/ready` 确认安全设置未破坏服务。上线前检查镜像来源、不可变版本、授权、Secret 加密、漏洞扫描、日志脱敏和回退方式。

## 没跑通时先查什么

只读文件系统造成写文件失败时，把明确需要的临时目录挂到 emptyDir，不要一口气撤掉所有防护。Pod 与容器 securityContext 生效范围不同。

## 生产里怎么用、怎么排障

最小权限要覆盖 CI 发布身份、集群操作者、Pod 和镜像仓库。密钥轮换、镜像漏洞响应、基线策略例外和审计日志都要有责任人。不要把 Secret base64 当加密，不要给所有工作负载 cluster-admin，也不要在生产直接执行网上找到的特权调试 Pod。

## 参考资料

- [Pod 安全标准](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Kubernetes Secret](https://kubernetes.io/docs/concepts/configuration/secret/)
- [安全检查清单](https://kubernetes.io/docs/concepts/security/security-checklist/)
