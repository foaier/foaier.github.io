---
title: 安装 Docker：Windows、macOS、Ubuntu 分开走
date: '2026-11-24'
summary: 选对终端和安装方式，用 hello-world 检查客户端、引擎与镜像下载。
series: Docker 与 Kubernetes
order: 2
tags:
  - Docker
  - Docker 入门
level: Docker 入门
prerequisites:
  - docker-why
goals:
  - 完成安装和自检，选择本机 Linux 容器环境。
---
先把环境统一：本系列运行 **Linux 容器**，主要命令使用 **Bash**。Windows 使用 Docker Desktop + WSL 2，在 Ubuntu 终端练习；macOS 使用 Terminal；Ubuntu 服务器使用 Bash。只有标明 PowerShell 的安装步骤才在 PowerShell 里执行。

命令块里不带 `$`、`#` 提示符，复制时整段复制即可。命令末尾的反斜杠 `\` 表示下一行仍属于同一条命令，不要在它后面加空格。

## Windows：安装 WSL 2 和 Docker Desktop

准备 Windows 11，启用硬件虚拟化。右键开始菜单，打开“终端（管理员）”，在 **PowerShell** 运行：

~~~powershell
wsl --install -d Ubuntu
~~~

如果要求重启，先重启。第一次打开 Ubuntu 会让你创建 Linux 用户名和密码；输入密码时不显示字符是正常的。已安装 Ubuntu 的电脑不用重复安装，可以检查：

~~~powershell
wsl --update
wsl --list --verbose
~~~

Ubuntu 的 VERSION 应为 `2`。再从 [Docker Desktop Windows 安装页](https://docs.docker.com/desktop/setup/install/windows-install/)下载并安装，启动 Docker Desktop。在设置里使用 WSL 2 引擎，并在 Resources → WSL Integration 启用 Ubuntu。保持 Docker Desktop 运行。

接下来的实验都打开 **Ubuntu** 终端。不要在 WSL 里再装一套独立 Engine 与 Desktop 混用。执行 `docker version` 时出现 Client 和 Server，才继续。

## macOS：先选对芯片版本

打开 [Docker Desktop Mac 安装页](https://docs.docker.com/desktop/setup/install/mac-install/)，按 Apple Silicon 或 Intel 下载。安装到 Applications，首次打开并完成初始化。之后在 Terminal 执行本系列 Bash 命令。

磁盘要留出下载镜像和数据库实验的空间。MySQL 主从、Redis 集群是后面的选做实验，不要一开始同时启动所有服务。电脑睡眠后，本机服务也不能继续当线上服务器使用。

## Ubuntu：安装 Engine 和 Compose 插件

下面按一台**新的 Ubuntu 24.04 练习机**写。已有容器业务的机器应先核对官方升级说明。先配置 Docker 官方软件源：

~~~bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $VERSION_CODENAME
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
~~~

这些是 Linux 命令，不要在 PowerShell 中执行。Linux 用户后续可继续给 Docker 命令加 `sudo`；若是你独占的练习机，也可按官方安装后说明把自己的账户加入 docker 组，退出登录后再登录。该组能控制宿主机，不能随便给别人。

## 三条检查都通过，再进入下一课

在你选好的终端执行：

~~~bash
docker version
docker compose version
docker run --rm hello-world
~~~

正常结果依次是：Client 和 Server 版本；Compose 版本；`Hello from Docker!`。这说明命令能连上引擎，引擎能获取并运行测试镜像。`--rm` 会在程序结束后删除测试容器。

再看一下当前 Docker 连接到哪里：

~~~bash
docker context ls
docker info --format 'os={{.OSType}} arch={{.Architecture}}'
~~~

本系列要求 `os=linux`。context 是连接配置，星号表示当前选项；如果指向公司的远程引擎，切回本机再练习，不要把后面的删除命令发到公司服务器。

## 按报错定位，不要反复重装

| 现象 | 说明 | 先做什么 |
|---|---|---|
| 找不到 docker 命令 | 终端找不到客户端 | Desktop 安装后重开终端，检查 WSL Integration |
| 只有 Client，没有 Server | 后台没有连通 | 打开 Desktop；Linux 查 `sudo systemctl status docker` |
| Linux socket permission denied | 当前账户没有权限 | 用 `sudo docker version` 区分权限与服务问题 |
| pull 超时 | 获取镜像失败 | 查网络、Desktop 代理、仓库是否可访问 |
| no matching manifest | 镜像缺少对应平台 | 核对镜像支持的 CPU 架构和容器系统 |

镜像加速地址可能失效，也可能来自未知维护者。先使用官方仓库；公司网络需配置代理时，Docker Engine 的网络配置和终端代理不一定是一回事，不要随手覆盖整份 `daemon.json`。

下一课开始只操作本机练习资源。安装阶段不用清理磁盘、关闭防火墙，也不用删除 WSL 发行版。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/engine/install/ubuntu/)
- [进一步了解相关机制](https://docs.docker.com/desktop/)
