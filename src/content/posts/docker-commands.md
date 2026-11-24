---
title: 容器命令：run、ps、start、stop、exec 前先学会这些
date: '2026-11-24'
summary: 运行网页和交互式 Ubuntu，观察容器从创建到退出的状态。
series: Docker 与 Kubernetes
order: 4
tags:
  - Docker
  - Docker 入门
level: Docker 入门
prerequisites:
  - docker-image-container
goals:
  - 解释 run 参数，并完成启动、停止、恢复和清理。
---
这节用一个网页和一个交互式终端练 Docker 容器命令。所有命令在本机 Bash 的任意目录执行，不依赖源码。完成后你会知道：`run`、`start`、`stop`、`rm` 分别动了什么，为什么 `-d` 不保证程序一直活着。

## 第一条 run 怎么读

~~~bash
docker run --name web-command -d -p 127.0.0.1:8080:80 nginx:stable-alpine
~~~

| 片段 | 作用 |
|---|---|
| `docker run` | 新建一个容器并启动 |
| `--name web-command` | 给这次实例起名，后面用名字操作 |
| `-d` | 后台运行，终端返回容器 ID |
| `-p 127.0.0.1:8080:80` | 本机 8080 转到容器内 80，只允许本机连接 |
| `nginx:stable-alpine` | 使用哪个镜像 |

打开浏览器 `http://localhost:8080`，应看到 Nginx 欢迎页。如果你是在远程 Linux 服务器练习，这个地址指的是服务器自己；应在服务器运行 `curl`，不能在自己电脑浏览器里把 localhost 当成远端。

~~~bash
curl -I http://localhost:8080
docker ps --filter name=web-command
~~~

响应应包含 `200 OK`，容器状态应是 `Up`。`run` 再执行一次会因名字已存在而失败，不会自动复用旧容器。

## ps、stop、start：状态怎么变

~~~bash
docker stop web-command
docker ps
docker ps -a --filter name=web-command
docker start web-command
curl -I http://localhost:8080
~~~

`ps` 默认只列运行中的容器，`ps -a` 还列停止的容器。stop 后记录仍在，因此 start 能按原参数启动它。start 不会重新执行一次完整的 run，也不会应用你后来想改的新端口。

| 命令 | 什么时候用 | 后果 |
|---|---|---|
| `docker restart web-command` | 需要重启已有进程 | 容器还在，参数没变 |
| `docker stop web-command` | 正常停止 | 先通知进程退出，超时后才强制结束 |
| `docker kill web-command` | 必须立即终止的诊断场景 | 默认强制终止，应用来不及收尾 |
| `docker rm web-command` | 删除已停止容器 | 容器可写层一起删除 |

## -it：进入一个交互式容器

~~~bash
docker run --name ubuntu-command -it ubuntu:24.04 bash
~~~

现在进入的是**容器里的 Bash**。`-i` 保持输入，`-t` 分配终端。执行下面两条，最后退出：

~~~bash
cat /etc/os-release
pwd
exit
~~~

回到宿主终端后，`docker ps -a --filter name=ubuntu-command` 应显示 Exited。因为主进程 Bash 退出了。若想只离开终端而保留主进程，可依次按 Ctrl+P、Ctrl+Q；恢复连接用 `docker attach ubuntu-command`。attach 连回原进程，按 Ctrl+C 可能影响它，平时检查运行中的服务更推荐下一课的 exec。

## 为什么后台容器一启动就退出

~~~bash
docker run --name short-command -d alpine:3.22 echo finished
docker logs short-command
docker ps -a --filter name=short-command
~~~

日志只有 `finished`，状态是 Exited (0)。这不是故障：echo 已经干完活了，`-d` 只是让终端不用等，不会让应用变成长驻服务。Nginx、Redis 这类服务在容器内应保持前台主进程，Docker 再负责后台管理。

`docker run -d 容器名` 这种记法是错的，run 后必须给**镜像**。已有容器重新启动用 start。

## 清理前先查名字

~~~bash
docker stop web-command
docker rm web-command ubuntu-command short-command
docker ps -a
~~~

若你之前用 Ctrl+P、Ctrl+Q 留下 Ubuntu 运行，先 `docker stop ubuntu-command` 再删。不要为了省事删除电脑上的全部容器。

常见错误：`name is already in use` 查同名容器；`port is already allocated` 改本机端口，如 `8081:80`，容器内的 80 不变。失败的 run 也可能留下 Created 状态的容器，确认是本次实验对象后先 rm，再用新端口创建。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/reference/cli/docker/container/run/)
- [进一步了解相关机制](https://docs.docker.com/reference/cli/docker/container/ls/)
