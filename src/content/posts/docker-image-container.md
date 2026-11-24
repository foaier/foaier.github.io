---
title: 镜像命令：下载、查看、打标签、删除，分别在做什么
date: '2026-11-24'
summary: 读懂 image ls 的每一列，亲手比较标签与镜像 ID。
series: Docker 与 Kubernetes
order: 3
tags:
  - Docker
  - Docker 入门
level: Docker 入门
prerequisites:
  - docker-install
goals:
  - 完成一次 pull、inspect、tag、rm，知道删除的是什么。
---
镜像命令解决的是“软件模板放在哪里、是什么版本、占多少空间”。这一课把下载、查看、打标签和删除分别做一次。容器的启动停止放在下一课，先不要混着记。

准备：Docker 已通过安装自检。打开 Bash，任意目录都能执行本课命令。使用 `nginx:stable-alpine`，它是 Nginx 的 Alpine 版本；同一个标签以后可能更新，所以生产发布还要记下摘要。

## 下载之前怎么选镜像

~~~bash
docker search nginx --limit 5
docker pull nginx:stable-alpine
~~~

`search` 查 Docker Hub 的镜像名称和简介；`pull` 下载明确指定的镜像。优先到镜像页面查看维护者、支持架构和使用说明，不能只看名字或点赞数量。

首次 pull 会显示若干层的下载进度，已有层会复用。`Downloaded newer image` 表示下载了镜像，`Image is up to date` 表示本机已匹配仓库当前内容。这两种结果都不是容器正在运行的证明。

## 读懂 image ls 的每一列

~~~bash
docker image ls nginx
docker image inspect nginx:stable-alpine --format 'id={{.Id}} os={{.Os}} arch={{.Architecture}}'
~~~

| 输出列 | 意思 | 别误会成什么 |
|---|---|---|
| REPOSITORY | 镜像仓库名称 | 不是容器名 |
| TAG | 标签 | 不是不可改变的版本承诺 |
| IMAGE ID | 本机镜像标识 | 不是容器 ID |
| CREATED | 镜像构建时间 | 不一定是下载时间 |
| SIZE | 镜像显示大小 | 多镜像共用层时不能简单相加算磁盘占用 |

需要查看磁盘实际分布，运行 `docker system df`，它会分别列镜像、容器、卷和构建缓存。

## 给同一个镜像起两个名字

~~~bash
docker tag nginx:stable-alpine foaier-nginx:practice
docker image ls nginx
docker image ls foaier-nginx
~~~

两项的 IMAGE ID 应一致。`tag` 增加名字，不会复制一份 Nginx 文件，也不会启动容器。实际推送时完整名字可能是 `仓库地址/命名空间/镜像名:标签`，仓库章节会动手练。

~~~bash
docker image inspect nginx:stable-alpine --format '{{json .RepoDigests}}'
docker system df
~~~

RepoDigests 里可能看到 `nginx@sha256:...`。摘要对应特定镜像内容，标签则可能移动。本机自己构建且尚未推送的镜像可能没有仓库摘要，这很正常。

## 删除标签和删除正在使用的镜像

先移除刚加的练习标签：

~~~bash
docker image rm foaier-nginx:practice
docker image ls nginx
~~~

Nginx 的原标签仍在。若一个镜像有多个标签，移除一个名字不等于马上释放整份镜像占用。若仍有容器引用镜像，Docker 也可能拒绝删除；先用 `docker ps -a` 查引用，不要遇到提示就加 `-f`。

`docker rmi` 是常用简写，与 `docker image rm` 用途一致。`docker image prune` 默认清理悬空镜像，`-a` 范围更大；现在不执行全局清理，避免误删其他实验需要的镜像。

## 下载失败时读最后一句具体原因

`pull access denied` 可能是名称写错、私有仓库未登录或权限不足；`manifest unknown` 常是标签不存在；`429` 常与仓库请求限制有关。网络超时和鉴权失败是两类问题，换密码不能解决下载超时。

做个小检查：执行 `docker run --help`，找 IMAGE 的位置；再执行 `docker image ls`。你应该能说清：`nginx:stable-alpine` 是一个镜像引用，`web` 这样的名字通常由创建容器时的 `--name` 指定。下一课就用这个镜像创建两个独立实例。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/reference/cli/docker/image/)
- [进一步了解相关机制](https://docs.docker.com/reference/cli/docker/image/pull/)
