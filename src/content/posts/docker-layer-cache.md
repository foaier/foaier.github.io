---
title: "为什么改一行代码，Docker 有时要重装全部依赖？"
date: "2026-11-24"
summary: "理解 Dockerfile 的层与缓存，调整复制顺序减少重复还原。"
series: "Docker 与 Kubernetes"
order: 8
tags: ["Docker 基础","Docker","Kubernetes"]
level: "Docker 基础"
prerequisites: ["docker-build-context"]
goals: ["解释构建缓存何时失效，并把项目依赖文件放在源码复制之前。"]
---

Dockerfile 改完跑一次要三分钟，改一个注释又花三分钟，这种等待很快就让人不想做实验。Docker 的构建缓存可以复用未变化的步骤，但后面某一步的输入发生变化，通常从那一步往后的结果都得重做。

## 概念讲透：它负责什么，不负责什么

构建器会根据指令和输入内容判断某一步能否复用缓存。依赖文件变化少，源代码变化频繁；先复制项目文件并 restore，再复制源码并 publish，改业务代码时就可以跳过依赖还原。缓存不是运行时数据，也不是构建正确性的保证：缓存命中说明输入看起来没变，不说明依赖没有安全更新。

## 运行过程拆解：从输入到结果

缓存判断会从前往后进行：一旦某一步输入变化，该步骤及后续依赖它的步骤就需要重做。把项目文件单独复制后 restore，源码变化不会改变 restore 的输入；把源码复制放在 restore 前面，则每次改代码都让依赖层失效。依赖文件、构建参数和基础镜像也会影响缓存，所以观察构建输出中的 CACHED 比只看总耗时可靠。

## 把变化少的依赖放在前面

在 .NET 项目里，依赖声明集中在 csproj。若先 COPY 全部源码再 restore，改一个 `.cs` 文件也会让 restore 步骤的输入变化。把项目文件先复制并还原，再复制频繁变化的源码，依赖缓存就更容易保住。缓存是构建优化，不是正确性的保证；需要干净重建时可以主动关闭。

## 比较三次构建的缓存记录

课程 Dockerfile 先复制 csproj 并 `dotnet restore`，后复制源码再 publish。连续构建两次记录耗时；改一行 Program.cs 再 build，观察 restore 是否显示 Cached。最后用 `--no-cache` 做一次对照，确认缓存确实减少了重复工作。

~~~powershell
docker build --progress=plain -t container-course-api:cache .
docker build --progress=plain -t container-course-api:cache .
docker build --no-cache -t container-course-api:clean .
~~~

## 怎么确认做对了

第二次普通构建应复用若干步骤；第三次从头执行。时间差受网络和机器影响，所以主要看步骤是否命中缓存，不要追求某个固定秒数。若更改 csproj，restore 重新跑反而是对的。

## 案例推演

一个注释变更让 CI 每次重新下载所有 NuGet 包。查看 Dockerfile 发现 COPY . . 在 restore 之前，源码一变就使后续层失效。把项目文件和锁定文件先复制、恢复依赖，再复制源码发布；分别测试只改源码和改项目引用时的构建日志，确认前者复用 restore、后者正确重新还原。

## 留一个小练习

把 Dockerfile 里的 `COPY` 和 `restore` 顺序反过来，改一行源码再构建，比较哪些步骤重新执行，然后恢复原顺序。观察要基于 plain build 日志，而不是只看终端最后说 Successfully built。

## 没跑通时先查什么

缓存没命中可能是 Dockerfile 指令顺序、COPY 文件、构建参数或基础镜像变化。缓存命中了也不要假设外部漏洞扫描结果一直有效；依赖升级仍要显式更新。某些包源需要凭证时用 BuildKit secret mount，不要把 token 写进 ARG 或 COPY 进任何层。

## 生产里怎么用、怎么排障

生产流水线缓存要按项目和信任边界隔离，不能让不可信 PR 写入会被发布任务直接使用的缓存。缓存可丢、可重建，不能把它当唯一的依赖包或制品来源。依赖更新策略应有锁定版本与漏洞扫描，定期触发干净构建验证构建不依赖开发机残留；若缓存让结果不可解释，先用 no-cache 复现再定位输入。

## 参考资料

- [构建缓存](https://docs.docker.com/build/cache/)
- [缓存优化建议](https://docs.docker.com/build/cache/optimize/)
