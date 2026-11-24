---
title: 给生产环境的镜像瘦身：编译和运行别挤在一个大镜像里
date: '2026-11-24'
summary: 用多阶段构建只带发布产物，了解运行时基础镜像、非 root 用户和镜像大小。
series: Docker 与 Kubernetes
order: 9
tags:
  - Docker 实战
  - Docker
  - Kubernetes
level: Docker 实战
prerequisites:
  - docker-layer-cache
goals:
  - 说明 SDK 镜像和 ASP.NET Runtime 镜像分别干什么，并验证应用以非 root 身份运行。
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

## 检查最终镜像的运行用户和体积

覆盖 ENTRYPOINT 临时执行 id，可看到镜像默认用户是否为非 root；inspect 中体积单位是字节。最终阶段应使用 ASP.NET Runtime 镜像，而不是 SDK 编译镜像。若应用报临时目录权限错误，先找出具体写入路径，再只开放该路径，不要直接退回 root。

~~~powershell
docker build -t container-course-api:prod-check .
docker run --rm --entrypoint id container-course-api:prod-check
docker image inspect container-course-api:prod-check --format 'size={{.Size}} user={{.Config.User}}'
~~~

## 生产镜像至少要检查这五件事

1. **可追溯**：基础镜像与依赖有版本，构建结果能对应提交。
2. **小而够用**：使用多阶段构建，运行阶段不携带 SDK、编译器和源码仓库。
3. **权限收紧**：能用非 root 身份运行就不要用 root；不要随手加 privileged。
4. **退出正确**：主进程能接收 SIGTERM 并完成清理，避免 shell 包装层吃掉信号。
5. **可更新**：基础镜像、操作系统包和应用依赖有明确更新周期，不把“最小镜像”误当作免维护。

镜像变小有利于传输，但 distroless 或极简镜像可能没有 shell 和常见排错工具。生产环境要准备外部观测、临时调试方案和可复现的重建流程，不能指望上线后进入容器手工装工具。

## 逐层检查课程镜像

在课程目录构建镜像，再查看基础层、最终入口、用户和架构。docker history 中若看到 SDK 只出现在中间 build 阶段是正常的；最终镜像应来自 aspnet runtime 阶段。

~~~powershell
docker build --pull --progress=plain -t container-course-api:prod-check .
docker image inspect container-course-api:prod-check --format 'user={{.Config.User}} entrypoint={{json .Config.Entrypoint}} cmd={{json .Config.Cmd}} arch={{.Architecture}}'
docker image history container-course-api:prod-check
docker run --rm -p 127.0.0.1:8090:8080 container-course-api:prod-check
~~~

另开终端请求 http://localhost:8090/health/live，然后结束容器。用户字段应为运行时镜像定义的非 root UID；这只说明镜像默认身份正确，不代表应用不需要的 Linux capabilities 已全部移除，也不代表文件系统已经只读。

## 常见的生产加固项和代价

非 root 用户会要求挂载目录有正确的 UID/GID；只读根文件系统能减少意外写入，但应用需要临时目录时要显式挂载 tmpfs 或可写卷。运行时不要用 --privileged 绕过权限问题；先确定程序需要访问的文件、端口和 capability。

基础镜像 tag 可能被更新，digest 可以固定内容但也会阻止自动获得安全更新。生产策略通常是定期重建、扫描、测试并发布新 digest，而不是永久 pin 在一个没人更新的旧版本。镜像扫描发现漏洞也需结合实际可利用性和升级路径处理，不能只追求扫描报告为零。

## 参考资料

- [多阶段构建](https://docs.docker.com/build/building/multi-stage/)
- [Docker 安全](https://docs.docker.com/engine/security/)
