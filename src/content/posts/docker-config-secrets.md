---
title: "容器里的配置怎么传？环境变量方便，但密钥不能随便写"
date: "2026-11-24"
summary: "区分镜像构建时变量、容器运行配置和真正的秘密管理。"
series: "Docker 与 Kubernetes"
order: 11
tags: ["Docker 实战","Docker","Kubernetes"]
level: "Docker 实战"
prerequisites: ["docker-ports"]
goals: ["用运行时环境变量配置数据库连接，并指出把密码写进镜像的风险。"]
---

同一个镜像，测试环境连测试数据库，线上环境连正式数据库。若每换环境都重新编译、重新做镜像，发布就容易失控。镜像尽量不带环境专属配置，运行时再把地址和开关传进去。

## 概念讲透：它负责什么，不负责什么

同一份镜像应该能通过运行时配置进入开发、测试和生产环境。环境变量很方便，但不是秘密保险箱：有权限的人可从容器配置或进程环境中读取。Dockerfile 的 ARG/ENV 适合非敏感构建参数和默认值，密码不该写进 Dockerfile、镜像标签、日志或命令历史。构建秘密应使用 BuildKit secret，运行秘密使用受控注入。

## 运行过程拆解：从输入到结果

配置需要走“同一镜像、不同环境值”的路径：开发与生产分别提供连接地址、日志级别和凭据，应用启动时读取并验证。Docker CLI 的 -e、Compose environment 和宿主环境插值方式不同，排查实际值要看最终容器配置；但 inspect 可能暴露密码。应用报连接失败时先对照键名、配置层级和目标地址，不要把完整连接串贴进公开日志。

## 环境变量怎样变成 .NET 配置

Compose 的 `environment` 会在创建容器时设置环境变量，ASP.NET Core 会把 `ConnectionStrings__Default` 映射到配置树。这个办法适合演示和普通非敏感配置。密码同样作为普通环境变量传递时，可能被有权限的人通过 inspect、运维面板或诊断日志看见。ARG、ENV、源码里的字符串也不适合存真正的密钥。

## 查看课程 API 实际收到的配置

从这一课开始使用下载包自带的 Compose 文件，下一节再详细拆解它。先停掉前面占用 8080 的单独 API 容器。课程使用虚构本地密码，只观察配置怎样传给程序；不要同时修改数据库初始化配置。已有数据卷不会因为 POSTGRES_USER 或 POSTGRES_DB 改了就自动创建新用户、新数据库。

~~~powershell
docker compose config
docker compose up -d --wait
docker compose exec api printenv ConnectionStrings__Default
~~~

## 怎么确认做对了

`docker compose config` 会渲染合并后的配置，可确认变量是否传到了服务。命令输出中的密码会直接出现在终端，因此不要截图分享。换个配置后 `/health/ready` 应反映数据库连通情况，而不是看应用“有没有启动”猜。

## 案例推演

开发者为测试数据库把密码写到 Dockerfile 的 ENV，再把镜像推到仓库。即便后来删掉那一行，旧镜像层和构建缓存仍可能留着密码。正确处置是先轮换密码、限制或撤下泄露镜像，再把秘密迁到运行时秘密存储；之后用非敏感环境变量配置地址和用户名，验证应用确实拿到了新凭证。

## 留一个小练习

只把 `api.environment.ConnectionStrings__Default` 中的 Database 改成一个不存在的名字，运行 `docker compose up -d api`，观察 readiness 变为 503；数据库服务的配置和数据卷不改。随后恢复连接串再 up，确认返回 ready。环境变量只是配置入口，真实密钥还需要受控来源和轮换。

## 没跑通时先查什么

应用读到空配置，检查环境变量名称中的双下划线，以及 Compose 服务是否重新创建。`docker compose restart` 不会重新读取所有修改过的配置；`up -d` 才会按变更重新协调容器。秘密轮换后要确认连接池、旧容器和日志中没有继续使用旧值。

## 生产里怎么用、怎么排障

环境变量更新通常不会自动改写已经运行的进程，容器要按发布流程重新创建；密钥轮换需安排新旧凭证并存窗口。限制谁能 inspect 容器、读 CI 日志和拉镜像，也要防止异常时把连接串原样写入日志。配置缺失应在应用启动时快速失败并指出缺少哪个键，错误信息不能打印密钥值。

## 参考资料

- [ASP.NET Core 配置](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/)
- [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
