---
title: 镜像和容器怎么区分？自己查看、启动、停止一次
date: '2026-11-24'
summary: 用刚才的 Nginx 练习看清镜像是模板、容器是运行实例。
series: Docker 与 Kubernetes
order: 3
tags:
  - Docker
  - Docker 入门
level: Docker 入门
prerequisites:
  - docker-why
goals:
  - 能分别列出镜像和容器，并亲自启动、停止和删除一个容器。
---

上一课我们运行了 Nginx。现在来回答两个实用问题：Docker 下载的东西放在哪？停止网页后，它还在不在？答案要靠分别查看“镜像”和“容器”。

## 先分别列出来

运行下面命令：

~~~powershell
docker image ls
docker ps -a
~~~

第一条列出本机已有镜像，应能看到 `nginx`，标签通常是 `alpine`。第二条列出所有容器；如果上一课已按步骤清理，这里看不到 `first-nginx`。只运行 `docker ps` 会隐藏已停止的容器，所以刚开始排错时记得加 `-a`。

镜像可以理解成一份只读的软件模板，容器则是从模板创建出来的一次运行实例。同一个镜像可以开多个容器。删掉容器通常不会删掉镜像；删镜像也不会是“停止程序”的同义词。

## 从同一个镜像开两个实例

创建两个名字不同、主机端口不同的 Nginx 容器：

~~~powershell
docker run --name nginx-a -d -p 127.0.0.1:8081:80 nginx:alpine
docker run --name nginx-b -d -p 127.0.0.1:8082:80 nginx:alpine
docker ps
~~~

浏览器分别访问 `http://localhost:8081` 和 `http://localhost:8082`，两个页面都应出现 Nginx 欢迎页。镜像相同，容器名称和主机端口不同。如果端口被占用，把左边的 8081/8082 改成其他空闲端口。

## 停止、再启动、删除

停止 `nginx-a` 后，它不会继续提供网页，但容器记录仍保留。重新启动同一个容器，网页就恢复；删除容器记录后，就不能再用 `docker start` 启动它了。

~~~powershell
docker stop nginx-a
docker ps -a
docker start nginx-a
docker rm -f nginx-a nginx-b
docker ps -a
~~~

`rm -f` 会先停止再删除指定容器。这里只写了两个明确名字，所以不会影响电脑上其他容器。日常环境里不要不看对象就复制带 `-f` 的清理命令。

## 练习：只删一个容器

重新创建一个 Nginx 容器，停止并删除它，再执行 `docker image ls`。你应该看到：容器已经不在，但 `nginx:alpine` 镜像还在。要删除镜像可以执行 `docker image rm nginx:alpine`；如果仍有容器在用它，Docker 会拒绝删除。无需为了练习清理镜像。

记住：想知道网页进程是否运行，看容器；想知道启动模板是否已下载，看镜像。这个区分会让后面的查看、构建和排错命令更容易理解。

## 参考资料

- [Docker 镜像介绍](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/)
- [Docker 容器介绍](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/)
