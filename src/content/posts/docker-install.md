---
title: 先把 Docker 装好：确认命令和后台服务都能用
date: '2026-11-24'
summary: 按你的电脑选安装方式，用一次真实运行确认 Docker 已经准备好。
series: Docker 与 Kubernetes
order: 1
tags:
  - Docker
  - Docker 入门
level: 准备环境
prerequisites: []
goals:
  - 在自己的系统上安装 Docker，并用 hello-world 验证命令行、后台引擎和镜像下载都正常。
---

这篇只做一件事：让 Docker 在你的电脑上真的跑起来。安装软件图标出现了，不代表后台服务已经启动；我们会用命令逐项确认。先按自己电脑的系统看对应小节，不要把 Windows、macOS、Linux 的安装命令混着执行。

## 先确认你用的是什么终端

Windows 新手建议安装 Docker Desktop，并使用它推荐的 WSL 2 后端。安装前打开 PowerShell，执行下面命令检查 WSL；如果系统提示需要重启，先重启再继续。Docker Desktop 的安装步骤以官方页面为准，安装完成后打开 Docker Desktop，等状态显示运行中。

~~~powershell
wsl --status
~~~

macOS 安装并启动 Docker Desktop。Linux 则按自己的发行版跟随 Docker 官方 Engine 安装指南操作；不要从不认识的网站复制安装脚本。安装好后，Linux 用户可能需要用 sudo 执行 Docker 命令，权限怎么配置见后面的报错说明。

## 跑一个一次性的测试容器

打开新终端，复制这两条命令。第一条分别查询命令行和后台服务版本；第二条下载并运行官方测试镜像，完成后自动删除临时容器。

~~~powershell
docker version
docker run --rm hello-world
~~~

这里的 `--rm` 只会在测试程序结束后删除这个临时容器，不会卸载 Docker。首次运行需要联网下载镜像，所以可能要等一会儿。

## 对照屏幕上的结果

`docker version` 应同时显示 **Client** 和 **Server**。第二条命令应打印一段以 “Hello from Docker!” 开头的说明，然后回到提示符。这说明终端找到 Docker 命令、命令连上后台服务、服务也成功运行了一个容器。

如果你目前只看到 Client，命令行已安装，但后台服务未连接。Windows/macOS 先打开 Docker Desktop 并等待启动完成；Linux 先按发行版文档检查 Engine 服务。此时反复重装客户端通常没有帮助。

## 常见卡点按报错处理

- `docker` 不是命令：关闭当前终端，重新打开；还不行就检查 Docker Desktop/Engine 是否安装成功。
- `Cannot connect to the Docker daemon`：先启动 Docker Desktop；Linux 按官方文档检查 `docker` 服务是否运行。
- Linux 出现 `permission denied`：可以先用 `sudo docker run --rm hello-world` 验证服务。不要为了省事就把陌生人加入 docker 用户组，这种权限接近管理员权限。
- 下载卡住或超时：服务已经连通，问题更可能在网络、代理或镜像仓库访问；先确认网络策略，再试一次。

## 做完后记下这三项

记录你的操作系统、`docker version` 中的 Server 版本、hello-world 是否成功。之后遇到问题时，这三项能帮你判断是安装问题还是课程命令的问题。练习：退出 Docker Desktop，再运行一次 `docker version`；观察 Server 部分的变化，然后重新打开 Desktop 恢复环境。

## 参考资料

- [Docker Desktop 安装说明](https://docs.docker.com/desktop/)
- [Docker Engine 安装说明](https://docs.docker.com/engine/install/)
