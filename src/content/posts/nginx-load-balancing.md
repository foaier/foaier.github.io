---
title: Nginx 05：负载均衡怎么分流？停掉一个后端看看
date: '2026-11-25'
summary: 实测轮询、权重与故障转移，分清连接复用、会话共享和入口高可用。
series: Nginx 从入门到实战
order: 5
tags: [Nginx, 负载均衡, 故障转移]
level: 代理实战
prerequisites: [nginx-reverse-proxy]
goals:
  - 让同一个接口请求落到两个后端节点。
  - 调整权重并观察分配结果。
  - 停止一个后端，验证被动故障检测与重试。
---

只有一个后端时，所有请求都去同一个进程。加第二个后端后，总得有一层决定“这次给 A，还是给 B”。Nginx 的 `upstream` 就是把这些后端组织成一个组，再选择其中一台。

两个节点必须提供相同的业务能力。把订单服务和支付服务放在同一个 upstream 轮流分配，不叫负载均衡，那会让同一个接口一会儿存在、一会儿不存在。

## 用返回内容看清请求去了哪里

```bash
bash lesson.sh 05-balance
for i in $(seq 1 10); do
  curl -sS http://localhost:8088/api/whoami
done
```

返回的 `node` 应同时出现 `backend-a` 和 `backend-b`。不要靠浏览器连续刷新来判断，它可能缓存结果，也不方便统计。

本课的 upstream 放在 `http` 层，和 `server` 同级：

```nginx
upstream course_pool {
    zone course_pool 64k;
    resolver 127.0.0.11 valid=10s ipv6=off;
    server backend-a:3000 resolve weight=1 max_fails=1 fail_timeout=5s;
    server backend-b:3000 resolve weight=1 max_fails=1 fail_timeout=5s;
    keepalive 16;
}
```

代理位置改成 `proxy_pass http://course_pool/;`。前一课是一个具体主机，现在是一个后端组的名字，URI 替换规则仍然适用。

`zone` 让多个 worker 共享这组后端的运行状态。实验使用 Docker 内置 DNS `127.0.0.11`，配合 `resolve` 跟踪容器地址变化。这个地址只适用于 Docker 容器网络，搬到虚拟机上必须换成那里的 DNS。开源 Nginx 的这类动态解析能力需要兼容版本；本实验要求 Nginx 1.28 或更新版本，老包不支持时不要只删掉报错指令后假装行为相同。

## 常见策略，各自解决什么问题

| 策略 | 分配依据 | 更适合什么情况 |
|---|---|---|
| 默认加权轮询 | 按权重分配请求 | 后端能力接近、请求耗时相近 |
| `weight=3` 与 `weight=1` | 大约按 3:1 分配 | 两台机器承载能力不同 |
| `least_conn` | 优先活动连接较少的后端，同时考虑权重 | 请求持续时间差异较大 |
| `ip_hash` | 根据客户端地址固定选择 | 临时需要一定粘性的场景 |
| `backup` | 主节点都不可用时才启用 | 备用容量 |
| `down` | 管理员明确标记不可用 | 维护时摘除节点 |

策略不是随便叠加的，例如 `backup` 不能直接和 `ip_hash` 一起使用。`least_conn` 也不是“自动寻找 CPU 最空闲的机器”，Nginx 并没有因此知道后端 CPU 和数据库压力。

做一次权重实验：把文件中 A 的 `weight=1` 改为 `weight=3`，重新执行 `bash lesson.sh 05-balance`。发 40 次请求统计节点：

```bash
for i in $(seq 1 40); do
  curl -sS http://localhost:8088/api/whoami
done | sed -n 's/.*"node":"\([^"]*\)".*/\1/p' | sort | uniq -c
```

应看到 A 明显多于 B，接近 3:1。小样本、失败重试、连接和并发状态都会影响观察，不要求每连续四次都精确按某个固定顺序出现。实验后把权重恢复为 1。

## 真实停掉 A，看看还能不能访问

```bash
docker compose stop backend-a
for i in $(seq 1 6); do
  curl -sS -w ' HTTP=%{http_code}\n' http://localhost:8088/api/whoami
done
docker compose logs --tail 20 gateway
docker compose start backend-a
```

在本课配置下，应继续得到 200，成功响应来自 B。日志可能记录先连 A 失败、再向 B 重试的过程。

关键配置是：

```nginx
proxy_connect_timeout 1s;
proxy_read_timeout 5s;
proxy_next_upstream error timeout http_502 http_503 http_504;
proxy_next_upstream_tries 2;
```

`max_fails=1 fail_timeout=5s` 表示在这个观察窗口里达到失败次数后，暂时把节点视为不可用；这个时长也用于暂时摘除周期。`proxy_next_upstream` 决定哪些情况允许换下一台，且只能在还来得及安全发送响应的阶段重试。

这是**被动故障检测**：先有真实请求失败，才获得节点异常的证据。它不等于每秒主动调用 `/health`。开源版与商业版、第三方模块的主动健康检查能力要分别确认，不能看到示例里的 `health_check` 就认为任何安装包都支持。

## 读请求能重试，下单请求不能随意重放

GET 查询通常适合故障重试。付款、下单等非幂等操作则要谨慎：后端可能已经处理完成，只是响应没送回来。再发一遍可能执行两次。

Nginx 默认对已经发送到上游的非幂等请求有重试限制，不要为了“提高成功率”随意打开 `non_idempotent`。业务需要重试时，先实现幂等键、唯一约束或请求去重，再定义重试边界。代理参数不能代替业务正确性。

## keepalive、Keepalived、Session 是三件事

upstream 中的 `keepalive 16` 是每个 worker 为这个组保留的空闲上游连接上限，不是后端总连接数上限，也不是健康检查。复用连接可以减少反复建连的开销，前一课的 HTTP/1.1 和 Connection 设置与它配合使用。

Keepalived 则是另一个 Linux 程序，后面用它处理“Nginx 入口机器本身坏了”的问题。

如果用户登录信息只放在 A 的内存里，请求被分到 B 后就可能掉登录。`ip_hash` 只能缓解部分粘性需求，NAT 用户可能全压在一台上，节点变化时也不保证会话不受影响。正式应用通常用共享会话存储或经过验证的无状态认证方案。

最后确认 A 已恢复，再继续下一课。不要把自己刚停掉的后端忘在实验里，下一篇的 502 可能只是上篇没清场。

## 继续阅读

- [upstream、分配策略与 keepalive](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
- [上游失败重试规则](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_next_upstream)
- [HTTP 负载均衡说明](https://nginx.org/en/docs/http/load_balancing.html)
