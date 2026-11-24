---
title: 容器权限怎么收紧：非 root、只读文件系统和 Pod 安全准入
date: '2026-11-24'
summary: 在独立 namespace 启用 Restricted 策略，先看违规 Pod 被拒绝，再运行满足约束的容器。
series: Docker 与 Kubernetes
order: 42
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-rbac
goals:
  - 在独立 namespace 启用 Restricted 策略，先看违规 Pod 被拒绝，再运行满足约束的容器。
---
把镜像做小不等于权限安全。以 root 运行、挂宿主机目录、打开 privileged，都可能让一个应用漏洞变成节点风险。先从应用实际需要的权限出发，一项项收紧，再验证它还能工作。

## 哪个设置限制哪件事

| 设置 | 作用 | 常见后续工作 |
| --- | --- | --- |
| runAsNonRoot | 要求非 root 用户 | 镜像目录权限要兼容 UID |
| allowPrivilegeEscalation: false | 阻止进程通过机制获取更高权限 | 不替代 capabilities 限制 |
| capabilities.drop: ALL | 去掉默认 Linux 能力 | 确实需要的能力再逐项评估 |
| readOnlyRootFilesystem | 根文件系统只读 | 临时写入目录另挂卷 |
| seccompProfile: RuntimeDefault | 使用运行时默认系统调用过滤 | 个别系统调用可能不再允许 |

Pod Security Admission 是 namespace 级准入机制，常见等级是 privileged、baseline、restricted。warn 提醒，audit 写审计注解，enforce 拒绝不合格新 Pod；不是给已有进程自动降权。

## 在专用 namespace 开启 Restricted

~~~bash
kubectl create namespace secure-lab --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace secure-lab pod-security.kubernetes.io/enforce=restricted pod-security.kubernetes.io/enforce-version=v1.35 --overwrite
kubectl -n secure-lab run denied --image=nginx:1.28-alpine --restart=Never
~~~

最后一条预期被 Forbidden 拒绝，错误会列出缺失的安全字段。这里故意不在 lab 上加规则，否则前面的学习清单可能突然无法创建。namespace 的限制版本固定为本课 Kubernetes 版本，避免策略随升级无意变化。

## 给它一个真正满足约束的配置

~~~yaml file=security/restricted.yaml
apiVersion: v1
kind: Pod
metadata:
  name: safe-tool
  namespace: secure-lab
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    fsGroup: 10001
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: tool
      image: busybox:1.37
      command: ["sleep", "3600"]
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: [ALL]
      volumeMounts:
        - name: scratch
          mountPath: /work
  volumes:
    - name: scratch
      emptyDir: {}
~~~

~~~bash
kubectl apply -f security/restricted.yaml
kubectl -n secure-lab wait --for=condition=Ready pod/safe-tool --timeout=120s
kubectl -n secure-lab exec safe-tool -- id
kubectl -n secure-lab exec safe-tool -- sh -c 'echo ok > /work/result; cat /work/result'
kubectl -n secure-lab exec safe-tool -- sh -c 'echo nope > /etc/result'
~~~

id 显示 UID 10001；/work 可写；/etc 写入应失败。只读根目录不是“所有地方都不能写”，显式挂载的可写卷仍可写。fsGroup 帮助适用卷提供组权限，具体支持取决于卷和驱动，不要指望它修复所有镜像文件的所有权。

## 程序变成 CrashLoop，怎么判断是不是加固引起

先查日志里是否 permission denied、只读文件系统、无法绑定端口。找出程序真正要写的目录，挂到 /tmp 或指定数据卷，或在构建镜像时设置正确所有权。不要一失败就同时打开 privileged、root、hostPath，让所有限制全部失效。

普通 Nginx 镜像默认行为与非 root 镜像不同，直接复制这套 securityContext 到任何镜像不保证能启动。先在测试环境逐项验证，再形成应用自己的部署模板。

## 网络、身份和容器权限是不同边界

RBAC 管 API 操作，NetworkPolicy 管支持策略的网络流量，安全上下文管进程权限。Restricted 也不会自动扫描镜像漏洞、阻止所有数据外传或替你管理密码。生产还需最小镜像、固定版本、漏洞修复和审计，但每一项都应对应实际威胁和应用需求。

~~~bash
kubectl -n secure-lab describe pod safe-tool
kubectl -n secure-lab logs safe-tool
kubectl delete namespace secure-lab
~~~

删除专用 namespace 结束实验。基础 lab 没有被整体改成 Restricted，后续课可以继续运行。

## 继续阅读

- [安全上下文](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/security-context/)
- [Pod 安全标准](https://kubernetes.io/zh-cn/docs/concepts/security/pod-security-standards/)
