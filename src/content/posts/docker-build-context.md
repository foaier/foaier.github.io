---
title: "Docker 构建时的“上下文”是什么？别把整台电脑打包进去"
date: "2026-11-24"
summary: "看懂 build 命令最后的点，写好 .dockerignore，让构建只拿到需要的文件。"
series: "Docker 与 Kubernetes"
order: 7
tags: ["Docker 基础","Docker","Kubernetes"]
level: "Docker 基础"
prerequisites: ["dockerfile-first"]
goals: ["解释 build context，并通过 .dockerignore 排除构建产物和本地密钥。"]
---

Dockerfile 里写 `COPY . .`，第一个点是来源：构建上下文根目录下未被忽略的文件；第二个点是目标：镜像当前 WORKDIR。你站在哪个目录运行命令、`docker build` 最后给了哪个路径，决定 Docker 在构建时看得到什么。

## 构建能看到的文件有边界

把 context 想成你交给打包员的一箱材料。Dockerfile 不能随意偷看箱子外面的文件；这既是构建边界，也影响上传到远端 builder 的体积。`.dockerignore` 在发送之前把 bin、obj、Git 历史和 `.env` 等排掉。排除规则写错时，所需源文件也可能不进箱子。

## 用 .dockerignore 缩小上下文

课程示例根目录有 `.dockerignore`。先看看构建日志中的传输上下文大小，再临时把 `**/bin/` 一行注释掉构建一次，与原结果比较。不要真的把密钥文件加进 context；用一个空的练习文件演示排除规则即可。

~~~powershell
docker build --progress=plain -t container-course-api:context .
Get-Content .dockerignore
~~~

## 怎么确认做对了

Docker 的 transfer context 步骤会显示发送大小；忽略编译目录后，通常能看到更小的数字。大小不是越小越好，关键是排除不参与构建的文件，同时确保 csproj、源码和配置仍能被 COPY。

## 留一个小练习

在项目里创建一个不含真实密码的 `local-note.txt`，把它加入 `.dockerignore`，再改 Dockerfile 临时 COPY 它，观察为什么找不到。恢复 Dockerfile，并删除这个无用测试文件。这个反例能把“文件不在 context 里”变得很具体。

## 没跑通时先查什么

COPY 找不到路径，核对相对的是 context 根目录，不是 Dockerfile 当前所在子目录。`.dockerignore` 支持模式规则，排查时先用更精确的排除项，别无脑写 `*`。真实 `.env` 既要忽略，也要确认仓库历史和镜像层里没有旧密钥。

构建上下文也可能上传到远端 BuildKit。排除 `.git` 不只是提速，仓库历史里可能留着已删除的旧凭证；排除 `bin`、`obj` 则能避免把当前电脑编译产物误当成镜像输入。最好从干净检出目录验证一次构建可重复性。

## 参考资料

- [Build context](https://docs.docker.com/build/concepts/context/)
- [Docker 忽略文件](https://docs.docker.com/build/concepts/context/#dockerignore-files)
