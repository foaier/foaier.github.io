---
title: 为什么改一行代码，Docker 有时要重装全部依赖？
date: '2026-11-24'
summary: 理解 Dockerfile 的层与缓存，调整复制顺序减少重复还原。
series: Docker 与 Kubernetes
order: 8
tags:
  - Docker 基础
  - Docker
  - Kubernetes
level: Docker 基础
prerequisites:
  - docker-build-context
goals:
  - 解释构建缓存何时失效，并把项目依赖文件放在源码复制之前。
---

Dockerfile 改完跑一次要三分钟，改一个注释又花三分钟，这种等待很快就让人不想做实验。Docker 的构建缓存可以复用未变化的步骤，但后面某一步的输入发生变化，通常从那一步往后的结果都得重做。

## 把变化少的依赖放在前面

在 .NET 项目里，依赖声明集中在 csproj。若先 COPY 全部源码再 restore，改一个 `.cs` 文件也会让 restore 步骤的输入变化。把项目文件先复制并还原，再复制频繁变化的源码，依赖缓存就更容易保住。缓存是构建优化，不是正确性的保证；需要干净重建时可以主动关闭。

## 比较三次构建的缓存记录

课程 Dockerfile 先复制 csproj 并 `dotnet restore`，后复制源码再 publish。连续构建两次记录耗时；改一行 Program.cs 再 build，观察 restore 是否显示 Cached。最后用 `--no-cache` 做一次对照，确认缓存确实减少了重复工作。

~~~powershell
docker build --progress=plain -t container-course-api:cache .
docker build --progress=plain -t container-course-api:cache .
docker build --no-cache -t container-course-api:clean .
~~~

## 在构建日志里验证缓存命中

连续两次构建时，第二次未变化的步骤应显示 CACHED。再改一处源码重建：依赖文件未变时 restore 应命中，源码之后的 publish 会重跑。若 restore 每次都重跑，检查 Dockerfile 是否在 restore 前执行了 COPY . .。最后一条只删本课的临时镜像。

~~~powershell
docker build -t container-course-api:cache-check .
docker image inspect container-course-api:cache-check --format '{{.Id}}'
docker image rm container-course-api:cache-check
~~~

## 缓存命中的依据是输入，不是“上次构建成功”

BuildKit 会根据某条指令、其依赖文件和前序层的输入判断能否复用结果。COPY 的文件内容变化会让该层及后续层重建；较早的依赖安装层一旦失效，后面的层也通常不能沿用。缓存解决重复计算，不是发布缓存，不应改变正确性。

~~~text
COPY *.csproj -> RUN dotnet restore -> COPY 源码 -> RUN dotnet publish
     依赖定义稳定时，源码修改通常只让后两步重跑
     若一开始 COPY . .，源码每次变化都可能让 restore 重跑
~~~

课程 Dockerfile 先复制 csproj 再 restore，就是为了把变化较少的依赖输入与频繁修改的源码分开。依赖定义更新时重新 restore 是正确行为；不要为了追求全命中而复用过期依赖结果。

## 用构建日志验证缓存，而不是凭感觉

第一次构建后再次执行相同构建，观察步骤旁是否标记 CACHED。再只改 Program.cs 中的业务代码并构建，restore 层仍应命中缓存。最后修改项目依赖文件再构建，restore 层应该重跑。

~~~powershell
docker buildx build --progress=plain --load -t cache-lab:local .
docker buildx build --progress=plain --load -t cache-lab:local .
~~~

这两个命令要在 container-course 目录执行。不要同时改 Dockerfile、项目文件和源码，否则无法判断哪项输入让缓存失效。实验结束可保留镜像；它不会改数据库卷。

## BuildKit 缓存挂载与普通镜像层不同

对包管理器缓存，可以使用 BuildKit cache mount，把下载缓存留给构建器复用，但不把缓存目录放进最终镜像层。以 .NET 为例，可将 restore 改为：

~~~~dockerfile
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet restore src/ContainerCourse.Api/ContainerCourse.Api.csproj
~~~~

这是理解缓存挂载的示例；当前课程 Dockerfile 尚未采用它，改之前要保证构建阶段以 root 身份运行且路径与 SDK 镜像一致。多架构 builder、CI 临时 runner 和开发机的缓存彼此不一定共享，首次构建仍需要联网获取包。

需要完全验证干净构建时用 --no-cache；需要拉取基础镜像的更新版本时加 --pull。前者不清理已有镜像，后者也不等于把 Dockerfile 中的浮动标签固定住。生产构建仍要锁定依赖并记录镜像 digest。

## 参考资料

- [构建缓存](https://docs.docker.com/build/cache/)
- [缓存优化建议](https://docs.docker.com/build/cache/optimize/)
