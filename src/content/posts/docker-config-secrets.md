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

## 确认容器仍在运行，再看应用启动日志

本地练习可以检查服务状态和最近日志，但不要把连接串或密码直接打印到终端截图里。出现数据库认证错误时，用 readiness 和数据库日志确认问题，不要用完整环境变量证明密码存在。

~~~powershell
docker compose ps api db
docker compose logs --tail 30 api db
~~~


## 配置、环境变量和密钥不是同一种东西

配置决定程序按什么业务参数运行，例如日志级别、服务地址和功能开关；密钥用于证明身份，例如数据库密码、签名密钥和访问令牌。环境变量只是一种传递渠道，不会因为名字叫 PASSWORD 就自动加密。docker inspect 可能显示容器配置中的环境变量，日志也可能意外打印它们。

| 方式 | 适合什么 | 更新后通常是否需要重建容器 |
|---|---|---|
| 镜像内默认值 | 安全且不随环境变化的默认配置 | 需要构建新镜像 |
| Compose environment | 本机或部署环境注入非秘密配置 | 需要重新创建容器让进程读取 |
| 挂载配置文件 | 文件型配置，应用能按约定读取 | 文件可能更新；应用是否热加载由应用决定 |
| Secret 文件或外部秘密系统 | 凭据、证书和令牌 | 取决于挂载方式和应用重载能力 |

课程 Compose 为了让读者本机可复现，密码写的是公开的 course-local-only。这只是演示数据，绝不能作为生产密码。仓库、镜像层、构建参数和截图中都不要放真实密钥。

## 看 Compose 实际会注入什么，但不要泄露输出

Compose 会在创建容器时把 environment 值交给应用。它不是一个自动轮换秘密的平台。若检查最终展开配置，输出可能含有真实值，不要把完整结果贴到公开工单。

~~~powershell
docker compose config --services
docker compose ps
docker compose exec api printenv ASPNETCORE_HTTP_PORTS
docker compose exec api printenv ConnectionStrings__Default
~~~

第二个变量在本地课程中包含演示密码，只能在自己的终端验证，不能截图或分享输出。生产排错优先确认变量是否存在、引用名是否一致；可以比较长度或配置键名，不必把密钥值写入日志。

## 用 Compose secret 文件表达“只给需要它的服务”

Compose 的 secrets 可以把指定文件只挂载给声明使用它的服务，容器内通常从 /run/secrets/secret-name 读取。它能减少环境变量和镜像层暴露面，但本地 Compose 文件来源的 secret 不等于云端加密保管库；主机文件权限、备份和部署平台仍要保护好。

~~~~yaml
services:
  api:
    secrets:
      - db_password
secrets:
  db_password:
    file: ./secrets/db_password.txt
~~~~

此片段用于解释结构，课程 Compose 目前仍用演示环境变量连接数据库；如果要改成文件形式，API 程序必须同步支持读取该路径。不要只改 YAML 就假设应用会自动读取 /run/secrets。

## 密钥轮换要包含应用重载和旧凭证失效

轮换不是把文件改掉就结束。通常要先生成新凭据、更新秘密来源、让服务安全地重新加载、验证新连接，然后让旧凭据失效。数据库密码轮换还需协调应用副本和数据库账户；若应用无法热加载，更新配置后应滚动重建容器并确认新进程已使用新值。

## 生产里怎么用、怎么排障

环境变量更新通常不会自动改写已经运行的进程，容器要按发布流程重新创建；密钥轮换需安排新旧凭证并存窗口。限制谁能 inspect 容器、读 CI 日志和拉镜像，也要防止异常时把连接串原样写入日志。配置缺失应在应用启动时快速失败并指出缺少哪个键，错误信息不能打印密钥值。

## 参考资料

- [ASP.NET Core 配置](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/)
- [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
