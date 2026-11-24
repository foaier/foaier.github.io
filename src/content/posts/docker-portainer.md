---
title: Portainer 实战：把网页按钮和 Docker 命令对起来
date: '2026-11-24'
summary: 安装本机管理界面，用一个容器对照日志、状态、启停与权限。
series: Docker 与 Kubernetes
order: 22
tags:
  - Docker
  - Docker 进阶
level: Docker 进阶
prerequisites:
  - docker-redis-cluster
goals:
  - 管理明确的练习容器，理解 Docker socket 与数据卷用途。
---
Portainer 把常用 Docker 操作放进网页：看容器状态、日志、环境和卷，还能编辑 Compose Stack。它没有替换 Docker Engine，按钮最终还是在调用 Docker 的接口。学过命令再用界面，出问题时才知道应该查哪个对象。

本节安装 Portainer CE，使用自己独占的 Linux Docker 环境。Windows/macOS 使用 Linux 容器模式时可按其官方平台说明调整；已有公司的管理平台不要重复安装。

## 先理解为什么要挂 Docker socket

Portainer 要管理本机容器，通常会连接 `/var/run/docker.sock`。能调用这个 socket 的程序拥有很高的主机控制能力；把卷标成 ro 不会自动把 Docker API 变成只读 API。

所以只在自己的实验机安装，并把管理页面绑定到本机。它不是一个普通“随便公开也没事”的网页。

## 创建数据卷，再启动服务

~~~bash
docker volume create portainer-note-data
docker run --name portainer-note -d --restart unless-stopped \
  -p 127.0.0.1:9443:9443 \
  --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
  --mount source=portainer-note-data,target=/data \
  portainer/portainer-ce:lts
docker logs --tail 30 portainer-note
~~~

lts 是会更新的发行渠道标签，生产环境需按兼容矩阵固定具体版本并安排升级。这里使用 HTTPS 9443，不沿用旧示例的 HTTP 9000。

浏览器打开 `https://localhost:9443`。初次使用默认自签证书，浏览器会提示证书不受信任；只在确定地址是刚启动的本机服务时继续。远程服务器请通过受保护的管理通道或 SSH 端口转发访问，不需要把页面绑定到公网。

## 第一次进入要做什么

创建管理员账号，按界面要求设置密码，选择本地 Docker 环境。不同版本菜单名称可能变化，重点确认当前环境的 endpoint 是本机 socket。

如果首次初始化超时锁定，先看日志，按提示重启 Portainer 容器后及时完成初始化，不用删除数据卷。已设置过管理员却看到全新注册页，检查是不是换了卷名或挂错 `/data`。

## 用同一个容器对照网页和命令

先在终端创建一个便于识别的网页容器：

~~~bash
docker run --name portainer-web -d -p 127.0.0.1:8091:80 nginx:stable-alpine
docker ps --filter name=portainer-web
curl -I http://localhost:8091
~~~

在 Portainer 的 Containers 找到 portainer-web，依次打开 Logs、Inspect、Stats。刷新浏览器网页，再看日志里是否出现访问记录。

| 网页操作 | 对应命令 |
|---|---|
| 查看容器 | `docker ps -a` |
| Logs | `docker logs portainer-web` |
| Inspect | `docker inspect portainer-web` |
| Stats | `docker stats portainer-web` |
| Stop / Start | `docker stop` / `docker start` |
| Remove | `docker rm`，另看界面是否勾选删除关联卷 |

在界面 Stop，再回终端检查 ps -a，应是 Exited；用命令 start，界面刷新后应恢复 Running。这样能确认你看的确实是同一个 Engine，而非另一个远端环境。

## Stack 与现有 Compose 项目

Stack 可以把一份 Compose 配置当作一个项目管理。练习时新建独立名字，不要把终端已有的同名应用再导入部署一遍，容易出现端口冲突或两份数据卷。

如果 Stack 使用相对路径挂载，路径解释位置取决于 Portainer 的部署方式，不等于你电脑当前目录；不能只把 YAML 粘进网页就期待本机源码也自动上传。初学阶段继续从终端运行完整实验包更清楚。

## 故障与卸载

无法连接环境，先查 socket 是否存在、Docker 是否启动、Portainer 版本是否支持当前 Engine API。页面打不开先 `docker port portainer-note` 和 logs，再看 HTTPS 地址，别把 9443 当 HTTP。

~~~bash
docker rm -f portainer-web
docker stop portainer-note
docker rm portainer-note
docker volume inspect portainer-note-data
~~~

停止 Portainer 不会自动停止它管理的其他容器。卷保留了管理配置，确认不要后再删除。`restart unless-stopped` 表示未被手工停止时可随引擎恢复；不是“无论谁点 Stop 都会立刻自己回来”。

## 继续阅读

- [命令与配置说明](https://docs.portainer.io/start/install-ce/server/docker/linux)
- [进一步了解相关机制](https://docs.portainer.io/user/docker)
