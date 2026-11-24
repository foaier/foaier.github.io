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

## 留一个小练习

再创建一个名字不同的 Nginx 容器，尝试也发布到宿主机 8080。它会因端口占用启动失败，记录仍可能保留在 `docker ps -a` 中。删除这次失败的练习容器后，重新用 8081 创建；已有容器不能靠 restart 修改端口。看完执行 `docker stop web` 和 `docker rm web`，为后面练习腾出 8080。

## 没跑通时先查什么

`docker image ls` 看不到容器，正常；它只列镜像。`docker ps` 默认只显示正在运行的容器，停止的用 `docker ps -a`。镜像可删但运行中的容器会依赖它；删除容器也不会顺手删镜像。后面每个清理命令都先看目标名字，再执行。

## 参考资料

- [镜像与容器入门](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/)
- [容器是什么](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/)
