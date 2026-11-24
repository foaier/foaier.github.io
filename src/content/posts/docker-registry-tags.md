---
title: "把镜像推到仓库：为什么 latest 不是一个可靠版本号"
date: "2026-11-24"
summary: "为镜像打版本标签、登录容器仓库并推送，理解 tag 和 digest 的区别。"
series: "Docker 与 Kubernetes"
order: 17
tags: ["Docker 实战","Docker","Kubernetes"]
level: "Docker 实战"
prerequisites: ["docker-compose-operations"]
goals: ["把本机镜像推到自己的 registry，并选择可追溯的标签。"]
---

镜像只在你的电脑上时，服务器无从拉取。容器仓库（Registry）就是存放镜像的地方。推送之前要先命名好版本，否则大家都盯着 latest，很难知道某台机器跑的到底是哪一次构建。

## 概念讲透：它负责什么，不负责什么

仓库负责保存和分发镜像，tag 是方便人使用的可变名称，digest 是镜像内容对应的不可变摘要。同一个 tag 之后可能被推送到另一个内容，所以“部署了 v1”若只是标签，未必能追溯到当时的文件。发布标签应含版本或提交号；部署记录最好同时存摘要和构建来源。

## 运行过程拆解：从输入到结果

推镜像的完整链路是本地构建、按仓库路径打 tag、登录、push，随后在目标机器 pull 并运行。tag 只是引用名，可以被重新指向；digest 对应内容摘要，适合记录实际交付的字节内容。排查“服务器版本和测试不一样”时比较 digest、构建提交和架构，比只对照 latest 标签更能确认两边拿到的是同一制品。

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

## 怎么确认做对了

仓库中应出现 `1.0.0` 标签，推送日志显示镜像层已上传或复用。另一台机器能够 pull 该标签，才算完成分发。由于公共仓库可被其他人拉取，不要把敏感配置烘焙进镜像。

## 案例推演

同一个生产 tag 上午和下午拉到两台机器上，行为却不同。检查仓库发现 tag 被重复覆盖。将发布改为每次生成唯一提交号标签，部署时记录 digest，并在回滚时明确指向之前摘要；latest 可用于方便开发者试用，但不应当作可审计的生产版本号。

## 留一个小练习

再打一个以短 Git commit 为名的标签并推送。对比两个 tag 是否对应同一 digest。然后想一想：如果之后把 1.0.0 标签指向新镜像，运维人员如何确认旧机器当时拉到的内容？

## 没跑通时先查什么

denied 通常是用户名、仓库权限或命名空间不对；推到错账号时检查完整镜像名称。先用 `docker image inspect` 和仓库页面核对。若仓库是私有的，Kubernetes 节点也需要拉取凭证；`docker login` 的本地状态不会自动复制到集群。

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


## 生产里怎么用、怎么排障

镜像仓库还涉及私有包权限、生命周期清理、漏洞扫描、复制到部署区域和可用性。凭证使用只读拉取权限，CI 的推送 token 与集群拉取凭证分开管理。清理旧 tag 前确认回滚窗口，标签删除并不总代表内容立刻释放；需要供应链保证时再增加签名和来源证明验证。

## 参考资料

- [镜像标签](https://docs.docker.com/docker-hub/repos/manage/hub-images/tags/)
- [Docker Hub 登录](https://docs.docker.com/reference/cli/docker/login/)
