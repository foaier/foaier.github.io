---
title: 第一次跑网页：先用 Docker 启动一个 Nginx 容器
date: '2026-11-24'
summary: 复制一条命令，让浏览器打开容器里的网页，再亲手停掉它。
series: Docker 与 Kubernetes
order: 2
tags:
  - Docker
  - Docker 入门
level: Docker 入门
prerequisites:
  - docker-install
goals:
  - 运行一个网页容器并访问它；用这个实验理解 Docker 解决的实际问题。
---

Docker 的概念先放一边，我们先让一个网页跑起来。下面的命令会下载 Nginx（一种常见的网页服务器），在后台启动它，并把电脑的 8080 端口接到容器的 80 端口。

## 启动网页

确认上一课的 `docker run --rm hello-world` 已成功。在 PowerShell、macOS Terminal 或 Linux 终端执行：

~~~powershell
docker run --name first-nginx -d -p 127.0.0.1:8080:80 nginx:alpine
~~~

第一次会先下载镜像；看到一串容器 ID 后表示容器已创建。命令各部分的意思：`--name` 给容器起个好找的名字，`-d` 让它在后台运行，`-p` 把本机地址接到容器端口，最后的 `nginx:alpine` 是要运行的软件镜像。

## 打开网页确认

在浏览器打开 `http://localhost:8080`。正常会看到 **Welcome to nginx!**。也可以在 PowerShell 检查网页是否返回成功状态：

~~~powershell
(Invoke-WebRequest http://localhost:8080).StatusCode
docker ps
~~~

第一条应显示 `200`；第二条应列出 `first-nginx`，状态为 Up。现在这个网页不是安装在 Windows/macOS 里的传统程序，而是在一个独立容器里运行。

## 容器没起来时看这两处

如果 `docker run` 报 `port is already allocated`，说明本机 8080 已被别的程序占用。先清理刚才失败的容器，再把命令中的本机端口 8080 改成 8081：

~~~powershell
docker rm -f first-nginx
docker run --name first-nginx -d -p 127.0.0.1:8081:80 nginx:alpine
~~~

然后打开 `http://localhost:8081`。如果浏览器连接失败，先看 `docker ps` 的状态，再看 `docker logs first-nginx`；不要先改一堆配置。

## 停止实验并恢复电脑

做完后停止并删除这个练习容器：

~~~powershell
docker stop first-nginx
docker rm first-nginx
docker ps -a
~~~

最后一条不应再列出 `first-nginx`。删除容器不会卸载 Docker；下载的 Nginx 镜像仍保存在电脑上，下次运行不必重新下载。下一课我们会把“镜像”和“容器”分开观察。

## 这次练习解决了什么

Docker 把程序及其运行环境一起装进镜像，再用容器启动它。这样开发者可以把同一个镜像交给另一台装有 Docker 的电脑运行，减少“我这里能跑、你那里不行”。它不会自动修复程序，也不会自动备份数据；这些问题后面的课会分别处理。

## 参考资料

- [Docker 运行容器](https://docs.docker.com/get-started/docker-concepts/running-containers/)
- [Nginx 官方镜像](https://hub.docker.com/_/nginx)
