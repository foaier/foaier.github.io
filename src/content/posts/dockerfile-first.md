---
title: "写第一个 Dockerfile：把 .NET 小服务做成镜像"
date: "2026-11-24"
summary: "用 Dockerfile 描述 .NET API 如何编译、发布和启动。"
series: "Docker 与 Kubernetes"
order: 6
tags: ["Docker 基础","Docker","Kubernetes"]
level: "Docker 基础"
prerequisites: ["docker-debug"]
goals: ["构建并运行课程 API 镜像，区分 build 时和 run 时执行的事情。"]
---

`docker run` 能启动别人的镜像，但工作中总有一天要把自己的程序装进去。Dockerfile 就是一份按顺序执行的构建说明：选基础镜像、把文件复制进去、执行构建命令、声明启动方式。它不是在容器运行时临时执行的脚本，而是构建镜像的配方。

## 概念讲透：它负责什么，不负责什么

Dockerfile 的指令发生在不同阶段：FROM 选基础镜像，COPY 把构建上下文里的文件带入镜像，RUN 在构建时执行，ENV 和 EXPOSE 记录运行配置，ENTRYPOINT/CMD 定义容器启动进程。RUN dotnet publish 会在构建时结束；ENTRYPOINT dotnet ... 才会在容器启动时运行。写 Dockerfile 的目标是让构建步骤可重复、可审查。

## 运行过程拆解：从输入到结果

构建时 RUN 的结果进入镜像，ENTRYPOINT/CMD 描述运行时容器要执行的主进程；COPY 只能读取构建上下文中的文件。多阶段构建是先在 SDK 环境生成 publish 目录，再从该目录挑运行所需文件复制到 Runtime 阶段。理解每条指令的时间点，才能解释为什么 build 成功却启动失败，或为什么本机文件没有进镜像。

## 先拿到课程源码

先[下载课程源码](/downloads/container-course.zip)，解压后进入 `container-course` 文件夹。如果你克隆了整站仓库，则进入 `examples/container-course/`。这个目录下应该同时看到 Dockerfile、compose.yaml 和 src。

第一阶段使用 SDK 镜像编译，最后阶段用 ASP.NET Runtime 镜像运行。今天先关注最短路径，后面会分别解释构建上下文、缓存和多阶段构建。下载包中的 Dockerfile 已可直接使用，不需要手工抄一份才开始。

## 构建镜像，再启动 API

在容器课程目录运行构建，再启动服务。发布端口时绑定到 127.0.0.1，避免把本机练习服务暴露给局域网。镜像构建第一次要还原 NuGet 包，可能比后续构建慢。

~~~powershell
docker build -t container-course-api:local .
docker run --rm --name course-api -p 127.0.0.1:8080:8080 container-course-api:local
~~~

## 怎么确认做对了

终端显示 Kestrel 正在监听 8080。另开终端访问 `/`，应得到带 `message` 和主机名的 JSON；访问 `/health/live` 应得到 `alive`。由于还没有启动数据库，`/health/ready` 暂时会返回 503，这是正确的区分。

## 案例推演

镜像构建成功，容器一启动便报找不到应用文件。对照最终阶段的工作目录、COPY 来源和 ENTRYPOINT 指向，确认 publish 输出确实复制到了运行镜像。多阶段构建中 build 阶段存在的文件不会自动出现在 runtime 阶段，必须通过 COPY --from 明确带过去。然后再检查目标框架和运行时版本是否匹配。

## 留一个小练习

把映射的宿主机端口换成 8081，访问新端口。接着在 Dockerfile 的运行阶段暂时改掉 DLL 名，再重新 build；容器会启动失败。恢复后再做一次，感受镜像构建错误与容器运行错误是两件事。

## 没跑通时先查什么

build 失败先读第一条错误，不要只看最后的 exit code。找不到项目文件，多半是 Dockerfile 路径或 build context 不对；容器马上退出看 `docker ps -a` 和 logs。出现本机已有程序占用 8080，换宿主机左侧端口，容器内 8080 不用改。

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

## 生产里怎么用、怎么排障

线上构建要避免把开发环境文件、测试密钥和完整 SDK 混进运行镜像。用多阶段构建缩小运行时内容，设置非 root 用户，并验证文件权限、证书和临时目录需求。基础镜像固定到受支持的版本并定期重建获取安全补丁；只追求镜像最小可能导致缺少诊断工具和 CA 证书，得先测试应用真正需要什么。

## 参考资料

- [Dockerfile 写法](https://docs.docker.com/build/concepts/dockerfile/)
- [Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/)
