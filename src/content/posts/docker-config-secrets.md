---
title: 容器里的配置怎么传？环境变量方便，但密钥不能随便写
date: '2026-11-24'
summary: 区分镜像构建时变量、容器运行配置和真正的秘密管理。
series: Docker 与 Kubernetes
order: 11
tags:
  - Docker 实战
  - Docker
  - Kubernetes
level: Docker 实战
prerequisites:
  - docker-ports
goals:
  - 用运行时环境变量配置数据库连接，并指出把密码写进镜像的风险。
---

同一个镜像，测试环境连测试数据库，线上环境连正式数据库。若每换环境都重新编译、重新做镜像，发布就容易失控。镜像尽量不带环境专属配置，运行时再把地址和开关传进去。

## 环境变量怎样变成 .NET 配置

Compose 的 `environment` 会在创建容器时设置环境变量，ASP.NET Core 会把 `ConnectionStrings__Default` 映射到配置树。这个办法适合演示和普通非敏感配置。密码同样作为普通环境变量传递时，可能被有权限的人通过 inspect、运维面板或诊断日志看见。ARG、ENV、源码里的字符串也不适合存真正的密钥。

## 查看课程 API 实际收到的配置

从这一课开始使用下载包自带的 Compose 文件，下一节再详细拆解它。先停掉前面占用 8080 的单独 API 容器。课程使用虚构本地密码，只观察配置怎样传给程序；不要同时修改数据库初始化配置。已有数据卷不会因为 POSTGRES_USER 或 POSTGRES_DB 改了就自动创建新用户、新数据库。

~~~powershell
docker compose config
docker compose up -d --wait
docker compose exec api printenv ConnectionStrings__Default
~~~

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

## 参考资料

- [ASP.NET Core 配置](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/)
- [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
