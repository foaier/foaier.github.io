---
title: Docker 构建时的“上下文”是什么？别把整台电脑打包进去
date: '2026-11-24'
summary: 看懂 build 命令最后的点，写好 .dockerignore，让构建只拿到需要的文件。
series: Docker 与 Kubernetes
order: 7
tags:
  - Docker 基础
  - Docker
  - Kubernetes
level: Docker 基础
prerequisites:
  - dockerfile-first
goals:
  - 解释 build context，并通过 .dockerignore 排除构建产物和本地密钥。
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

## 从构建输出判断上下文有没有过大

--no-cache 这次让步骤完整执行，便于观察发送给构建器的 context 大小；输出中的 transferring context 若突然达到几 GB，通常是 bin、obj、.git 或本地文件被一起发送。第二条确认镜像生成。诊断结束后正常构建不必总加 --no-cache。

~~~powershell
docker build --no-cache -t container-course-api:context-check .
docker image inspect container-course-api:context-check --format '{{.Id}}'
~~~

## build 命令末尾那个点到底是什么

在 docker build -f Dockerfile -t api:dev . 中，最后的点是 build context，也就是 Engine/BuildKit 能用于构建的文件集合；-f 只选择 Dockerfile，不能改变上下文范围。Dockerfile 中 COPY 的源路径相对于上下文，不是相对于 Dockerfile 本身。

~~~text
docker build -f examples/api/Dockerfile examples/
                                  ^^^^^^^^^^
                    只有这个目录能作为 COPY 的源文件范围
~~~

如果 Dockerfile 在 examples/api/Dockerfile，而上下文给成 examples/，COPY api/src/ ... 才能命中该路径。把上下文误设成 examples/api/src 时，Dockerfile 同级文件就不在上下文里，会报找不到文件。实际构建时先核对命令最后一个参数。

## 让上下文变小，也让密钥远离镜像

课程的 .dockerignore 会排除版本控制目录、编译输出和本机生成文件。项目可按语言补充 bin/、obj/、node_modules/、测试结果和临时配置；不要把需要编译的源码目录排除掉。生产仓库通常要排除 .env、私钥和本地证书，即使 Dockerfile 没有 COPY 它们，构建上下文也可能被缓存或传给远程 builder。

~~~powershell
docker buildx build --progress=plain --load -t container-course-api:context .
docker image inspect container-course-api:context --format 'id={{.Id}} size={{.Size}}'
docker history --no-trunc container-course-api:context
~~~

BuildKit 日志会显示实际传入的上下文大小。改了 .dockerignore 后重新构建，观察上下文上传量是否下降。image history 适合看层和构建命令摘要，但它不是秘密扫描器；如果曾把密钥复制进镜像，删除当前文件也不会从旧层中抹掉，必须轮换密钥并重建。

## COPY 缺文件时按路径逐段排查

先列出构建命令指定的目录，再确认 COPY 源文件位于上下文内、没有被 ignore 规则过滤、大小写与目标平台文件系统一致。不要用 COPY ../secret 把上下文外的文件硬塞进去；BuildKit 会拒绝越界路径，这正是隔离构建输入的保护。

~~~powershell
Get-Location
Get-ChildItem
Get-Content .dockerignore
docker buildx build --progress=plain --no-cache --load -t context-debug .
~~~

--no-cache 只跳过层缓存，不会自动修复路径错误；排查后应去掉它。课程压缩包的 Dockerfile 和 .dockerignore 位于同一目录，从该目录运行命令最不容易弄错上下文。

## 参考资料

- [Build context](https://docs.docker.com/build/concepts/context/)
- [Docker 忽略文件](https://docs.docker.com/build/concepts/context/#dockerignore-files)
