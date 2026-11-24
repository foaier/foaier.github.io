# Kubernetes 留言项目

这是课程最后的综合实验：两个 ASP.NET Core API 副本连接一个 PostgreSQL。先完成 Pod、Service、Secret、探针和 PVC 课程，再部署本项目。基础课实验在另一个 k8s-labs.zip 中。

## 环境与目录

使用 Bash（Windows 为 WSL Ubuntu）、运行中的 Docker、kind 与 kubectl。在本目录应看到 Dockerfile、compose.yaml、k8s/。Docker 构建会使用 .NET SDK 镜像，本机不要求安装 .NET SDK。

先按基础课创建三节点 kind 集群 course。kind 自带 standard 默认存储类；本项目的全新 PVC 使用它，不需另装存储插件。已有旧版 local-path PVC 时不要直接修改其 storageClassName，也不要删数据硬套新清单；先保留原配置或备份迁移。

## 构建与部署

```bash
kubectl config use-context kind-course
kubectl get nodes
kubectl get storageclass standard
docker build -t container-course-api:local .
kind load docker-image container-course-api:local --name course
kubectl apply -f k8s/00-namespace.yaml
kubectl -n container-course create secret generic course-db --from-literal=password=course-local-only --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -k k8s
kubectl -n container-course rollout status deployment/postgres --timeout=240s
kubectl -n container-course rollout status deployment/course-api --timeout=240s
kubectl -n container-course port-forward service/course-api 8080:80
```

另开终端：

```bash
curl -fsS http://127.0.0.1:8080/health/ready
curl -i -X POST http://127.0.0.1:8080/visits -H 'Content-Type: application/json' -d '{"note":"my-first-k8s-note"}'
curl -fsS http://127.0.0.1:8080/visits
```

应看到数据库 connected、POST 返回 201、GET 能读回留言。应用首次按需建立演示表；正式项目使用版本化迁移。公开密码只用于本地实验，Secret 更新不会自动修改已有 PostgreSQL 账号密码。

## 故障与恢复

- /health/live 只检查进程响应，/health/ready 检查数据库连接。
- 缩容 postgres 到 0 后，API 应未就绪，但不因数据库短暂故障反复重启。恢复数据库到 1 副本后等待 API 重新就绪。
- API 是无状态副本；PostgreSQL 是单实例且使用 Recreate，不是高可用数据库。
- pg_dump 导出到 backups/，再恢复到独立验证库。完整命令在博客综合课，不能只看备份文件存在就认为可以恢复。
- labs/ 是旧的可选补充清单，不随 apply -k k8s 安装；HPA 需要 Metrics Server，NetworkPolicy 需要执行策略的 CNI，默认 kindnet 不执行策略。

## 单机运行和停止

如果只想本地看接口，可运行 docker compose up --build -d --wait；它会占用 8080，进入 Kubernetes 端口转发前用 docker compose down 停止。不要加 -v，除非确定要删除 Compose 数据卷。

集群里临时停服务：kubectl -n container-course scale deployment course-api postgres --replicas=0。恢复先 postgres=1，再 course-api=2。删除 namespace 会删除 PVC 和课程数据；删除 kind 集群也会删除节点本地数据，先确认备份和保留需求。
