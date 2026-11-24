---
title: "Docker 到底解决什么问题？先从“我电脑上能跑”说起"
date: "2026-11-24"
summary: "亲手运行一个容器，再看 Docker 如何减少交付时的环境差异。"
series: "Docker 与 Kubernetes"
order: 1
tags: ["Docker 基础","Docker","Kubernetes"]
level: "Docker 基础"
prerequisites: []
goals: ["运行并检查一个容器，用自己的话说清镜像、容器和 Docker 的作用边界。"]
---

这课先不背术语。我们运行一个小程序，看看 Docker 到底替我们做了什么。准备好 Docker Desktop（Windows/macOS）或 Docker Engine（Linux），并打开终端。第一次运行需要联网下载镜像。

## 先确认 Docker 引擎能用

在 PowerShell、macOS 终端或 Linux shell 里运行：

~~~powershell
docker version
~~~

输出分成 `Client` 和 `Server` 两部分。Client 是你输入命令的程序，Server 是后台 Docker Engine。两部分都出现版本号才说明命令行已经连上引擎。如果只看到 Client，先启动 Docker Desktop；Linux 上检查 Docker 服务是否运行。这里还没有启动任何容器。

## 让 Docker 下载并运行一个程序

运行官方的测试镜像：

~~~powershell
docker run --rm hello-world
~~~

第一次执行时，大致会看到 `Unable to find image locally`，接着出现下载进度，最后打印 `Hello from Docker!`。第二次通常直接使用本机已有镜像，所以不会重新下载。

把命令拆开看：`docker run` 表示“准备好镜像并创建、启动容器”；`hello-world` 是镜像名；`--rm` 表示容器退出后自动删除这次运行实例。这个小程序只打印文字就退出，因此命令结束后看不到运行中的容器是正常的。

再分别检查容器和镜像：

~~~powershell
docker ps -a
docker image ls hello-world
~~~

`docker ps -a` 会看到状态为 `Exited` 的容器；不加 `-a` 只显示仍在运行的容器。`docker image ls` 会列出刚下载的镜像。注意：`--rm` 删除的是容器，不会顺带删除镜像。若上一条命令仍在运行，说明输出或网络可能卡住；按 Ctrl+C 后看下面的排查步骤。

## 镜像、容器和虚拟机分别是什么

可以先把镜像理解成程序运行所需文件和启动设置的只读模板，把容器理解成用这个模板启动的一次实例。同一个镜像可以启动多个容器；删除一个容器不会改掉镜像。容器里临时写入的文件通常属于这个容器，删掉容器后不保证还在，数据库数据要另外放进卷或外部存储。

容器让程序及其用户态依赖更容易一起交付，但没有把整台电脑打包进去：容器和宿主机共享内核，配置、密钥、端口、CPU/内存和持久数据仍要单独安排。所以“做成容器”能减少环境差异，不等于应用一定没问题，也不等于自动具备高可用或备份。

## 再启动一个能从浏览器访问的容器

现在用 Nginx 看看一个长期运行的服务和刚才的一次性程序有什么不同：

~~~powershell
docker run -d --name web -p 127.0.0.1:8080:80 nginx:alpine
docker ps
~~~

`-d` 让容器在后台运行；`--name web` 给这次容器实例起一个容易记的名字；`-p 127.0.0.1:8080:80` 把本机回环地址的 8080 端口转到容器的 80 端口；`nginx:alpine` 是镜像名和标签。浏览器打开 `http://localhost:8080`，应看到 Nginx 欢迎页。这里的 8080 是你电脑上的端口，80 是容器内 Nginx 监听的端口。

确认后停止并删除练习容器：

~~~powershell
docker stop web
docker rm web
~~~

`stop` 停止进程但保留容器记录；`rm` 删除已停止的容器。镜像仍保留在电脑上。以后启动自己的服务时也会依次遇到这几件事：选镜像、创建容器、按需要发布端口、检查进程状态。

## 没跑通时先查什么

- `docker` 找不到：命令行工具没有安装好，或当前终端还没刷新 PATH。
- 报 `Cannot connect to the Docker daemon`：客户端在，但后台引擎没启动或连错引擎。
- 拉取镜像超时：检查网络、代理或镜像仓库；这还没到容器启动阶段。
- 报 `port is already allocated`：本机 8080 已被占用。先运行 `docker rm -f web` 清理这次名为 web 的练习容器，再把命令中的本机端口改成 `8081:80`。
- 浏览器连接失败：先运行 `docker ps` 确认状态为 Up，并查看 `PORTS` 列有没有 `127.0.0.1:8080->80/tcp`。

如果 `web` 已经存在，重复执行创建命令会报名字冲突。运行 `docker ps -a` 找到它，再用 `docker rm -f web` 删除练习容器后重试。`-f` 会强制停止并删除，因此只对本课创建的 web 容器使用。

## 你现在应该能解释什么

不看上文，试着回答：刚才哪个东西被下载了？哪个东西运行后退出了？Nginx 为什么在浏览器能访问？如果删除 web 容器，Nginx 镜像还在吗？这几个答案就是下一课要继续用的基础。

## Docker 这条链路上分别是谁在干活

敲下 docker 命令时，CLI 通常不是自己去创建 Linux 进程，而是把请求发给 Docker Engine 的 API。Engine 再协调镜像、网络、卷和容器运行时。这里的 daemon 是常驻服务；镜像仓库是存放和分发镜像的远端服务，不是容器运行时。

~~~text
docker CLI -> Docker Engine API -> containerd / OCI runtime -> Linux 进程与隔离
                    |                    |
                    |                    +-> 挂载镜像层、创建网络和容器进程
                    +-> 管理镜像、容器、网络、卷

本地镜像不存在时：Docker Engine -> Registry 拉取镜像
~~~

这几个名字回答不同问题：镜像解决“用什么文件和启动参数”，容器解决“这一次进程怎么运行”，网络解决“进程怎么通信”，卷解决“容器替换后数据放哪儿”。Docker 不会替你决定应用该有几个副本，也不自动保证数据库备份正确。

## 做一个最小实验：看命令、镜像和容器的边界

先看 CLI 能否连上 Engine，再运行一个只打印信息就退出的临时容器。这个实验不需要暴露端口，也不会留下停止中的容器。

~~~powershell
docker version
docker context show
docker run --rm alpine:3.21 sh -c 'echo inside-container; uname -s'
docker ps -a --filter ancestor=alpine:3.21
docker image ls alpine
~~~

预期能看到客户端与服务端版本、当前 context、容器内打印的文本。最后的容器列表为空是正常的，因为 --rm 在进程退出后删除了这次实例；alpine 镜像仍保留在本机。若 version 只显示 Client 而没有 Server，问题在 CLI 到 Engine 的连接，不在镜像。

这也解释了“我装了 Docker，怎么还不能访问服务”：装客户端不等于 Engine 正在运行；镜像下载成功也不等于容器启动；容器启动也不等于程序已发布端口。排错时按这条链路一层层验证。

## 容器隔离能解决什么，不能解决什么

容器使用内核提供的进程、挂载、网络等隔离能力，多个容器仍共享宿主机内核。它启动快、镜像便于复制，但隔离程度和故障边界与完整虚拟机不同。容器里的 root 也不应被理解成可以安全地运行任意不可信代码。不要因为“容器化了”就省略最小权限、网络策略、镜像审查和数据备份。

## 参考资料

- [Docker 入门](https://docs.docker.com/get-started/)
- [容器是什么](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/)
