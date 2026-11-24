---
title: Pod 的一生：初始化容器、共享目录和退出过程
date: '2026-11-24'
summary: 用两个容器共享网页文件，观察 initContainer 的阻塞行为、Pod 状态和优雅退出。
series: Docker 与 Kubernetes
order: 30
tags:
  - Kubernetes
level: Kubernetes 入门
prerequisites:
  - k8s-pod-yaml
  - k8s-architecture
goals:
  - 用两个容器共享网页文件，观察 initContainer 的阻塞行为、Pod 状态和优雅退出。
---
Pod 不只是“容器外面套一层名字”。一组容器放进同一个 Pod，意味着它们一起调度、共享网络，并可以共享声明的卷。最常见的还是一个主容器；只有生命周期和资源关系紧密的辅助任务才适合放在一起。

## 先把状态和阶段分开看

Pod 的 phase 有 Pending、Running、Succeeded、Failed、Unknown。`kubectl get pods` 的 STATUS 列还会显示 Init:0/1、CrashLoopBackOff、Terminating 等摘要，这些并非全是 phase。Running 也不保证每个容器都已就绪，应同时看 READY、重启次数和 conditions。

同 Pod 容器共享 IP 和端口空间，所以两个容器不能都监听 `0.0.0.0:80`；文件系统默认不共享，需要显式挂同一个 volume。下面通过 initContainer 生成网页，再启动 Nginx。

## 初始化容器先完成，网页容器再启动

~~~yaml file=basics/lifecycle.yaml
apiVersion: v1
kind: Pod
metadata:
  name: lifecycle
  namespace: lab
spec:
  terminationGracePeriodSeconds: 30
  initContainers:
    - name: prepare
      image: busybox:1.37
      command: ["sh", "-c", "echo preparing; sleep 10; echo 'page prepared by init' > /site/index.html"]
      volumeMounts:
        - name: page
          mountPath: /site
  containers:
    - name: nginx
      image: nginx:1.28-alpine
      volumeMounts:
        - name: page
          mountPath: /usr/share/nginx/html
    - name: observer
      image: busybox:1.37
      command: ["sh", "-c", "sleep 86400"]
      volumeMounts:
        - name: page
          mountPath: /site
  volumes:
    - name: page
      emptyDir: {}
~~~

~~~bash
kubectl apply -f basics/lifecycle.yaml
kubectl -n lab get pod lifecycle -w
~~~

先看到 Init:0/1，约十秒加上镜像下载时间后变成 `2/2 Running`。按 Ctrl+C 停止观察。普通 initContainer 按顺序执行并成功结束后，普通应用容器才启动；适合准备文件、有限的依赖检查，不适合无限等待永远不会出现的服务。

## 分别查看三个容器

~~~bash
kubectl -n lab logs lifecycle -c prepare
kubectl -n lab exec lifecycle -c observer -- cat /site/index.html
kubectl -n lab exec lifecycle -c observer -- wget -qO- http://127.0.0.1
~~~

日志有 preparing，两个读取命令都得到 page prepared by init。observer 通过 localhost 访问 nginx，证明共享网络；它通过 /site 读同一份文件，证明显式共享卷。`-c` 指定容器，多个容器时不要依赖默认选中了哪个。

## 制造初始化失败，识别阻塞位置

复制一份文件并把名字、初始化命令改掉：

~~~bash
cp basics/lifecycle.yaml /tmp/lifecycle-bad.yaml
sed -e 's/name: lifecycle/name: lifecycle-bad/' -e "s/echo preparing; sleep 10;/echo prepare-failed; exit 1;/" basics/lifecycle.yaml > /tmp/lifecycle-bad.yaml
kubectl apply -f /tmp/lifecycle-bad.yaml
kubectl -n lab get pod lifecycle-bad
kubectl -n lab logs lifecycle-bad -c prepare
kubectl -n lab describe pod lifecycle-bad
~~~

一段时间后可能看到 Init:Error 或 Init:CrashLoopBackOff，nginx 还没有启动。这里去查 nginx 日志当然看不到业务错误，要查 prepare。修复文件中的失败命令后重建这个实验 Pod；初始化失败不是靠给 Nginx 多加内存解决的。

## 删除时发生什么

删除请求先给对象设置终止信息，kubelet 在宽限时间内运行适用的 preStop 钩子并请求容器退出，超时后强制终止。preStop 的执行也占用终止宽限时间，不是另送一份等待时间。Service 后端移除和进程退出是异步过程，应用仍需处理在途请求、正确响应停止信号。

emptyDir 的内容可以跨同 Pod 内的容器重启保留，但 Pod 被删除后就消失。把数据库放 emptyDir，副本补回来也救不回数据。下一步学到存储时会用 PVC 进行对照实验。

~~~bash
kubectl -n lab delete pod lifecycle lifecycle-bad
kubectl -n lab get pods
~~~

保留其他课的 web，不删除整个 lab。普通 sidecar 与原生可重启 init sidecar 的启动、终止语义不同；本例 observer 是普通辅助容器，不能把它的行为套到所有 sidecar 实现上。

## 继续阅读

- [Pod 生命周期](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/pod-lifecycle/)
- [初始化容器](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/init-containers/)
