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

## 概念讲透：它负责什么，不负责什么

多阶段构建把编译环境和运行环境拆开：SDK 阶段有编译器和还原工具，最终镜像只复制发布产物和运行时。镜像变小可以减少传输和攻击面，但不是自动安全。非 root 限制进程权限，只读根文件系统降低意外写入；这两项也要求明确可写目录和文件属主。

## 运行过程拆解：从输入到结果

最终镜像需要的通常是应用发布文件、Runtime、证书和必要目录，不需要 SDK、测试产物和源码仓库。COPY --from 只把指定阶段的输出带到运行阶段；USER 决定进程身份，文件属主必须与它匹配。只读根目录时，临时文件和缓存要明确放入可写挂载点。构建后检查镜像层、运行身份、应用启动和退出信号，比单看体积更有意义。

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

## 案例推演

API 上线后报“无法写日志目录”，本地却正常。新镜像改成非 root 和只读根文件系统后，应用写入了原本默认可写的根目录。检查应用写入位置，只给明确需要的缓存或临时目录挂载可写卷；业务上传文件改存对象存储。不要为了让服务启动就把整个容器恢复成 root 和全盘可写。

## 留一个小练习

在 Dockerfile 最后加入 `USER 0` 试着构建，再立即恢复。想一想：容器被攻破时，root 会让问题扩大到什么边界？随后查一遍镜像里有没有 `.env`、源码包缓存或私钥。

## 没跑通时先查什么

构建阶段能编译，运行阶段报缺文件，常见原因是 publish 输出没复制全，或误以为 SDK 镜像中的库在 runtime 镜像里也存在。用 `docker run --entrypoint` 临时检查可以帮助诊断，但最终镜像仍应只留服务运行所需内容。

多阶段构建把 SDK 留在构建阶段、把运行时带进最终镜像，但不代表最终镜像里没有任何风险。仍要定期重建以拿到基础镜像安全更新，并检查容器当前用户和实际启动参数。标签写成小一点的 alpine 也不能代替依赖审查。

## 生产里怎么用、怎么排障

上线镜像还要考虑基础镜像补丁、镜像来源、漏洞扫描、SBOM、签名和保留回滚版本。以摘要部署，更新基础镜像后重新构建并做回归；只看镜像体积小不小不够。最小化镜像会让现场排查更难，可通过日志、指标和受控的临时诊断容器解决，避免在正式镜像里常驻编译器和调试工具。

## 参考资料

- [多阶段构建](https://docs.docker.com/build/building/multi-stage/)
- [Docker 安全](https://docs.docker.com/engine/security/)
