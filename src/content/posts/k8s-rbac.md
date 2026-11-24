---
title: 谁能看日志，谁能删服务：用 RBAC 做一次最小授权
date: '2026-11-24'
summary: 给 ServiceAccount 只读 Pod 和日志权限，用 can-i 及 impersonation 验证允许与拒绝。
series: Docker 与 Kubernetes
order: 41
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-architecture
goals:
  - 给 ServiceAccount 只读 Pod 和日志权限，用 can-i 及 impersonation 验证允许与拒绝。
---
“连得上集群”不等于“应该能删所有资源”。认证回答你是谁，授权回答能做什么，准入控制再检查这次操作是否符合规则。RBAC 负责授权，不负责让两个 Pod 的网络隔离。

## 四种 RBAC 对象怎么配合

Role 定义一个 namespace 里的权限；ClusterRole 定义可复用或集群范围的权限。RoleBinding 在自己的 namespace 绑定 Role 或 ClusterRole；ClusterRoleBinding 则把 ClusterRole 权限绑定到集群范围。RoleBinding 引用 ClusterRole，不会自动得到所有 namespace 的权限。

本课使用 ServiceAccount 作为身份，避免先引入外部账号系统。普通用户通常来自证书、OIDC 等认证方式，K8s 没有一个让你 `kubectl create user` 就建立登录密码的通用 User 资源。

## 建一个只能看 Pod 和日志的身份

~~~yaml file=security/reader.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: pod-reader
  namespace: lab
automountServiceAccountToken: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: read-pods
  namespace: lab
rules:
  - apiGroups: [""]
    resources: [pods, pods/log]
    verbs: [get, list, watch]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: lab
subjects:
  - kind: ServiceAccount
    name: pod-reader
    namespace: lab
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: read-pods
~~~

~~~bash
kubectl apply -f security/reader.yaml
kubectl auth can-i list pods -n lab --as=system:serviceaccount:lab:pod-reader
kubectl auth can-i delete pods -n lab --as=system:serviceaccount:lab:pod-reader
kubectl auth can-i get secrets -n lab --as=system:serviceaccount:lab:pod-reader
kubectl auth can-i list pods -n kube-system --as=system:serviceaccount:lab:pod-reader
~~~

预期依次 yes、no、no、no。`apiGroups: [""]` 指核心 API 组，不是遗漏；`pods/log` 是子资源，允许看 Pod 不自动等于允许看日志。动词 create、patch、delete 的范围应按任务给，不要图方便写全 `*`。

## 真的用这个身份发一次请求

~~~bash
kubectl -n lab get pods --as=system:serviceaccount:lab:pod-reader
kubectl -n lab logs deployment/web --tail=5 --as=system:serviceaccount:lab:pod-reader
~~~

第二条可能被拒绝：客户端先要读 Deployment，再找它下面的 Pod，但角色只允许 pods。改为直接指定 Pod：

~~~bash
lab_pod=$(kubectl -n lab get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl -n lab logs "$lab_pod" --tail=5 --as=system:serviceaccount:lab:pod-reader
kubectl -n lab get secrets --as=system:serviceaccount:lab:pod-reader
~~~

Pod 日志能读，Secret 请求 Forbidden，说明权限边界生效。`--as` 是管理员模拟身份，需要 impersonate 权限；它不是普通用户绕过登录的方法，也没把你的管理员 kubeconfig 改成另一个账号。

## kubeconfig、Token 和密码不要混着传

kubeconfig 可能包含地址、CA、客户端证书和私钥，转发文件可能等于转发身份。Pod 使用 projected token 时通常具备期限和受众约束，不应再为方便手工制作永不过期的管理员 Token。应用不访问 API 时设置 `automountServiceAccountToken: false`，减少无用凭证暴露。

注意：能创建 Pod 的人，可能通过挂载 Secret、指定高权限 ServiceAccount 等方式扩大实际访问面。因此最小授权还要配合准入策略，不能只看一条 `get secrets=no` 就宣称凭证绝对安全。

## 权限被拒绝，先看具体动词和资源

~~~bash
kubectl auth can-i --list -n lab --as=system:serviceaccount:lab:pod-reader
kubectl -n lab get role read-pods -o yaml
kubectl -n lab get rolebinding read-pods -o yaml
kubectl delete -f security/reader.yaml
~~~

检查 namespace、subject 名、apiGroup、资源复数和子资源。不需要因为 get 被拒绝就授予 cluster-admin。日志也可能含敏感业务数据，只读并不意味着可以对所有人公开。

## 继续阅读

- [RBAC 授权](https://kubernetes.io/zh-cn/docs/reference/access-authn-authz/rbac/)
- [ServiceAccount](https://kubernetes.io/zh-cn/docs/concepts/security/service-accounts/)
