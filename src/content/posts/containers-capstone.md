---
title: 综合练习：部署留言 API，断开数据库，再备份恢复
date: '2026-11-24'
summary: 把镜像、Deployment、Service、Secret、探针和 PVC 串起来，完成一次业务验证与独立数据库恢复。
series: Docker 与 Kubernetes
order: 55
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-storage
  - k8s-probes
  - k8s-rollouts
  - k8s-troubleshooting
goals:
  - 把镜像、Deployment、Service、Secret、探针和 PVC 串起来，完成一次业务验证与独立数据库恢复。
---
前面每课只练一种能力。现在用一个小项目把它们连起来：两个 API 副本接同一个 PostgreSQL，写入留言、重建实例、制造数据库故障，再把备份恢复到另一个数据库验证。目标是能解释每个对象为什么存在，而不是盲目 apply 一整目录。

## 准备独立项目，确认文件和环境

[下载留言项目源码](/downloads/container-course.zip)，解压后进入 `container-course`，这一课不再从 k8s-labs 目录执行。运行 `ls Dockerfile k8s/20-api.yaml` 应看到文件。无需电脑安装 .NET SDK，Docker 构建阶段会编译程序。

项目提供 `GET /`、`GET /health/live`、`GET /health/ready`、`GET /visits` 和 `POST /visits`。live 只检查 API 进程响应；ready 连接数据库执行 SELECT 1；visits 才是业务读写。两个健康地址的区别会在故障实验里看到。

~~~bash
kubectl config use-context kind-course
docker version
kubectl get nodes
kubectl get storageclass standard
docker build -t container-course-api:local .
kind load docker-image container-course-api:local --name course
~~~

宿主机 Docker 构建的镜像不会自动进入节点 containerd，因此要 kind load。YAML 使用 IfNotPresent 和 local 标签，后续同标签重新构建要重新 load 并重建 Pod；正式发布使用唯一 tag/digest。

## 先认识六个资源，再部署

| 对象 | 用途 |
| --- | --- |
| container-course namespace | 与前面的练习隔开 |
| course-db Secret | 提供本地教学数据库密码 |
| postgres-data PVC | 保存数据库文件 |
| postgres Deployment + Service | 单实例数据库和稳定名称 |
| course-api Deployment + Service | 两个 API 副本和访问入口 |
| course-api ServiceAccount | API 专用身份，不挂 API Token |

数据库 Deployment 用 Recreate，避免更新期间同时有两个实例争用同一数据目录；这只是单实例教学部署，并非高可用数据库。API 安全配置限制非 root、禁止提权、只读根目录，把 /tmp 作为可写临时卷。

~~~bash
kubectl apply -f k8s/00-namespace.yaml
kubectl -n container-course create secret generic course-db --from-literal=password=course-local-only --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -k k8s
kubectl -n container-course rollout status deployment/postgres --timeout=240s
kubectl -n container-course rollout status deployment/course-api --timeout=240s
kubectl -n container-course get pods,services,pvc
~~~

全新 kind 使用自带 standard 存储类。若旧实验已经有 local-path 类 PVC，字段不能原地更换；保留旧清单或先备份再迁移，不能因为本文更新就删掉旧数据。数据库密码只在初始化空数据目录时创建账号；修改 Secret 不是修改数据库内部密码的完整操作。

## 写入并读回一条留言

~~~bash
kubectl -n container-course port-forward service/course-api 8080:80
~~~

保持转发，另一个终端执行：

~~~bash
curl -fsS http://127.0.0.1:8080/health/ready
curl -i -X POST http://127.0.0.1:8080/visits -H 'Content-Type: application/json' -d '{"note":"my-first-k8s-note"}'
curl -fsS http://127.0.0.1:8080/visits
~~~

ready 返回 connected，POST 返回 201 与新记录，GET 能读回 note。只看首页 200 不够，因为首页不需要数据库。首次业务请求会按需创建演示表；正式项目应使用独立、版本化数据库迁移流程。

## 替换 API，数据应该不变

先 Ctrl+C 关闭端口转发，再滚动替换，避免转发绑定的旧 Pod 退出造成干扰：

~~~bash
kubectl -n container-course rollout restart deployment/course-api
kubectl -n container-course rollout status deployment/course-api --timeout=180s
kubectl -n container-course port-forward service/course-api 8080:80
~~~

重新 GET /visits，记录仍在，证明它保存在数据库卷中。API 副本替换后若 port-forward 断开，重新建立转发即可，不能把调试通道断开误判为数据丢失。

## 故意停数据库，观察摘流而非重启风暴

另开终端：

~~~bash
kubectl -n container-course scale deployment postgres --replicas=0
kubectl -n container-course get pods -w
~~~

过几个探针周期，API 可能变成 `0/1 Running`，RESTARTS 不应仅因数据库断开而持续增长。按 Ctrl+C 停观察：

~~~bash
kubectl -n container-course get endpointslices -l kubernetes.io/service-name=course-api -o yaml
curl -i http://127.0.0.1:8080/health/live
curl -i http://127.0.0.1:8080/health/ready
kubectl -n container-course scale deployment postgres --replicas=1
kubectl -n container-course rollout status deployment/postgres --timeout=180s
kubectl -n container-course rollout status deployment/course-api --timeout=180s
~~~

转发直达选中的 Pod，所以还能看到 live 200、ready 503；它不等同于经过正常 Service 后端筛选。数据库恢复后 Ready 重新为 true，记录仍可读。若初次无法新建转发，先在已有 API Pod 上转发调试，别靠关闭探针绕过故障。

## 备份并恢复到另一个数据库

不要破坏原库做第一次恢复练习。停止转发后，在项目根目录保存自定义格式备份：

~~~bash
mkdir -p backups
kubectl -n container-course exec deployment/postgres -- pg_dump -U course -d course -Fc > backups/course.dump
test -s backups/course.dump
kubectl -n container-course exec deployment/postgres -- createdb -U course course_restore_check
kubectl -n container-course exec -i deployment/postgres -- pg_restore -U course -d course_restore_check --no-owner < backups/course.dump
kubectl -n container-course exec deployment/postgres -- psql -U course -d course_restore_check -c 'SELECT id, note FROM visits ORDER BY id;'
~~~

恢复库中应有 my-first-k8s-note。`-i` 把本机文件传给容器标准输入，不加 `-t`，避免终端处理破坏二进制内容。若验证库已存在，先检查是否还要保留，不能为了重复执行直接覆盖未知数据库。

## 这次实验的验收与清理

你应能做到：解释请求路径、找到两个 API 和一个数据库、写入读回、替换 API 后保留数据、数据库断开时定位 readiness、恢复备份并查到真实记录。失败时回到对应层查事件和日志，而不是重新装整个集群。

只删除恢复验证库：

~~~bash
kubectl -n container-course exec deployment/postgres -- dropdb -U course course_restore_check
~~~

如果要暂时停止项目并保留数据，缩容两个 Deployment；恢复时先数据库 1 副本，再 API 2 副本。若确定课程数据和备份都不再需要，才删除 namespace：

~~~bash
kubectl -n container-course scale deployment course-api postgres --replicas=0
kubectl -n container-course get pvc
# 以下会删除本课 PVC 及其数据，确认不再需要再执行
kubectl delete namespace container-course
~~~

整个课程全部结束后，可用 `kind delete cluster --name course` 删除主练习集群，其中所有课程对象和节点本地数据都会消失。生产上线还需要真实认证、迁移、备份保留、资源压测、发布流程和外部入口，不把这套本地练习当成完整生产架构。

## 继续阅读

- [配置最佳实践](https://kubernetes.io/zh-cn/docs/concepts/configuration/overview/)
- [PostgreSQL 备份恢复](https://www.postgresql.org/docs/17/backup-dump.html)
