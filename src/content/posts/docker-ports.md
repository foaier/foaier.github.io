---
title: Nginx 与 Tomcat 实战：端口映射、首页部署和 404 排错
date: '2026-11-24'
summary: 两个网页容器对照练习，分清发布端口、容器监听与请求路径。
series: Docker 与 Kubernetes
order: 9
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - docker-volumes
goals:
  - 运行两种网页服务，部署首页并解释 404 与连接失败的区别。
---
“容器是 Up，网页却打不开”不一定是防火墙问题。这课运行 Nginx 与 Tomcat，分清本机端口、容器端口、HTTP 404 三件事。准备：已读容器命令与卷章节，使用本机 Bash。

## Nginx：从端口映射开始

~~~bash
docker run --name nginx-port -d -p 127.0.0.1:8085:80 nginx:stable-alpine
docker port nginx-port
curl -I http://localhost:8085
~~~

应看到类似 `80/tcp -> 127.0.0.1:8085`，请求返回 200。浏览器访问的是**电脑的 8085**，Docker 再把流量转到**容器内的 80**。两个数字不必相同。

~~~text
浏览器 localhost:8085 → Docker 发布端口 → Nginx 容器 :80
~~~

| 写法 | 意思 |
|---|---|
| `-p 127.0.0.1:8085:80` | 只从本机 8085 访问 |
| `-p 8085:80` | 默认绑定所有主机接口，暴露范围更大 |
| `-p 127.0.0.1::80` | 由 Docker 分配一个本机随机端口 |
| `-P` | 将镜像声明的端口发布到随机端口 |

想改已创建容器的映射，需要按新配置重建容器；restart 不会替你改端口。

## Tomcat：返回 404 说明什么

Tomcat 是运行 Java Web 应用的服务器。下载兼容 Java 21 的 Tomcat 10.1 镜像并运行：

~~~bash
docker run --name tomcat-port -d -p 127.0.0.1:8086:8080 tomcat:10.1-jre21-temurin
docker logs --tail 20 tomcat-port
curl -i http://localhost:8086
~~~

Tomcat 初始化时可能还没准备好，看到启动完成日志后再请求。官方镜像的根应用可能为空，访问 `/` 返回 404。这表示 HTTP 请求已经到达服务器，只是这个路径没有页面；关防火墙不会把缺失的网页变出来。

Tomcat 10 使用 Jakarta API，旧的 `javax.servlet` 应用不能只换镜像就假定兼容。这里先部署静态页面，不引入 Java Web 编程。

## 给 Tomcat 放一个自己的首页

在宿主终端建立目录：

~~~bash
mkdir -p ~/docker-practice/tomcat
cd ~/docker-practice/tomcat
printf '<h1>Tomcat is serving my page</h1>\n' > index.html
docker exec tomcat-port mkdir -p /usr/local/tomcat/webapps/ROOT
docker cp index.html tomcat-port:/usr/local/tomcat/webapps/ROOT/index.html
curl http://localhost:8086
~~~

应看到刚写的内容。ROOT 对应网站根路径；放到 `webapps/demo` 则访问 `/demo/`。复制文件进入容器只是帮助观察，容器重建后可能丢失，正式交付要用 Dockerfile 或明确挂载目录。

## EXPOSE 和真正监听不是一回事

~~~bash
docker image inspect nginx:stable-alpine --format '{{json .Config.ExposedPorts}}'
docker inspect nginx-port --format '{{json .NetworkSettings.Ports}}'
~~~

第一条是镜像声明“打算使用的端口”，第二条是容器实际发布的端口。Dockerfile 写 `EXPOSE 80` 不会自动创建本机 80 端口，也不会让一个本来没监听的进程开始监听。

容器内的应用若只监听自己的 `127.0.0.1`，外部端口映射也可能连不上；服务通常需要在容器内监听 `0.0.0.0`。这与主机映射只绑定 `127.0.0.1` 不冲突，它们是两边不同的地址。

## 按返回结果查问题，再清理

| 结果 | 先查哪里 |
|---|---|
| run 提示端口已分配 | 本机端口冲突，换映射左边的端口 |
| Connection refused | 容器是否运行、程序是否已监听、映射是否正确 |
| 一直超时 | 地址、网络路径、防火墙；远端机器别写本机 localhost |
| HTTP 404 | 应用已响应，查 URL 路径和部署目录 |
| HTTP 500 | 查应用日志和后端依赖 |

可以先执行 `docker ps -a`、`docker logs 容器名`、`docker port 容器名`，每次确认一个环节。学习结束只清理本节两个容器：

~~~bash
docker stop nginx-port tomcat-port
docker rm nginx-port tomcat-port
~~~

## 继续阅读

- [命令与配置说明](https://hub.docker.com/_/nginx)
- [进一步了解相关机制](https://hub.docker.com/_/tomcat)
