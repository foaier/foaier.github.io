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

## 标签是名字，摘要对应具体内容

`docker tag` 为同一镜像增加一个仓库名称和标签，不会重新编译程序。`push` 上传镜像层。Tag 是可移动的名字，digest 是内容摘要；部署要求可追溯时记录不可变的提交号标签或 digest。公共仓库与私有仓库的认证和访问规则不同。

## 给镜像命名并推送到自己的仓库

下面用 Docker Hub 账号举例。先把 `YOUR_DOCKERHUB_NAME` 换成自己的用户名，标签用当前版本号。`docker login` 使用交互式凭证输入，不要把密码写进文章、脚本或截图。推送之后从仓库页面或另一台已登录的机器核对标签。

~~~powershell
docker build -t container-course-api:1.0.0 .
docker tag container-course-api:1.0.0 YOUR_DOCKERHUB_NAME/container-course-api:1.0.0
docker login
docker push YOUR_DOCKERHUB_NAME/container-course-api:1.0.0
~~~

## 怎么确认做对了

仓库中应出现 `1.0.0` 标签，推送日志显示镜像层已上传或复用。另一台机器能够 pull 该标签，才算完成分发。由于公共仓库可被其他人拉取，不要把敏感配置烘焙进镜像。

## 留一个小练习

再打一个以短 Git commit 为名的标签并推送。对比两个 tag 是否对应同一 digest。然后想一想：如果之后把 1.0.0 标签指向新镜像，运维人员如何确认旧机器当时拉到的内容？

## 没跑通时先查什么

denied 通常是用户名、仓库权限或命名空间不对；推到错账号时检查完整镜像名称。先用 `docker image inspect` 和仓库页面核对。若仓库是私有的，Kubernetes 节点也需要拉取凭证；`docker login` 的本地状态不会自动复制到集群。

## 参考资料

- [镜像标签](https://docs.docker.com/docker-hub/repos/manage/hub-images/tags/)
- [Docker Hub 登录](https://docs.docker.com/reference/cli/docker/login/)
