---
title: 容器排错：查状态、读日志、进容器、复制文件
date: '2026-11-24'
summary: 故意制造退出错误，再用 logs、inspect、exec、top 和 stats 找证据。
series: Docker 与 Kubernetes
order: 5
tags:
  - Docker
  - Docker 入门
level: Docker 入门
prerequisites:
  - docker-commands
goals:
  - 用退出码和日志定位故障，区分网络错误与 HTTP 错误。
---
这一课故意制造一个失败，再把证据找出来。准备：已经会 run、ps、stop、rm。所有命令在本机 Bash 执行；需要写文件时会说明目录。我们用独立名字，避免与上一课的网页冲突。

## 先制造一个“启动后就退出”的容器

~~~bash
docker run --name broken-demo alpine:3.22 sh -c 'echo missing-config; exit 7'
docker ps -a --filter name=broken-demo
docker logs broken-demo
docker inspect broken-demo --format 'status={{.State.Status}} exit={{.State.ExitCode}}'
~~~

应依次看到 `missing-config`、Exited (7)、同一条日志、`status=exited exit=7`。退出码由程序决定，7 在这里是我们故意写的数字，不代表所有软件都用 7 表示同一种错误。

这次不用猜端口，因为程序根本没有持续运行。正确顺序是先查状态，再读日志，最后对照启动配置。

## logs 的几个参数什么时候用

另起一个正常网页，访问一次，让它产生访问日志：

~~~bash
docker run --name debug-web -d -p 127.0.0.1:8082:80 nginx:stable-alpine
curl -s http://localhost:8082 >/dev/null
docker logs --tail 20 --timestamps debug-web
~~~

| 参数 | 用途 |
|---|---|
| `--tail 20` | 只读最后 20 行 |
| `--since 10m` | 只看最近十分钟 |
| `--timestamps` | 带时间，方便对照请求 |
| `-f` | 持续等新日志，Ctrl+C 结束查看 |

~~~bash
docker logs -f debug-web
~~~

另开浏览器刷新页面，终端应出现新访问记录。看完按 Ctrl+C，只停止跟随日志，网页继续运行。Docker 读取的是程序写到标准输出和标准错误的内容，程序只写磁盘日志时，logs 不会自动找到那些文件。

## exec、top、stats 各看什么

~~~bash
docker exec debug-web nginx -t
docker exec -it debug-web sh
~~~

第一条检查 Nginx 配置，应显示 successful。第二条打开容器内的新 shell，在里面执行 `ls /etc/nginx`，再 `exit` 回到宿主终端。exec 新开的 shell 退出，不会关闭原来的 Nginx 主进程。

~~~bash
docker top debug-web
docker stats --no-stream debug-web
docker inspect debug-web --format '{{json .NetworkSettings.Ports}}'
~~~

top 看进程，stats 看一次 CPU/内存等资源采样，inspect 看 Docker 保存的配置和状态。`--no-stream` 很重要，不加会一直刷新。Alpine 镜像可能没有 bash，用 sh；容器已经退出时不能 exec，但日志和 inspect 仍可读。

## cp：把文件带出来看，不必装编辑器

在宿主终端建立一个实验目录：

~~~bash
mkdir -p ~/docker-practice/debug
cd ~/docker-practice/debug
docker cp debug-web:/etc/nginx/nginx.conf ./nginx.conf
head -n 12 nginx.conf
~~~

`容器名:路径` 表示容器里的文件；`./nginx.conf` 是当前电脑目录里的副本。不要在生产容器内手改文件当作永久修复，重建容器后改动可能消失，最终要改回 Dockerfile 或挂载配置。

## 把现象和检查命令对上

| 现象 | 第一条该看什么 | 怎么确认 |
|---|---|---|
| 启动后退出 | `docker logs 容器名` | 是否缺文件、参数错、配置读不到 |
| Up 但网页打不开 | `docker port 容器名` | 本机端口是否真的发布 |
| HTTP 404 | 请求路径和应用路由 | 已有 HTTP 响应，别先关闭防火墙 |
| HTTP 500 | 请求时间附近的应用日志 | 已到应用，继续查数据库等依赖 |
| 不停重启 | `inspect` 退出状态 + 最近日志 | 不要把“会重启”当成“修好了” |

生产故障先保存时间、容器名、镜像名和最初的错误。循环删容器只会丢现场。完成实验后清理指定对象，保留刚才复制出来的配置：

~~~bash
docker rm broken-demo
docker stop debug-web
docker rm debug-web
~~~

## 继续阅读

- [命令与配置说明](https://docs.docker.com/reference/cli/docker/container/logs/)
- [进一步了解相关机制](https://docs.docker.com/reference/cli/docker/container/exec/)
