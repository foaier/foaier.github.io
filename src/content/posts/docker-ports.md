---
title: "容器里的端口为什么打不开？把 EXPOSE 和端口映射分开看"
date: "2026-11-24"
summary: "通过主机与容器两侧端口映射，区分 EXPOSE 声明和真正发布端口。"
series: "Docker 与 Kubernetes"
order: 10
tags: ["Docker 实战","Docker","Kubernetes"]
level: "Docker 实战"
prerequisites: ["docker-production-image"]
goals: ["正确使用 `-p` 并解释 Dockerfile EXPOSE 不会自动打开宿主机端口。"]
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

## 怎么确认做对了

`docker port` 应显示容器 8080 映射到本机 8081，健康请求返回 alive。Dockerfile 的 EXPOSE 仍然可以帮助读者看出容器的预期服务端口，但它本身没有完成这条映射。

## 留一个小练习

把主机端口改为 8082，容器端口保持 8080。再故意把两侧写成 8082:8082，观察浏览器连不上。找到容器日志与 API 实际监听配置，说明哪一侧配错了。

## 没跑通时先查什么

端口占用先选一个空闲的主机端口；容器端口不要跟着乱改。API 只监听 localhost 时，容器转发来的连接可能进不去，检查 ASPNETCORE_HTTP_PORTS 和监听日志。远端机器还要考虑云防火墙；`-p` 不会自动帮你改云平台规则。

绑定 `127.0.0.1` 只限制宿主机对外的发布地址，不会隔离 Docker 网络里其他可访问该容器端口的服务。测试时先从本机访问，再从同网络的另一个服务访问，能分辨宿主机端口映射和容器间通信这两件事。

## 参考资料

- [发布和暴露端口](https://docs.docker.com/engine/network/port-publishing/)
- [容器网络](https://docs.docker.com/engine/network/)
