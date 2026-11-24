# Docker 实验源码

终端：Bash。Windows 用 Docker Desktop + WSL 2 的 Ubuntu；macOS/Linux 用本机终端。需要 Docker Engine 和 Compose 插件。Java 在镜像内编译，不要求本机安装 JDK/Maven。

解压后从 docker-labs 目录执行。初次使用保留这个目录名即可；本文中的教学密码只用于本机实验，不放真实凭据。所有主机端口绑定 127.0.0.1，数据库与 Redis 仅在项目内部网络访问。

## Java + MySQL + Redis

```bash
docker compose config -q
docker compose up --build -d --wait --wait-timeout 240
docker compose ps
curl -f http://localhost:8080/health/ready
curl -f -X POST --data-urlencode 'note=hello Docker' http://localhost:8080/visits
curl -f http://localhost:8080/visits
```

根目录 compose.yaml 使用 java-app 中的 Spring Boot 项目。MySQL 初始化执行 mysql/init.sql，Redis 加载 redis/redis.conf。命名卷独立于容器；初始化 SQL 和 MYSQL_* 变量不会重新修改已有数据目录。

`/health/live` 只检查进程，`/health/ready` 检查 MySQL 和 Redis，`/visits` 写 MySQL 留言并递增 Redis 计数。数据库和 Redis 不共享事务，计数不用于强一致业务。此示例没有认证或数据分页，不作为公网业务直接部署。

查看日志：`docker compose logs --tail 50 app mysql redis`。停止并保留数据：`docker compose down`。只有明确不要实验数据时才加 `-v`。

## MySQL 主从

在 replication 目录执行 `docker compose up -d --wait --wait-timeout 240`。source 与 replica 都用 MySQL 8.4，使用独立卷与网络，不发布主机端口。按博客中的 MySQL 主从章节配置复制账号与 GTID；启动两个容器本身不会建立复制关系。

本节从全新数据库开始，不用于已有生产数据。所有 root 教学密码为 local-root-only。结束时在该目录执行 `docker compose down`，清空实验时才使用 `down -v`。

## Redis Cluster

在 redis-cluster 目录执行 `docker compose up -d --wait`，默认启动 r1～r6。按文章执行 `redis-cli --cluster create` 后才组成集群。r7/r8 通过 `docker compose --profile grow up -d --wait r7 r8` 启动。

使用独立子网 172.30.99.0/24，冲突时必须同步调整子网、节点地址和文章中的实验命令。未配置密码与 TLS，未发布主机端口；客户端通过 `docker compose exec` 在实验网络内部运行，不能直接用于公开环境。

清理整个实验使用 `docker compose --profile grow down`；需要彻底重做才加 `-v`。扩缩容、迁槽、故障切换按章节顺序操作，先验收数据和槽覆盖，再删节点。

## 监控

monitoring 目录适合独占 Ubuntu 练习机的 rootful Docker，数据根目录 /var/lib/docker，需可访问 /dev/kmsg。cAdvisor 拥有高权限主机读取能力，Desktop/rootless/其他数据目录需要适配，不视为通用一键运行环境。

在该目录执行 `docker compose up -d`。Prometheus：http://localhost:9090，Grafana：http://localhost:3001，练习 Nginx：http://localhost:8092。Grafana 首次默认 admin/admin 登录后立即修改密码，Prometheus 数据源已配置。先确认 Targets 中 cadvisor 为 UP，再查询容器指标。

停止用 `docker compose down`，默认保留指标与面板卷。

## 自动构建

workflows/java-image.yml 是读者独立仓库的示例。将本目录作为仓库根目录，然后复制文件到 .github/workflows/java-image.yml。push main 发布提交号标签到 GHCR；PR 和手工运行只构建。这里的配置不会自动改变博客站点的部署流程。

## 验证范围

文件可做 Compose 配置解析、Java 编译与 Markdown 命令语法检查。真实镜像拉取、数据库复制、Redis 迁槽及 cAdvisor 指标需要 Docker Engine 和对应实验环境；预期输出不等于每台电脑已实跑通过。
