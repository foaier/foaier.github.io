---
title: 写第一个 Dockerfile：把 .NET 小服务做成镜像
date: '2026-11-24'
summary: 用 Dockerfile 描述 .NET API 如何编译、发布和启动。
series: Docker 与 Kubernetes
order: 6
tags:
  - Docker 基础
  - Docker
  - Kubernetes
level: Docker 基础
prerequisites:
  - docker-debug
goals:
  - 构建并运行课程 API 镜像，区分 build 时和 run 时执行的事情。
---

`docker run` 能启动别人的镜像，但工作中总有一天要把自己的程序装进去。Dockerfile 就是一份按顺序执行的构建说明：选基础镜像、把文件复制进去、执行构建命令、声明启动方式。它不是在容器运行时临时执行的脚本，而是构建镜像的配方。

## 先拿到课程源码

先[下载课程源码](/downloads/container-course.zip)，解压后进入 `container-course` 文件夹。如果你克隆了整站仓库，则进入 `examples/container-course/`。这个目录下应该同时看到 Dockerfile、compose.yaml 和 src。

第一阶段使用 SDK 镜像编译，最后阶段用 ASP.NET Runtime 镜像运行。今天先关注最短路径，后面会分别解释构建上下文、缓存和多阶段构建。下载包中的 Dockerfile 已可直接使用，不需要手工抄一份才开始。

## 构建镜像，再启动 API

在容器课程目录运行构建，再启动服务。发布端口时绑定到 127.0.0.1，避免把本机练习服务暴露给局域网。镜像构建第一次要还原 NuGet 包，可能比后续构建慢。

~~~powershell
docker build -t container-course-api:local .
docker run --rm --name course-api -p 127.0.0.1:8080:8080 container-course-api:local
~~~

## 把 Dockerfile 一行一行对上实际工作

~~~dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/ContainerCourse.Api/ContainerCourse.Api.csproj src/ContainerCourse.Api/
RUN dotnet restore src/ContainerCourse.Api/ContainerCourse.Api.csproj
COPY . .
RUN dotnet publish src/ContainerCourse.Api/ContainerCourse.Api.csproj --configuration Release --no-restore --output /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
COPY --from=build --chown=$APP_UID:$APP_UID /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "ContainerCourse.Api.dll"]
~~~

FROM 选构建环境，WORKDIR 决定后面的相对路径。前一个 COPY 只带项目声明，restore 还原依赖，第二个 COPY 才把源代码带进来。publish 输出可运行的文件；最终镜像只拿这份输出和运行时，不带完整 SDK。

USER 使用 .NET 官方 Linux 镜像提供的非 root UID。EXPOSE 只是端口说明，真正发布到电脑要靠 docker run -p。ENTRYPOINT 在容器启动时执行，RUN 则在构建时执行；把两者混用就会出现“构建时服务一直不退出”这类问题。

文件都齐了再运行本课构建命令。镜像构建时不连数据库，所以 build 成功不会保证 /visits 能用；数据库在后面的 Compose 章节接上。

## 从镜像记录确认构建结果

刚才的构建命令用 `-t` 给镜像起了名字，末尾的点表示以当前目录作为构建上下文。现在用 inspect 看镜像 ID 和体积，再用 `image ls` 确认标签留在本机。运行阶段的日志已经在上面前台启动时看过；按 Ctrl+C 后，`--rm` 会顺便清掉那次容器实例。

~~~powershell
docker image inspect container-course-api:local --format 'ID={{.Id}} size={{.Size}}'
docker image ls container-course-api
~~~

## Dockerfile 指令分别改变什么

| 指令 | 改变的内容 | 常见误用 |
|---|---|---|
| FROM | 选构建阶段的基础镜像 | 不锁定版本，导致未来重建内容变化 |
| WORKDIR | 后续相对路径的工作目录 | 假设当前目录总是根目录 |
| COPY | 把构建上下文文件放进镜像 | 把 .git、bin、obj 和密钥一起复制 |
| RUN | 构建时执行命令并形成镜像层 | 把只需在运行时做的事写进构建 |
| ARG / ENV | 构建参数 / 运行时环境变量 | 用 ARG 假装安全保存密码 |
| EXPOSE | 声明镜像预期使用的容器端口 | 误以为它会把端口发布到宿主机 |
| USER | 指定后续进程的运行身份 | 长期以 root 运行无必要的业务进程 |
| ENTRYPOINT / CMD | 定义启动程序及默认参数 | 用 shell 字符串导致信号传递不清楚 |

一个多阶段 Dockerfile 会把 SDK 和编译工具留在 build 阶段，只把发布后的程序复制到 runtime 阶段。这样不是把依赖藏起来，而是让运行镜像只包含服务启动所需文件。

## 读懂课程里的 .NET 多阶段 Dockerfile

下面的命令在解压后的 container-course 目录执行。Dockerfile 先复制项目文件并 restore，再复制源码 publish；后续只把 publish 目录复制进 ASP.NET runtime 镜像。先看每个阶段的基础镜像与产物去向，再运行构建。

~~~powershell
docker build --progress=plain -t container-course-api:lesson .
docker image inspect container-course-api:lesson --format 'size={{.Size}} arch={{.Architecture}}'
docker image history container-course-api:lesson
docker run --rm -p 127.0.0.1:8089:8080 container-course-api:lesson
~~~

另开终端请求 http://localhost:8089/health/live。看到响应说明运行时镜像含有应用发布文件并能启动；它不证明数据库配置有效，因为这个单容器实验没有启动 PostgreSQL。停止前先记录启动日志，再在原终端按 Ctrl+C。

## ENTRYPOINT 与 CMD 的差别会影响启动行为

Exec form 例如 ENTRYPOINT ["dotnet", "ContainerCourse.Api.dll"] 会让 dotnet 作为容器主进程，Docker 可以把停止信号发给它。Shell form 会多一层 shell，信号和参数转发可能不同。ENTRYPOINT 通常定义固定程序，CMD 提供默认参数；运行时在 docker run 后加参数，会替换 CMD 的默认参数。

~~~powershell
docker run --rm container-course-api:lesson --help
docker run --rm --entrypoint dotnet container-course-api:lesson --info
~~~

第一条是否能显示帮助取决于应用有没有实现该选项，重点是观察参数被传给默认入口；第二条临时覆盖入口，查看镜像中的 dotnet runtime。诊断完成后别把临时 entrypoint override 写进正式部署配置。

## 安全和可复现的几个检查点

基础镜像优先选受维护的官方镜像，并按团队更新策略固定版本；高保证场景再记录 digest。不要把私钥、连接密码写进 Dockerfile 的 ARG 或 ENV，也不要将宿主机路径假定为固定值。构建完成后检查最终镜像的 USER、入口、端口元数据和包含文件，确认运行阶段不带 SDK、源码仓库和构建凭据。

## 参考资料

- [Dockerfile 写法](https://docs.docker.com/build/concepts/dockerfile/)
- [Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/)
