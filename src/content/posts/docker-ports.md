---
title: 容器里的端口为什么打不开？把 EXPOSE 和端口映射分开看
date: '2026-11-24'
summary: 通过主机与容器两侧端口映射，区分 EXPOSE 声明和真正发布端口。
series: Docker 与 Kubernetes
order: 10
tags:
  - Docker 实战
  - Docker
  - Kubernetes
level: Docker 实战
prerequisites:
  - docker-production-image
goals:
  - 正确使用 `-p` 并解释 Dockerfile EXPOSE 不会自动打开宿主机端口。
---

Dockerfile 有 `EXPOSE 8080`，但同事访问你电脑的 8080 却超时。原因通常不是 ASP.NET 没监听，而是 EXPOSE 不是防火墙规则，也不是端口转发命令。容器端口要映射到主机，浏览器才有入口。

## 宿主机端口和容器端口分开看

`-p 主机端口:容器端口` 像给房间装一道门牌映射。课程 API 在容器内监听 8080，练习把主机 8081 接到容器 8080，访问 `localhost:8081`。只在容器网络中暴露端口与绑定到 `0.0.0.0`/回环地址的范围，也会影响谁能访问。默认发布到所有主机网卡之前，先想清楚是不是要让局域网也能访问。

## 换一个本机端口试试

下载包里的 API 用环境变量监听 8080。启动时显式把主机端口绑定 127.0.0.1，避免这个课堂 Web 服务意外向局域网开放。`docker port` 可把容器当前映射重新读出来。

~~~powershell
docker run -d --name ports-api -p 127.0.0.1:8081:8080 container-course-api:local
docker port ports-api
Invoke-RestMethod http://localhost:8081/health/live
~~~

## 映射存在，也要看应用有没有在监听

下面不再重复列端口映射，而是读容器的实际映射字段和启动日志。映射写对但应用没监听目标端口，浏览器依旧连不上；先分清是 Docker 转发失败，还是程序没有接住连接。

~~~powershell
docker inspect ports-api --format '{{json .NetworkSettings.Ports}}'
docker logs --tail 30 ports-api
~~~

## 把容器端口、主机端口和监听地址分开

应用真正监听的是容器内部端口；docker run 的 -p 主机端口:容器端口 再建立从宿主机到容器的转发。容器里的程序必须监听容器接口，通常是 0.0.0.0，而不是容器自己的 127.0.0.1。Dockerfile 的 EXPOSE 只记录镜像意图，不创建转发规则。

~~~text
浏览器 -> 本机 127.0.0.1:8088 -> Docker 端口转发 -> 容器 :80 -> Nginx
容器间访问：API -> db:5432（Compose 网络 DNS，不经过宿主机发布端口）
~~~

将主机地址写成 127.0.0.1，表示只让本机访问；省略主机地址时通常绑定所有宿主机网卡。服务器发布服务前必须确认是否需要对局域网或公网开放，并同时配置防火墙、身份验证和 TLS。

## 用同一镜像比较不同的发布方式

先只绑定回环地址，检查浏览器可达；再停掉容器，用另一个本机端口重新发布。两个容器端口都为 80，主机端口可以不同。

~~~powershell
docker run -d --name port-lab -p 127.0.0.1:8088:80 nginx:alpine
docker port port-lab
docker inspect port-lab --format '{{json .NetworkSettings.Ports}}'
docker stop port-lab
docker rm port-lab
docker run -d --name port-lab -p 127.0.0.1:8089:80 nginx:alpine
~~~

8088 被占用时，只换主机端口即可；容器内 Nginx 仍监听 80。Windows/macOS 的 Desktop 会经过虚拟化网络转发，Linux Engine 的网络实现细节可能不同，但端口映射的主机端口与容器端口含义相同。完成实验后用 docker rm -f port-lab 清理本节容器。

## 三种常见访问失败各看哪里

| 现象 | 检查方向 |
|---|---|
| 容器启动时报端口已被占用 | 换一个空闲主机端口；已有容器的发布规则不能原地改 |
| docker port 有映射但连接被拒绝 | 看进程是否运行、容器内实际监听端口、应用是否绑定 0.0.0.0 |
| 本机能访问，别的电脑不能访问 | 看是否只绑定 127.0.0.1、主机防火墙、路由和云安全组 |

不要为了排错把端口临时暴露到公网。容器间服务通常直接使用 Compose 网络服务名访问，数据库不需要为了 API 能连接而发布到宿主机。

## 参考资料

- [发布和暴露端口](https://docs.docker.com/engine/network/port-publishing/)
- [容器网络](https://docs.docker.com/engine/network/)
