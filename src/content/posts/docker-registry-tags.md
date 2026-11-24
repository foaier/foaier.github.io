---
title: 把镜像推到仓库：为什么 latest 不是一个可靠版本号
date: '2026-11-24'
summary: 为镜像打版本标签、登录容器仓库并推送，理解 tag 和 digest 的区别。
series: Docker 与 Kubernetes
order: 17
tags:
  - Docker 实战
  - Docker
  - Kubernetes
level: Docker 实战
prerequisites:
  - docker-compose-operations
goals:
  - 把本机镜像推到自己的 registry，并选择可追溯的标签。
---

镜像只在你的电脑上时，服务器无从拉取。容器仓库（Registry）就是存放镜像的地方。推送之前要先命名好版本，否则大家都盯着 latest，很难知道某台机器跑的到底是哪一次构建。

## 标签是名字，摘要对应具体内容

`docker tag` 为同一镜像增加一个仓库名称和标签，不会重新编译程序。`push` 上传镜像层。Tag 是可移动的名字，digest 是内容摘要；部署要求可追溯时记录不可变的提交号标签或 digest。公共仓库与私有仓库的认证和访问规则不同。

## 给镜像命名并推送到自己的仓库

下面用 Docker Hub 账号举例。先用变量填自己的用户名，标签用当前版本号。`docker login` 使用交互式凭证输入，不要把密码写进文章、脚本或截图。推送之后从仓库页面或另一台已登录的机器核对标签。

~~~powershell
$owner = Read-Host 'Docker Hub 用户名'
$image = "$($owner.ToLowerInvariant())/container-course-api:1.0.0"
docker build -t container-course-api:1.0.0 .
docker login --username $owner
docker tag container-course-api:1.0.0 $image
docker push $image
~~~

## 给镜像加唯一标签并核对远端摘要

下面的用户名会在运行时询问；先用有 package 写权限的 GitHub token 登录 GHCR，Docker 会安全地交互式询问 token。tag 只增加本地引用名，push 才上传；最后一条读取仓库平台信息和摘要。

~~~powershell
$owner = Read-Host 'GitHub 用户名'
$image = "ghcr.io/$($owner.ToLowerInvariant())/container-course-api:practice-1"
docker login ghcr.io --username $owner
docker tag container-course-api:local $image
docker push $image
docker buildx imagetools inspect $image
~~~

## 推送和拉取时每一步发生什么

镜像引用由 Registry 主机、命名空间、仓库和 tag 组成。docker tag 只为本地已有镜像增加一个名字；docker push 按仓库地址上传缺失的层和清单；docker pull 按引用下载清单和当前平台需要的层。私有仓库的认证只影响访问，不会改变镜像内容。

~~~text
本机 container-course-api:local
        | tag，不重新构建
        v
ghcr.io/组织/container-course-api:sha-提交号
        | push
        v
Registry manifest + image layers + content digest
~~~

同一个镜像的多个 tag 可能指向相同 digest；同一个可变 tag 以后也可能指向另一个 digest。因此部署清单只写 latest，会让“重新创建”时拿到与昨天不同的内容。

## 在 GHCR 做一次带提交号的发布

在项目根目录执行。先通过组织或账号授权的 GitHub 凭据登录 GHCR，再给当前课程镜像打唯一练习标签。登录时输入的 token 不要写入 shell 命令行或保存到代码库。

~~~powershell
docker build -t container-course-api:practice .
docker login ghcr.io --username YOUR_GITHUB_USERNAME
docker tag container-course-api:practice ghcr.io/YOUR_GITHUB_USERNAME/container-course-api:practice-1
docker push ghcr.io/YOUR_GITHUB_USERNAME/container-course-api:practice-1
docker buildx imagetools inspect ghcr.io/YOUR_GITHUB_USERNAME/container-course-api:practice-1
~~~

使用 GHCR 前确认包的创建者、可见性和访问权限。组织名和镜像名需改成自己的小写地址；私有包不能匿名拉取。发布成功后保存仓库页面给出的 digest，另一台有拉取权限的机器执行 pull 并核对同一 digest。

## 版本标签、digest 和多架构清单

| 引用 | 方便之处 | 风险或限制 |
|---|---|---|
| latest | 人手测试容易输入 | 内容会变化，不能表达确切版本 |
| 语义版本如 1.2.0 | 便于阅读发布批次 | 若允许覆盖，仍可能漂移 |
| commit SHA 标签 | 可追溯到源码提交 | 仍要确认仓库没有允许覆盖同名标签 |
| digest | 固定到具体内容 | 可读性差，更新时必须修改引用 |

多架构镜像可能有一个 manifest list，分别指向 amd64、arm64 等平台镜像。一个 tag 可能对应不同架构的内容，但平台选择由 manifest 和拉取主机共同决定。若在 ARM 笔记本和 x86 服务器表现不同，先检查镜像 manifest、架构和构建产物，而不是假设 tag 单独说明了每个字节。

## CI 推送凭据和运行时拉取凭据分开

CI 需要写仓库包，部署集群通常只需要读私有镜像。给它们不同的身份和权限；不要把开发者的个人长期 token 复制到所有节点。镜像拉取失败时，区分名称错误、包不可见、凭据过期和架构不匹配，再查看 Pod 事件或 Registry 错误码。

## 参考资料

- [镜像标签](https://docs.docker.com/docker-hub/repos/manage/hub-images/tags/)
- [Docker Hub 登录](https://docs.docker.com/reference/cli/docker/login/)
