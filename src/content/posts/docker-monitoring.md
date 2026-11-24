---
title: 容器监控实战：cAdvisor、Prometheus 与 Grafana
date: '2026-11-24'
summary: 先用 stats，再建立采集、存储和图表，排查为什么没有指标。
series: Docker 与 Kubernetes
order: 23
tags:
  - Docker
  - Docker 进阶
level: Docker 进阶
prerequisites:
  - docker-portainer
goals:
  - 检查采集目标，绘制内存与 CPU 曲线并解释指标边界。
---
`docker stats` 可以看到眼前的 CPU 和内存，但你凌晨三点没盯着终端，就不知道当时发生了什么。持续监控需要三个角色：采集、保存、展示。本节用 cAdvisor 采容器指标，Prometheus 存时间序列，Grafana 画图。

这是一套可重复的本机实验，不是完整生产监控平台。与旧的 InfluxDB 0.x 组合相比，这里选择 Prometheus 抓取 cAdvisor 的指标接口，便于继续学习指标查询和告警。

## 先用原生命令建立直觉

在本机 Bash 启动一个临时网页，再看它占多少资源：

~~~bash
docker run --name stats-note -d -p 127.0.0.1:8093:80 nginx:stable-alpine
docker stats --no-stream stats-note
docker top stats-note
docker rm -f stats-note
~~~

stats 显示 CPU、内存、网络和块 I/O。一次采样正常不代表昨天没有尖峰；内存使用率高也不自动等于内存泄漏，要结合负载和变化趋势。top 帮你看容器关联进程，不能替代历史指标。

## 这组完整实验在哪运行

下载[实验包](/downloads/docker-labs.zip)，在**独占的 Ubuntu Linux 练习机、默认 rootful Docker**上使用 monitoring 目录。cAdvisor 需要读取主机的 cgroups、Docker 数据目录与设备，示例因此给它高权限和特定挂载；这与普通网页或数据库容器不同。

Docker Desktop、rootless Docker、自定义数据目录、不同 cgroup/存储方式可能需要额外适配。Windows 新手可以先完成上一段 stats，再在准备好的 Linux 虚拟机练这组监控，不把不兼容当成自己命令抄错。

~~~bash
cd ~/docker-labs/monitoring
docker info --format 'root={{.DockerRootDir}} cgroup={{.CgroupVersion}}'
test -e /dev/kmsg && echo kmsg-present
docker compose config -q
~~~

示例按 `/var/lib/docker` 和 `/dev/kmsg` 配置。前提不满足就先调整环境；不要为一个监控容器关闭整台机器的安全机制。

## 启动，先查 Prometheus 是否收到数据

~~~bash
docker compose up -d
docker compose ps
docker compose logs --tail 30 cadvisor prometheus
~~~

服务有 web、cadvisor、prometheus、grafana。浏览器打开 `http://localhost:9090/targets`，cadvisor 目标应是 UP。实际抓取地址是容器网络里的 `cadvisor:8080`，不是浏览器上的 localhost。

prometheus.yml 的核心配置：

~~~yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: cadvisor
    static_configs:
      - targets: ["cadvisor:8080"]
~~~

在 Prometheus 查询页面输入 `up{job="cadvisor"}`，应得到 1。它只证明采集目标可访问，不代表每个业务都健康。再查 `container_last_seen`，若没有容器数据，继续看 cAdvisor 日志和主机适配。

## 在 Grafana 画第一张图

浏览器打开 `http://localhost:3001`，首次默认管理员登录后按提示立即改密码。示例只绑定本机端口。实验文件已为 Grafana 配置 Prometheus 数据源，URL 是 `http://prometheus:9090`；Grafana 自己在容器里，写 localhost 会指向 Grafana 容器本身。

进入 Dashboards → New dashboard → Add visualization，选 Prometheus。先画内存：

~~~promql
container_memory_working_set_bytes{container_label_com_docker_compose_service="web"}
~~~

单位设置 bytes。再添加 CPU 曲线：

~~~promql
rate(container_cpu_usage_seconds_total{container_label_com_docker_compose_service="web"}[1m])
~~~

这个结果近似使用了多少 CPU 核，乘 100 才是相对于一个核的百分比；不是整台多核机器占比。不同运行环境下标签可能不同，先查询 `container_memory_working_set_bytes` 查看实际标签，别把“标签筛不到”误判成“内存为零”。

## 发一段请求，观察曲线变化

~~~bash
for i in $(seq 1 200); do curl -fsS http://localhost:8092/ >/dev/null; done
docker compose logs --tail 5 web
~~~

应看到访问日志，等一个抓取间隔后再看图。两百次请求可能很轻，CPU 曲线不明显也是正常的；不能为了制造好看的峰值就对非实验环境无限压测。

接着停止 web：

~~~bash
docker compose stop web
docker compose ps
docker compose start web
~~~

观察指标是否消失或停止更新，再恢复。cAdvisor 的 up 可能仍是 1，因为采集器没坏。业务可用性需要单独检查 HTTP、错误率与延迟，不能只用采集器存活做告警。

## 没数据时按这条顺序查

Targets DOWN 先查 cadvisor 容器和抓取地址；Targets UP 但没有容器指标，查 cAdvisor 对当前 Docker/cgroups 的兼容、数据目录与设备权限；Prometheus 有值而 Grafana 无数据，查数据源、时间范围和标签条件。

长期使用还要设置保留时间、磁盘容量、告警联系人和处理动作。日志、指标、请求追踪回答的问题不同，一张 CPU 图无法解释所有业务失败。

~~~bash
docker compose down
~~~

保留 prometheus-data、grafana-data 卷可保存历史和面板；确认只需一次性实验时才加 `-v`。本课没有把高权限采集器部署到你的电脑，配置文件只有在你执行 up 后才生效。

## 继续阅读

- [命令与配置说明](https://github.com/google/cadvisor)
- [进一步了解相关机制](https://prometheus.io/docs/introduction/overview/)
