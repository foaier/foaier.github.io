---
title: "镜像和容器不是一回事：一个像安装包，一个像正在运行的程序"
date: "2026-11-24"
summary: "分清镜像、容器和虚拟机，后面看 ps、build、commit 时就不容易串线。"
series: "Docker 与 Kubernetes"
order: 2
tags: ["Docker 基础","Docker","Kubernetes"]
level: "Docker 基础"
prerequisites: ["docker-why"]
goals: ["用自己的话解释镜像、容器和虚拟机的区别。"]
---

`docker images` 里有一行 nginx，但浏览器访问 localhost 仍然没页面。这个场景很常见：你下载了镜像，却还没启动容器。镜像只是启动程序所需文件的只读模板；容器才是从模板创建出来的一次运行实例。

## 概念讲透：它负责什么，不负责什么

镜像是只读的分层文件系统加上启动配置，容器是基于镜像创建的一次运行实例。启动容器不会把新文件写回镜像；容器自己的可写层跟着容器生命周期走，删除容器时也会删除这层。需要跨重建保留的数据要放卷或外部存储。虚拟机通常带一套独立内核，容器是隔离的宿主机进程，启动更轻，但隔离边界也不同。

## 运行过程拆解：从输入到结果

docker run 背后会先找本地镜像，没有就从仓库拉取；随后依据镜像创建容器的文件系统、网络和进程配置，再启动主进程。容器主进程退出，容器就会进入 exited；镜像仍然存在，可以创建新实例。可写层只属于这个实例，volume 是独立挂载点，所以要分别看实例状态和数据去向。

## 镜像保存文件，容器负责运行

镜像可以拿来创建很多容器，像同一份安装介质装出多台机器。容器运行时会有自己的进程、网络和可写层，但它共享宿主机内核；传统虚拟机通常还要运行自己的客体操作系统内核。容器边界有隔离效果，不等于另一台独立物理机，更不代表可以随便给进程特权。

## 下载 Nginx，再启动它

先拉镜像，看看本地镜像列表，再创建名为 web 的容器。`-d` 让它在后台跑，`--name` 给这次运行一个名字；这个命令返回后，服务仍会运行。

~~~powershell
docker pull nginx:alpine
docker image ls nginx
docker run -d --name web -p 127.0.0.1:8080:80 nginx:alpine
docker ps
~~~

## 怎么确认做对了

`docker ps` 能看到 web 是 Up 状态。浏览器打开 http://localhost:8080 可见 Nginx 欢迎页。镜像名后面的 `alpine` 是标签；容器名 web 是这一次运行的名字，两者别混成一个概念。

## 案例推演

同事在容器里手工安装了一个调试工具，重启后工具消失。先用 docker diff 看变更是否只落在容器可写层，再把安装步骤写进 Dockerfile、重新构建有版本的镜像。这样其他环境才能复现；docker commit 临时救急可以留现场，却不适合作为团队长期交付方式，因为构建来源和变更步骤都看不清。

## 留一个小练习

再创建一个名字不同的 Nginx 容器，尝试也发布到宿主机 8080。它会因端口占用启动失败，记录仍可能保留在 `docker ps -a` 中。删除这次失败的练习容器后，重新用 8081 创建；已有容器不能靠 restart 修改端口。看完执行 `docker stop web` 和 `docker rm web`，为后面练习腾出 8080。

## 没跑通时先查什么

`docker image ls` 看不到容器，正常；它只列镜像。`docker ps` 默认只显示正在运行的容器，停止的用 `docker ps -a`。镜像可删但运行中的容器会依赖它；删除容器也不会顺手删镜像。后面每个清理命令都先看目标名字，再执行。

## 看清镜像和容器各自保存什么

第一条显示镜像摘要、操作系统和 CPU 架构；接着创建一个还没启动的容器，再 inspect 查看它的初始状态。删除这个临时实例后，镜像列表仍在，能直观看到镜像与容器不是同一个对象。

~~~powershell
docker image inspect nginx:alpine --format 'ID={{.Id}} OS={{.Os}} ARCH={{.Architecture}}'
docker create --name web-inspect nginx:alpine
docker inspect web-inspect --format 'status={{.State.Status}} image={{.Config.Image}}'
docker rm web-inspect
docker image ls nginx:alpine
~~~


## 生产里怎么用、怎么排障

常见事故是把上传文件写进容器目录，滚动发布后新容器接管流量，旧文件就像“丢了”。生产文件要落到对象存储或受管理的持久卷，镜像保持可替换。确认镜像内容时看摘要而不只看 tag；核对运行了哪个容器用 docker inspect，看数据去了哪儿则检查 Mounts。清理前先确认卷的用途，镜像和业务数据不是一类东西。

## 参考资料

- [镜像与容器入门](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/)
- [容器是什么](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/)
