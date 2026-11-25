---
title: Nginx 11：入口机器也会坏，Keepalived 和 VIP 怎样接班
date: '2026-11-25'
summary: 在两台 Linux 实验机上搭建入口主备，检测 Nginx 失效并观察虚拟 IP 漂移。
series: Nginx 从入门到实战
order: 11
tags: [Nginx, Keepalived, 高可用]
level: Linux 进阶
prerequisites: [nginx-troubleshooting]
goals:
  - 区分后端负载均衡与入口高可用。
  - 理解 VIP、VRRP、优先级和服务检查的关系。
  - 在满足网络条件的两台实验虚拟机上观察主备切换。
---

有两个后端，不代表整个网站没有单点。如果唯一的 Nginx 入口机器关机，后端再健康也接不到请求。

这一课把入口也准备两份，再给客户端一个稳定的入口 IP。某个入口坏了，让另一个接手这个地址。这里使用的 Keepalived 是独立的 Linux 软件，和 Nginx upstream 中的 `keepalive` 连接复用没有关系。

## 这课需要换到两台 Linux 虚拟机

前十课能在 Docker Desktop 里完成。这一课要观察局域网内的虚拟 IP 与地址漂移，需要两台同网段的 Linux 实验虚拟机，以及能访问这个网段的测试终端。

示例地址规划如下，使用前替换为你的实际网段和网卡：

| 角色 | 地址 | 网卡 |
|---|---|---|
| 入口 A | `192.168.56.11/24` | `ens33` |
| 入口 B | `192.168.56.12/24` | `ens33` |
| 虚拟 IP，VIP | `192.168.56.100/24` | 当前主节点持有 |

VIP 必须未被其他机器占用，并且网络允许节点拥有额外地址、发送相关 ARP 信息。某些云网络不能用这种方式随意漂移 IP，应采用云负载均衡、浮动 IP 或厂商支持的方案。两个 Docker Desktop 容器共用同一宿主，不能据此证明两台机器的入口容灾。

本项目的自动检查不包含两台虚拟机的真实 VIP 切换；本课给出独立实验步骤和验收条件，需要在这个网络环境里执行。

## 先让两个入口各自正常提供网页

在两台**全新的 Ubuntu 实验虚拟机**上安装：

```bash
sudo apt update
sudo apt install -y nginx keepalived curl tcpdump
ip -br address
hostname
```

把实验包中的 `ha/` 目录分别复制到两台机器。在 `nginx-labs` 目录下，将教学站点装入 Nginx：

```bash
# 仅针对新安装的 Ubuntu 默认站点，移除 sites-enabled 中的默认链接。
sudo unlink /etc/nginx/sites-enabled/default
sudo install -m 644 ha/site.conf /etc/nginx/sites-enabled/nginx-lab.conf
sudo nginx -t && sudo systemctl reload nginx
curl -fsS http://127.0.0.1/healthz
curl -fsS http://127.0.0.1/
```

第一条返回 `ok`，第二条返回 `gateway=主机名`。如果默认链接已经不存在，跳过 unlink。这里使用系统包的 Nginx，不再使用 Docker 的配置路径。

测试终端分别访问 A、B 的实际 IP，确认两台都正常，再开始配置 VIP。否则主备切换只是把故障从一台交给另一台。

## 服务检查不能只看 keepalived 进程

Keepalived 还活着，但 Nginx 已经停止，入口照样不可用。因此要监测本地 HTTP 服务。

`ha/check-nginx.sh` 很短：

```sh
#!/bin/sh
exec /usr/bin/curl -fsS --max-time 1 http://127.0.0.1/healthz >/dev/null
```

在两台机器安装并验证：

```bash
sudo install -o root -g root -m 755 ha/check-nginx.sh /usr/local/sbin/check-nginx.sh
sudo /usr/local/sbin/check-nginx.sh
echo $?
```

退出码 0 表示检查通过。脚本和父目录不能由普通用户随意修改，因为它会被高权限服务执行。

本地 `/healthz` 只证明这个 Nginx 入口能够响应，不证明数据库、全部后端和所有业务都健康。如果把共享数据库故障也当成入口切换条件，可能导致两台入口反复切换却谁都无法修复数据库。检查范围要对应它能解决的问题。

## Keepalived 的几组参数怎样配合

A 的完整文件在 `ha/keepalived-a.conf`。核心结构如下：

```text
vrrp_script check_nginx {
    script "/usr/local/sbin/check-nginx.sh"
    interval 2
    timeout 2
    fall 2
    rise 2
    weight 0
}
vrrp_instance VI_NGINX {
    state BACKUP
    interface ens33
    virtual_router_id 71
    priority 150
    advert_int 1
    unicast_src_ip 192.168.56.11
    unicast_peer { 192.168.56.12 }
    virtual_ipaddress { 192.168.56.100/24 dev ens33 }
    track_script { check_nginx }
}
```

`virtual_router_id` 标识这一组主备实例，同组必须相同，同一网络其他组不要冲突。A 的优先级 150，B 是 100。两台初始都设 BACKUP，也能通过选举让更高优先级的一台成为主节点。

`interval 2` 每两秒检查一次，`fall 2` 连续失败两次才判定失败，`rise 2` 连续成功两次再恢复。这里 `weight 0` 配合跟踪脚本，失败让实例进入故障状态、放弃 VIP，而不是轻微降几分却仍然比备机高。

千万别只定义 `vrrp_script` 却漏掉 `track_script`，那样实例可能根本没有使用这个检查。

本例使用单播 peer。网络规则需要允许两节点间的 VRRP **IP 协议 112**，它不是 TCP/UDP 的 112 端口；同时允许测试所需的 HTTP。不要通过关闭整机防火墙来代替确认规则。

## 两台分别安装配置并启动

先按实际环境修改两份文件的 IP、网卡和 VIP，再执行：

```bash
# A 上执行；B 上把文件名换成 keepalived-b.conf。
sudo install -o root -g root -m 600 ha/keepalived-a.conf /etc/keepalived/keepalived.conf
sudo keepalived -t -f /etc/keepalived/keepalived.conf
sudo systemctl enable --now keepalived
sudo systemctl restart keepalived
sudo journalctl -u keepalived -n 30 --no-pager
ip -br address
```

检查时实际运行版本的参数以 `keepalived --help` 为准。两台都启动后，正常情况下 VIP 只在 A 上出现。

测试终端运行：

```bash
while true; do
  date '+%T'
  curl --max-time 2 -sS http://192.168.56.100/ || true
  sleep 1
done
```

按 Ctrl+C 结束循环。返回的主机名能帮助你判断当前由谁服务。

## 分别测试“入口进程坏了”和“整台机器坏了”

先在 A 执行 `sudo systemctl stop nginx`，观察检查失败后 VIP 转到 B，测试终端开始返回 B 的主机名。再启动 A 的 Nginx，观察恢复后的行为；本例默认允许高优先级节点重新抢占，所以可能切回 A。

之后再测试关闭 A 虚拟机。这个场景依靠 VRRP 对主节点失联的检测，和本地 HTTP 检查是不同路径。切换可能有短暂失败，已有 TCP 连接也不会自动搬到 B，不能把它宣传成所有请求都无感。

同时在两台观察：

```bash
ip -br address
sudo journalctl -u keepalived -f
sudo tcpdump -ni ens33 'ip proto 112'
```

如果两台同时拥有 VIP，先查 peer 是否可达、协议112是否被拦、VRID是否一致等。这种脑裂会导致流量不稳定，不能仅凭其中一次 curl 成功就判定高可用完成。

## 双主不是共享一份 VIP，也不会自动同步配置

双主通常是两个 VRRP 实例、两份 VIP：A 优先持有 VIP1，B 优先持有 VIP2；某台故障时，另一台接管两份地址。两个实例使用不同 VRID，各自在两节点间配对，并设计客户端如何选择入口。它增加了故障时的容量要求，也增加了运维复杂度。

Keepalived 不会自动同步 Nginx 配置、TLS 私钥和站点文件。两个入口需要通过同一发布流程保持一致，并能在接管全部流量时承受负载。对多数入门场景，先把一份 VIP 的主备切换、检查范围和故障恢复做扎实。

## 继续阅读

- [Keepalived 项目与文档入口](https://www.keepalived.org/)
- [Keepalived 配置手册源码](https://github.com/acassen/keepalived/blob/master/doc/man/man5/keepalived.conf.5.in)
- [Nginx 进程控制](https://nginx.org/en/docs/control.html)
