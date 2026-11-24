---
title: Java 镜像实战：Spring Boot、多阶段构建与普通用户运行
date: '2026-11-24'
summary: 下载完整源码，在 Docker 内编译 JAR，再用 JRE 镜像运行。
series: Docker 与 Kubernetes
order: 15
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - docker-build-context
goals:
  - 构建并验收 Java 服务，区分存活与依赖就绪。
---
静态网页能打镜像了，下一步把 Java 服务装进去。这里用 Java 21 和 Spring Boot 做一个小应用，运行时监听 8080。源码已经提供，不要求你先会 Spring MVC、JDBC 或 Redis 编程。

本课只运行不依赖数据库的首页和存活接口；下一阶段再接 MySQL、Redis。先把“编译 JAR”和“运行 JAR”分开，避免一次遇到太多问题。

## 下载源码，确认自己在哪个目录

[下载 Docker 实验源码](/downloads/docker-labs.zip)，把压缩包解压到用户主目录，确保最终目录是 `~/docker-labs`。Windows 用户在 Ubuntu 中操作，也可以在 Ubuntu 终端下载已发布的示例：

~~~bash
cd ~
curl -fL https://foaier.github.io/downloads/docker-labs.zip -o docker-labs.zip
unzip docker-labs.zip
cd ~/docker-labs/java-app
ls Dockerfile pom.xml src
~~~

已有同名实验目录时先换一个解压位置，不要覆盖自己的改动。若没有 unzip，Ubuntu 可 `sudo apt-get install unzip`。只浏览仓库的读者也可直接进入 `examples/docker-labs/java-app`，之后的相对路径都从该目录计算。

项目里主要是 pom.xml（依赖与构建说明）、src（代码）、Dockerfile（镜像配方）。不需要本机安装 Maven 或 JDK，构建阶段的镜像会提供它们。

## 多阶段 Dockerfile 读一遍

~~~dockerfile
# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package

FROM eclipse-temurin:21-jre-jammy AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home app
WORKDIR /app
COPY --from=build --chown=10001:10001 /workspace/target/app.jar ./app.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
~~~

build 阶段用 Maven 编译，产物是 `/workspace/target/app.jar`。runtime 阶段只带 JRE 和这个 JAR；`COPY --from=build` 明确告诉 Docker 从前一阶段取文件。编译器、Maven 和源码不会因为在 build 阶段存在就自动进入最终镜像。

curl 是后面容器健康检查要用的工具，显式安装，避免写了检查命令却发现镜像里没有它。USER 指定普通用户，COPY 配好所有权。最终应用需要临时目录时仍应保证可写。

## 构建并启动首页

~~~bash
docker build --progress=plain -t foaier-java:lesson .
docker run --name java-note -d -p 127.0.0.1:8088:8080 foaier-java:lesson
docker logs -f java-note
~~~

首次要下载基础镜像与 Maven 依赖，耗时较长。日志出现 Spring Boot 的 Started 后按 Ctrl+C，再访问：

~~~bash
curl -f http://localhost:8088/
curl -f http://localhost:8088/health/live
curl -i http://localhost:8088/health/ready
~~~

首页应有 `hello-docker`，live 应是 alive；ready 暂时返回 503，因为 MySQL、Redis 还没启动。这是刻意区分“进程活着”和“业务依赖可用”，不用为了消除 503 去乱改端口。

## 看看运行镜像到底带了什么

~~~bash
docker exec java-note id
docker exec java-note java -version
docker exec java-note sh -c 'ls -lh /app/app.jar; command -v mvn || true'
docker image inspect foaier-java:lesson --format 'user={{.Config.User}} size={{.Size}}'
~~~

id 应是 10001，JAR 应存在，mvn 通常没有结果。`|| true` 只是让这条检查在找不到 Maven 时仍正常结束，不是在运行构建时忽略错误。

生产镜像不仅看体积，还要看基础镜像更新、运行身份、证书、临时目录和可追溯版本。最小镜像如果缺少程序必需的库，一样无法运行。

## 三种失败分开处理

Maven 下载超时发生在构建依赖阶段，先检查网络或企业 Maven 仓库。`Unable to access jarfile` 发生在启动时，核对 COPY 产物和入口路径。`UnsupportedClassVersionError` 则是编译与运行 Java 版本不匹配。

这份源码将数据库连接推迟到请求时，因此没有数据库也能看首页；不要据此推断所有 Spring Boot 应用都能无依赖启动。完成本节后停掉容器，保留镜像给 Compose 使用：

~~~bash
docker stop java-note
docker rm java-note
~~~

## 继续阅读

- [命令与配置说明](https://docs.docker.com/build/building/multi-stage/)
- [进一步了解相关机制](https://docs.spring.io/spring-boot/reference/packaging/container-images/dockerfiles.html)
