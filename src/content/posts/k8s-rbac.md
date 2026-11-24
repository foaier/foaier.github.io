---
title: "别把 kubeconfig 发给所有同事：用 RBAC 给刚刚好的权限"
date: "2026-11-24"
summary: "为课程创建一个只读 Pod 的身份，用 auth can-i 检查权限边界。"
series: "Docker 与 Kubernetes"
order: 32
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-gateway-api"]
goals: ["为 ServiceAccount 限定 namespace 内的 Pod 读取权限，并验证拒绝操作。"]
---

能跑 kubectl 的 kubeconfig 往往包含实实在在的身份凭证，有的还能改整个生产集群。把它发到聊天群方便排错，相当于发了一把未标用途的钥匙。先说明谁、在什么范围、能干什么。

## 概念讲透：它负责什么，不负责什么

RBAC 把主体、权限和作用范围连起来：Role/ClusterRole 定义对资源的 verbs，RoleBinding/ClusterRoleBinding 把权限授给用户、组或 ServiceAccount。RoleBinding 可以把同 namespace 内的权限授予一个主体；权限按允许规则累加，没有“拒绝规则”。resourceNames 可进一步限定部分对象级操作。

## 运行过程拆解：从输入到结果

授权判断可以理解为主体、API group、资源、动词、namespace 与对象名称的组合。Role 定义一组允许规则，Binding 把这些规则授给主体；ClusterRole 可用于集群资源或被 namespace 级绑定复用。权限会从多个绑定累加，无法靠一条更窄规则抵消过宽权限，所以审计时要追踪所有来源，再逐项做 can-i 验证。

## 身份、角色和绑定怎样连起来

RBAC 基本组合是 Role 或 ClusterRole 加 RoleBinding 或 ClusterRoleBinding，再授予 User、Group 或 ServiceAccount。Role 只管一个 namespace，适合本课读 Pod。权限是累加的；宽泛通配符还会把未来新增资源和动作一起开放。服务账号不应直接沿用管理员用户配置。

## 创建一个只读课程 Pod 的身份

创建一个只针对 Pod 的只读 Role 和 ServiceAccount，授权范围锁在 container-course。auth can-i --as 做模拟检查；使用该参数的当前身份需要 impersonate 权限，所以权限不足不代表课程 Role 错。

~~~powershell
kubectl -n container-course create serviceaccount course-reader
kubectl -n container-course create role pod-reader --verb=get,list,watch --resource=pods
kubectl -n container-course create rolebinding course-reader-pods --role=pod-reader --serviceaccount=container-course:course-reader
kubectl auth can-i watch pods -n container-course --as=system:serviceaccount:container-course:course-reader
kubectl auth can-i create pods -n container-course --as=system:serviceaccount:container-course:course-reader
kubectl auth can-i list secrets -n container-course --as=system:serviceaccount:container-course:course-reader
~~~

## 怎么确认做对了

正确授权时第一项为 yes，删除 Pod 与读取 Secret 为 no。练习身份能观察 Pod，却不能读取数据库密码或删除 API。这是 namespace 范围的读取演示。

## 案例推演

一个只读监控账号可以列出 Pod，却意外能创建 Secret。用 kubectl auth can-i --list 和具体资源/动词逐项查权限，追溯它绑定了哪些 ClusterRole。删除过宽的集群级绑定，改成目标 namespace 的只读 RoleBinding，再分别验证允许 get/list 与拒绝 create/delete。

## 留一个小练习

用 describe rolebinding 看主体、角色和 namespace。再为“只查看部署 rollout 状态”列出需要的资源和动词后再建角色；先不要给 edit 或 cluster-admin。

## 没跑通时先查什么

no 表示当前授权评估没有授予对应权限；确认 context、namespace 和 subject 拼写。RoleBinding 即使绑定 ClusterRole，权限也仍限制在 RoleBinding 所在 namespace；ClusterRoleBinding 才扩到集群范围。

本地练习账号只有观察课程 Pod 的动机，Role 不应包含 Secret、exec 或 port-forward 这类额外权限。权限审查还应定期清理离职身份和过期临时授权；角色命名写出用途，比 `reader1` 更容易被维护人员看懂。

ServiceAccount 是 Pod 内程序使用的集群身份；人类操作者则通常通过外部身份系统认证。两种身份的授权路径不同，排查 Forbidden 时先确认错误属于谁，再查对应的 RoleBinding。不要把开发者个人凭证塞进 Pod。

## 用 can-i 验证允许和拒绝的权限

预期第一项 yes、后两项 no。--as 做身份模拟，当前操作者还需 impersonate 权限；若这一步报 Forbidden，先确认当前身份是否可以模拟，不要因此扩大 course-reader 权限。

~~~powershell
kubectl auth can-i list pods -n container-course --as=system:serviceaccount:container-course:course-reader
kubectl auth can-i delete pods -n container-course --as=system:serviceaccount:container-course:course-reader
kubectl auth can-i get secrets -n container-course --as=system:serviceaccount:container-course:course-reader
~~~


## 生产里怎么用、怎么排障

ServiceAccount token 能被拿到的 Pod 使用，默认挂载会扩大被攻陷容器的影响面。工作负载只需访问 Kubernetes API 时才绑定专用身份，权限按资源、动词和 namespace 收窄，并审计长期未用的绑定。管理员 kubeconfig 不应塞进应用镜像、开发容器或共享目录。

线上出现 Forbidden 时，先记录请求使用的身份、namespace、资源和动词，再用相同身份做 can-i 检查；然后从 RoleBinding 追到被授予的 Role/ClusterRole，找出权限从哪条绑定加进来。不要为了尽快消除报错就授予 cluster-admin，也不要把 403 和网络超时混为一谈：前者是授权拒绝，后者还没走到授权判断。

## 参考资料

- [RBAC 授权](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [控制访问](https://kubernetes.io/docs/concepts/security/controlling-access/)
