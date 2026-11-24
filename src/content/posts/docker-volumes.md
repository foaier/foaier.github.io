---
title: 数据卷与目录挂载：删容器、读文件、只读共享都试一次
date: '2026-11-24'
summary: 用文本文件亲自验证数据是否保留，再区分 Volume 和 bind mount。
series: Docker 与 Kubernetes
order: 8
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - docker-registry-tags
goals:
  - 验证容器与数据卷的独立生命周期，并定位挂载错误。
---
容器可以随时重建，数据不一定可以。这一课先写一个文本文件再删容器，看它是否还在；之后再学习目录挂载、只读挂载和共享卷。数据库章节会用同样的方法保存 MySQL 与 Redis 数据。

准备：Bash、Docker。下面只操作名为 `volume-note` 的实验卷，不需要进入项目目录。

## 写一个文件，换个容器再读

~~~bash
docker volume create volume-note
docker run --rm --mount source=volume-note,target=/data \
  alpine:3.22 sh -c 'echo saved-in-volume > /data/note.txt'
docker run --rm --mount source=volume-note,target=/data \
  alpine:3.22 cat /data/note.txt
~~~

第二个容器应输出 `saved-in-volume`。第一个容器已因 `--rm` 删除，文件还在，因为 `/data` 映射到独立的命名卷。对比在没有挂载的 `/tmp` 里写文件：容器删了，那个可写层中的文件就随之消失。

`source` 是卷名，`target` 是容器里的路径。挂载之后，应用读写 target，就在读写那份卷。Desktop 的卷一般在其 Linux 环境里，不要在 Windows 上寻找一个同名 C 盘目录。

## Volume 与 bind mount 怎么选

| 方式 | 谁选数据位置 | 适合什么 |
|---|---|---|
| 命名卷 Volume | Docker 管理 | 数据库文件，明确命名、复用和备份 |
| 目录挂载 bind mount | 你指定宿主目录 | 网页源码、配置文件、本地开发 |
| tmpfs | 内存临时空间 | 不需要持久保存的临时数据，主要用于 Linux |

打开本机实验目录，创建一份网页：

~~~bash
mkdir -p ~/docker-practice/mount/site
cd ~/docker-practice/mount
printf '<h1>hello from my folder</h1>\n' > site/index.html
docker run --name mount-web -d -p 127.0.0.1:8084:80 \
  --mount type=bind,source="$PWD/site",target=/usr/share/nginx/html,readonly \
  nginx:stable-alpine
curl http://localhost:8084
~~~

页面应包含 hello。把 site/index.html 改成另一句话，再刷新浏览器，会直接变化。`$PWD` 是本机 Bash 当前目录，绝对路径避免了“在另一个目录执行就挂错文件”的问题。

## readonly 限制哪一边

~~~bash
docker exec mount-web sh -c 'echo denied > /usr/share/nginx/html/test.txt'
printf '<h1>changed on host</h1>\n' > site/index.html
curl http://localhost:8084
~~~

容器写入应报只读文件系统；宿主机仍能改文件，网页也能读取最新内容。只读挂载限制的是容器这一边，不是把你电脑目录永久设成只读。

长写法 `--mount ... readonly` 与 `-v 本机目录:容器目录:ro` 都能表达这个需求。`--mount type=bind` 的源目录不存在时会明确报错；某些 `-v` 写法会自动创建目录，文件名写错因此容易被误建成文件夹。

## 多个容器可以读同一个卷

~~~bash
docker run --rm --mount source=volume-note,target=/shared,readonly \
  alpine:3.22 cat /shared/note.txt
docker volume inspect volume-note
~~~

挂载路径不必一样：之前是 `/data`，现在是 `/shared`，指向的仍是同一个卷。老教程中的 `--volumes-from 容器名` 会复用另一容器的挂载定义，不是复制或备份数据；明确写卷名更容易看懂关系。

不要让两个 MySQL 主进程同时对同一个数据目录读写。共享目录只解决“看见同一文件”，不会替数据库协调并发。

## 权限错误和“挂载后文件没了”

先用 `docker inspect mount-web --format '{{json .Mounts}}'` 确认 source 与 destination。挂一个空目录到镜像原有目录上，会遮住原来的文件，这是挂载的正常效果。

Linux 的 bind mount 要看 UID/GID 与目录权限；启用 SELinux 的系统还要看标签，可按系统说明使用 `:Z` 或 `:z`。普通挂载不需要 `--privileged`，不要为了解决一个目录权限问题给整个容器主机级权限。

清理网页容器后，宿主机 site 目录仍在。命名卷需要你明确决定是否删除：

~~~bash
docker rm -f mount-web
docker volume inspect volume-note
# 确认 note.txt 只是这次实验数据后再执行
docker volume rm volume-note
~~~

## 继续阅读

- [命令与配置说明](https://docs.docker.com/engine/storage/volumes/)
- [进一步了解相关机制](https://docs.docker.com/engine/storage/bind-mounts/)
