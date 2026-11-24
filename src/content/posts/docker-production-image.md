---
title: "给生产环境的镜像瘦身：编译和运行别挤在一个大镜像里"
date: "2026-11-24"
summary: "用多阶段构建只带发布产物，了解运行时基础镜像、非 root 用户和镜像大小。"
series: "Docker 与 Kubernetes"
order: 9
tags: ["Docker 实战","Docker","Kubernetes"]
level: "Docker 实战"
prerequisites: ["docker-layer-cache"]
goals: ["说明 SDK 镜像和 ASP.NET Runtime 镜像分别干什么，并验证应用以非 root 身份运行。"]
---

SDK 镜像里有编译器、还原工具和很多依赖；线上只是运行编译好的服务，却把整套 SDK 带过去，镜像体积和攻击面都白白变大。多阶段构建让编译发生在第一阶段，最后只从发布目录挑文件到运行阶段。

## 最终镜像只带运行所需的文件

课程 Dockerfile 的 `build` stage 用 dotnet/sdk，`runtime` stage 用 dotnet/aspnet。最后镜像不继承 build stage 的文件系统。运行用户使用官方镜像提供的非 root APP_UID。只读应用路径、最小运行权限和少装工具，会让事故时少一些不必要的入口。

## 检查镜像体积和运行用户

用 `docker image inspect` 查看镜像大小，再启动 API 打印进程用户。可以在临时练习分支加入 `RUN id` 作为镜像构建诊断；不需要为了证明非 root 就安装一套 shell 工具进生产镜像。

~~~powershell
docker build -t container-course-api:prod .
docker image inspect container-course-api:prod --format "{{.Size}} bytes"
docker run --rm --entrypoint id container-course-api:prod
docker run --rm -p 127.0.0.1:8080:8080 container-course-api:prod
~~~

## 怎么确认做对了

镜像仍能正常响应 `/health/live`，运行用户不是 root。镜像大小会随基础镜像平台、缓存和发布时间变化；这里验收的重点是最后阶段基于 aspnet/runtime 而非 SDK，并且程序仍然正常。

## 留一个小练习

在 Dockerfile 最后加入 `USER 0` 试着构建，再立即恢复。想一想：容器被攻破时，root 会让问题扩大到什么边界？随后查一遍镜像里有没有 `.env`、源码包缓存或私钥。

## 没跑通时先查什么

构建阶段能编译，运行阶段报缺文件，常见原因是 publish 输出没复制全，或误以为 SDK 镜像中的库在 runtime 镜像里也存在。用 `docker run --entrypoint` 临时检查可以帮助诊断，但最终镜像仍应只留服务运行所需内容。

多阶段构建把 SDK 留在构建阶段、把运行时带进最终镜像，但不代表最终镜像里没有任何风险。仍要定期重建以拿到基础镜像安全更新，并检查容器当前用户和实际启动参数。标签写成小一点的 alpine 也不能代替依赖审查。

## 参考资料

- [多阶段构建](https://docs.docker.com/build/building/multi-stage/)
- [Docker 安全](https://docs.docker.com/engine/security/)
