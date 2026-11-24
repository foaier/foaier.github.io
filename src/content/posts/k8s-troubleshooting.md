---
title: Pod 不正常时怎么查：从现象找到原因，再动手修
date: '2026-11-24'
summary: 逐个复现拉镜像失败、进程崩溃和服务不通，练习 describe、previous 日志、临时调试容器与恢复验证。
series: Docker 与 Kubernetes
order: 45
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-probes
  - k8s-resources
  - k8s-networking
goals:
  - 逐个复现拉镜像失败、进程崩溃和服务不通，练习 describe、previous 日志、临时调试容器与恢复验证。
---
排错先保留现场，再缩小范围。不要一上来删 Pod：删除可能让问题暂时消失，也可能把前一次退出日志和关键事件一起丢掉。我们在 lab 中创建单独的坏服务，不破坏正在使用的 web。

## 先用一组命令回答三件事

~~~bash
kubectl config current-context
kubectl -n lab get deployments,pods,services -o wide
kubectl -n lab get events --sort-by=.metadata.creationTimestamp
~~~

先确认操作的是 kind-course，再看有没有创建 Pod、Pod 是否有节点、容器是否启动。没有 Pod 就查控制器和准入事件；Pending 查调度；启动后退出查进程日志；Running 但请求失败再分 DNS、Service、端口和应用层。

## 练习一：镜像标签打错

~~~bash
kubectl -n lab create deployment broken-image --image=nginx:foaier-not-a-tag
kubectl -n lab get pods -l app=broken-image
kubectl -n lab describe pods -l app=broken-image
~~~

事件会显示拉取失败，状态可能从 ErrImagePull 进入 ImagePullBackOff。BackOff 是退避重试，并不是一个独立根因。仓库返回 not found、unauthorized、timeout 的处理不同：分别查标签、imagePullSecrets、网络。还没成功启动容器时，logs 通常没有应用日志。

~~~bash
kubectl -n lab set image deployment/broken-image nginx=nginx:1.28-alpine
kubectl -n lab rollout status deployment/broken-image --timeout=180s
kubectl -n lab delete deployment broken-image
~~~

修正后必须等 rollout 成功，不是 set image 返回 updated 就结束。若集群节点无法出网，宿主机能拉镜像也不能证明节点拉取一定成功。

## 练习二：进程启动后立即失败

~~~bash
kubectl -n lab create deployment crash-demo --image=busybox:1.37 -- sh -c 'echo missing-required-config; exit 1'
kubectl -n lab get pods -l app=crash-demo -w
~~~

出现重启后按 Ctrl+C，接着查本次与前次日志：

~~~bash
lab_pod=$(kubectl -n lab get pods -l app=crash-demo -o jsonpath='{.items[0].metadata.name}')
kubectl -n lab logs "$lab_pod" --tail=20
kubectl -n lab logs "$lab_pod" --previous --tail=20
kubectl -n lab describe pod "$lab_pod"
kubectl -n lab patch deployment crash-demo --type=merge -p '{"spec":{"template":{"spec":{"containers":[{"name":"busybox","image":"busybox:1.37","command":["sh","-c","echo recovered; sleep 3600"]}]}}}}'
kubectl -n lab rollout status deployment/crash-demo --timeout=120s
kubectl -n lab delete deployment crash-demo
~~~

`--previous` 看同一 Pod 内前一个容器实例，不是昨天那个已经删除的 Pod。Last State 的 reason 和 exitCode 配合日志分析；CrashLoopBackOff 只是反复退出后的等待状态，真正错误在 missing-required-config。

## 练习三：容器里没有 curl，怎么调试

不要为了排错把整套运维工具永久装进业务镜像。可以加入临时容器，共享这个 Pod 的网络：

~~~bash
kubectl apply -f basics/deployment.yaml -f basics/service.yaml
kubectl -n lab rollout status deployment/web --timeout=120s
lab_pod=$(kubectl -n lab get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl -n lab debug "$lab_pod" -it --image=busybox:1.37 --container=net-debug -- sh
~~~

进入容器后执行：

~~~sh
wget -S -O- http://127.0.0.1
nslookup web.lab.svc.cluster.local
wget -S -O- http://web.lab
exit
~~~

localhost 成功说明同 Pod 的应用端口可访问；DNS 失败但 IP 成功就查 DNS；域名解析成功而连接失败就继续查 Service 后端和策略。临时容器不能像普通容器一样随意删除或重启，调试退出后记录仍在 Pod 中；需要相应 RBAC 和准入许可。`--target` 的进程查看能力还取决于运行时，不能保证看到别的容器所有进程。

## 把现象和下一条命令对应起来

| 现象 | 先查 | 常见方向 |
| --- | --- | --- |
| Pending，没节点 | describe pod 的 Events | 资源、污点、亲和性、PVC |
| ContainerCreating 很久 | Events | 挂载、CNI、镜像、沙箱创建 |
| CreateContainerConfigError | Events | 缺 Secret、ConfigMap 或 key |
| OOMKilled | terminated、lastState、资源配置 | 内存上限、增长、节点压力 |
| Running 但 0/1 | 探针事件和应用日志 | readiness 路径、依赖、超时 |
| Service 无后端 | EndpointSlice、标签和 Ready | selector、端口名、探针 |

## 修复后如何确认不是碰巧恢复

重新请求业务接口，确认状态码与返回内容；观察错误率和重启次数不再增长；再验证发布文件已经修正，避免下次 apply 复发。记录触发条件、证据、根因、修复和预防动作，比写“重启后好了”有用。

~~~bash
kubectl -n lab rollout restart deployment/web
kubectl -n lab rollout status deployment/web --timeout=120s
kubectl -n lab get pods -l app=web
~~~

本课最后滚动替换 web，以移除临时调试容器。平时不要把这两条重启命令当成第一步诊断工具。

## 继续阅读

- [调试 Pod](https://kubernetes.io/zh-cn/docs/tasks/debug/debug-application/debug-pods/)
- [临时容器](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/ephemeral-containers/)
