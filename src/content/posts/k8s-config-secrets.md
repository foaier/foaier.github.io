---
title: 配置和密码怎么交给 Pod：ConfigMap、Secret 与 Downward API
date: '2026-11-24'
summary: 分别实验环境变量、文件挂载和 Pod 元数据，观察配置更新为什么有时需要重建 Pod。
series: Docker 与 Kubernetes
order: 32
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-service
goals:
  - 分别实验环境变量、文件挂载和 Pod 元数据，观察配置更新为什么有时需要重建 Pod。
---
镜像里不要写死“测试环境”和数据库密码。程序相同，运行配置不同，把配置和程序分开才能复用镜像。ConfigMap 放普通配置；Secret 表示需要更严格访问控制的数据，但不是自动加密保险箱。

## 创建两种配置

全部命令在 kind-course、lab 中执行。这里只使用公开的教学密码，不输入真实凭证。

~~~bash
kubectl -n lab create configmap settings --from-literal=MODE=study --dry-run=client -o yaml | kubectl apply -f -
kubectl -n lab create secret generic demo-secret --from-literal=password=local-demo-only --dry-run=client -o yaml | kubectl apply -f -
kubectl -n lab get configmap settings
kubectl -n lab get secret demo-secret
~~~

`generic` 创建一般用途 Secret；类型是 Opaque。`get secret` 默认只列键数量，不显示值，但有读取权限的人仍可读取数据。Base64 只是编码，能反向解码；生产还需要 RBAC、etcd 静态加密或外部秘密管理、密钥轮换和审计。

## 让一个 Pod 同时读取变量和文件

~~~yaml file=config/reader.yaml
apiVersion: v1
kind: Pod
metadata:
  name: config-reader
  namespace: lab
spec:
  containers:
    - name: reader
      image: busybox:1.37
      command: ["sh", "-c", "sleep 86400"]
      env:
        - name: MODE
          valueFrom:
            configMapKeyRef:
              name: settings
              key: MODE
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
      volumeMounts:
        - name: settings
          mountPath: /etc/lab-config
          readOnly: true
        - name: password
          mountPath: /etc/lab-secret
          readOnly: true
  volumes:
    - name: settings
      configMap:
        name: settings
    - name: password
      secret:
        secretName: demo-secret
~~~

~~~bash
kubectl apply -f config/reader.yaml
kubectl -n lab wait --for=condition=Ready pod/config-reader --timeout=120s
kubectl -n lab exec config-reader -- printenv MODE POD_NAME
kubectl -n lab exec config-reader -- cat /etc/lab-config/MODE
kubectl -n lab exec config-reader -- ls /etc/lab-secret
~~~

应看到环境变量 study、Pod 名 config-reader，目录里分别有 MODE 和 password 文件。没有把密码写进日志。Downward API 的 fieldRef 让 Pod 获得自身名字等元数据，不用应用额外登录 API Server 查询自己是谁。

## 修改配置，观察两种注入方式的不同

~~~bash
kubectl -n lab patch configmap settings --type=merge -p '{"data":{"MODE":"practice"}}'
kubectl -n lab exec config-reader -- printenv MODE
kubectl -n lab exec config-reader -- cat /etc/lab-config/MODE
~~~

环境变量仍是 study，因为它在启动时确定；目录挂载的文件会经过 kubelet 同步后变成 practice，可能需要等一段时间，重复最后一条观察即可。这里没有使用 subPath；subPath 挂载不会随 ConfigMap 自动更新。

文件变了不等于应用生效了。如果应用只在启动时读文件，还需要重载或重启。不要把“卷内容更新”和“程序自动热更新”当成一个承诺。

## 重建 Pod，让变量也更新

~~~bash
kubectl -n lab delete pod config-reader
kubectl apply -f config/reader.yaml
kubectl -n lab wait --for=condition=Ready pod/config-reader --timeout=120s
kubectl -n lab exec config-reader -- printenv MODE
~~~

现在返回 practice。Deployment 可以用 `rollout restart` 滚动重建，独立 Pod 则需要重建。正式应用最好让配置版本和发布版本一起管理，避免新旧 Pod 在不知情的情况下读到不同配置。

## 找不到配置时，不要先改镜像

Secret、ConfigMap 必须与 Pod 在同一 namespace，名称和 key 要完全一致。缺失引用可能表现为 CreateContainerConfigError 或 FailedMount；`kubectl -n lab describe pod config-reader` 的事件会直接指出对象或键名。`immutable: true` 可以禁止后续修改数据，适合按版本新建配置，但这时更新需要新对象名和新 Pod 模板。

~~~bash
kubectl -n lab delete pod config-reader
kubectl -n lab delete configmap settings
kubectl -n lab delete secret demo-secret
~~~

清理只删除本课三个对象。不要用删除整个 namespace 的方式顺手清掉其他课程的服务。

## 继续阅读

- [ConfigMap](https://kubernetes.io/zh-cn/docs/concepts/configuration/configmap/)
- [Secret](https://kubernetes.io/zh-cn/docs/concepts/configuration/secret/)
