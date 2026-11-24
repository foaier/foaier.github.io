# Docker 与 Kubernetes 课程示例

这个示例陪着课程一步一步往前走：先做一个很小的 ASP.NET Core API，再给它配上 PostgreSQL；同一份 API 可以用 Docker 启动、用 Compose 连接数据库，之后再部署到 kind 或其他 Kubernetes 集群。

## 需要准备什么

- Windows 11：Docker Desktop，开启 WSL 2 后端；macOS：Docker Desktop；Linux：Docker Engine 和 Compose Plugin。
- 本地 Kubernetes 练习使用 kind。安装 `kubectl`，并确认当前集群是练习用的本机集群。
- 可选：.NET 10 SDK。容器构建会在 Docker 里使用 .NET SDK 镜像，运行 Compose 不要求宿主机安装 .NET。

## 先启动一个 API

在本目录运行：

```powershell
docker build -t container-course-api:local .
docker run --rm -p 127.0.0.1:8080:8080 container-course-api:local
```

另开终端访问 `http://localhost:8080/`。PowerShell 可以用 `Invoke-RestMethod http://localhost:8080/`。按 Ctrl+C 停止容器。`--rm` 表示停止时删除这个临时容器；镜像还在。

## 再加 PostgreSQL

```powershell
docker compose up --build -d --wait
docker compose ps
Invoke-RestMethod http://localhost:8080/health/ready
Invoke-RestMethod -Method Post -Uri http://localhost:8080/visits -ContentType "application/json" -Body '{"note":"第一次 Compose 实验"}'
Invoke-RestMethod http://localhost:8080/visits
```

停止并保留数据库数据：`docker compose down`。实验性地连数据一起清掉：`docker compose down -v`。第二条会删除 Compose 卷中的课程数据，先确认你确实不需要它。

`course-local-only` 只是本机课程密码。仓库没有真实密钥。生产环境要把密码放进受保护的部署 Secret 或秘密管理服务，不要照搬这个示例值。
`k8s/kustomization.yaml` 使用 Kustomize 管理本地清单。课程 API 使用专用 ServiceAccount，且不自动挂载 Kubernetes API token。

## 在 kind 里部署

在本目录创建名为 course 的练习集群并载入镜像。若同名集群已存在，确认它是自己的 kind 练习环境后跳过创建步骤：

```powershell
kind create cluster --name course
kind load docker-image container-course-api:local --name course
kubectl apply -f k8s/00-namespace.yaml
# 仅首次创建 Secret；若已存在且密码未变，跳过这行
kubectl -n container-course create secret generic course-db --from-literal=password=course-local-only
kubectl apply -k k8s
kubectl -n container-course rollout status deployment/postgres --timeout=120s
kubectl -n container-course rollout status deployment/course-api --timeout=120s
kubectl -n container-course port-forward service/course-api 8080:80
```

另开终端用前面的 `/health/ready` 和 `/visits` 验证服务。kind 只是本地练习集群，不具备生产环境的多节点高可用或云盘备份。删除集群会删除这个练习集群的状态。

## 可选实验

`labs/` 提供可选的 HPA、NetworkPolicy 和 PDB 示例，不会随 `kubectl apply -k k8s` 自动部署。HPA 需要 Metrics Server；网络策略需要支持策略执行的 CNI。默认 kind 不具备这些条件，先完成对应章节的环境检查。

## GitHub Actions 镜像发布

仓库中的 `.github/workflows/container-course.yml` 会先编译 API，再构建 OCI 镜像。Pull Request 只构建，不发布。推送到 `main` 时使用内置 `GITHUB_TOKEN` 将镜像推到 GHCR，标签包含短提交号；默认分支另外更新 `latest`。

发布后，在部署端使用带提交号的标签，例如 `ghcr.io/foaier/container-course-api:sha-abc1234`，以 Actions 日志中的实际标签为准。GitHub Container Registry 新建的包可能默认是私有的，拉取端需要登录；不要把镜像标签当成访问授权。课程示例不会自动 SSH 登录你的服务器或替你部署到生产环境。

## 健康检查这几个地址有什么区别

- `/health/live`：进程能响应；Kubernetes 用它判断容器是否需要重启。
- `/health/ready`：数据库连接可用；未就绪的 API 不应接收业务流量。
- `/visits`：需要数据库。第一次写入时创建演示表，目的只是少引入一套迁移工具。真实服务应使用版本化数据库迁移。

固定依赖和命令见项目文件。代码示例是教学用的单实例 PostgreSQL 配置；PVC 不等于备份，单副本数据库也不是高可用集群。
