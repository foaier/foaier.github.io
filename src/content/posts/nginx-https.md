---
title: Nginx 07：HTTPS 从本地证书练起，再看正式证书怎么续期
date: '2026-11-25'
summary: 完成 TLS 监听、证书校验和 HTTP 跳转，分清加密、身份验证与后端连接。
series: Nginx 从入门到实战
order: 7
tags: [Nginx, HTTPS, TLS]
level: 网站部署
prerequisites: [nginx-static-performance]
goals:
  - 配置 TLS 证书并用 curl 正确验证。
  - 区分本地自签证书与公网可信证书。
  - 理解域名、证书链、续期和 HTTP 到 HTTPS 跳转。
---

HTTPS 不只是地址前多一个锁。它主要解决两件事：传输内容被加密，以及客户端能验证自己连接的站点身份。只做到加密、却忽略身份校验，仍可能把数据交给错误的一方。

先在本机练会配置。使用自签证书，不买域名、不改公网 DNS，也能观察 TLS 是怎样工作的。

## 本地证书从哪里来

第一课的 `init.sh` 已在 `certs/` 生成证书和私钥，命令是：

```bash
openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
  -keyout certs/localhost.key -out certs/localhost.crt \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
```

已经生成就不用再执行。`-x509` 直接生成自签证书，`-newkey` 新建私钥，`-days` 指定有效期，SAN 声明证书适用的名称和地址。现代客户端检查 SAN，不能只依靠 CN。

`-nodes` 让私钥不加密码，方便 Nginx 无人值守启动；这意味着文件访问权限尤其重要。私钥只保留在本地，实验包和 Git 都不会收录生成的 `certs/`。生产应通过受控证书流程和文件权限管理私钥，不要把它贴进文章或放进前端目录。

## 配置 HTTPS 监听

```bash
bash lesson.sh 07-https
```

配置中的关键部分如下：

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name localhost;
    ssl_certificate /etc/nginx/certs/localhost.crt;
    ssl_certificate_key /etc/nginx/certs/localhost.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    root /srv/site;
    location / { try_files $uri $uri/ =404; }
}
```

`http2 on` 需要 Nginx 1.25.1 或更新版本；本系列实验镜像满足这个条件。若系统仓库安装的是旧版，应查对应版本文档，不要把新旧语法混写。

容器监听 443，主机映射 8443。证书里的 localhost 与访问名一致，路径则必须是容器能读取的文件路径。证书、私钥不配对，`nginx -t` 就会报错。

## 验证证书，不要直接养成 -k 的习惯

先尝试：

```bash
curl -I https://localhost:8443/
```

通常会因证书不受信任而失败，这是预期结果。自签证书没有经过客户端默认信任的 CA 签发。

明确告诉 curl 本次信任哪张证书：

```bash
curl --cacert certs/localhost.crt -I https://localhost:8443/
curl --cacert certs/localhost.crt -sS https://localhost:8443/api/whoami
openssl x509 -in certs/localhost.crt -noout -subject -dates -ext subjectAltName
```

第一条应返回 200，第二条 JSON 中的 `forwardedProto` 应为 `https`。`--cacert` 仍进行名称和证书验证；`-k` 则跳过验证。临时定位问题可以知道有 `-k`，但它不能作为“HTTPS 配置正确”的验收证据。

浏览器可能仍显示自签警告。curl 单次信任与操作系统、浏览器信任库不是同一个设置；实验不要求把自签证书永久加入系统。

## HTTP 到 HTTPS 跳转为什么写死域名

本课另一个 server：

```nginx
server {
    listen 80 default_server;
    server_name localhost;
    return 308 https://localhost:8443$request_uri;
}
```

```bash
curl -I 'http://localhost:8088/app/orders?id=7'
```

应得到 308，Location 保留路径和查询参数。308 保留请求方法和请求体；301/302 的历史客户端行为有差异。真实服务迁移时，要确认调用方能处理跳转，尤其不要让带敏感数据的客户端先发送明文请求，再指望重定向补救。

公网部署应使用你控制的实际域名和默认 443，例如 `https://blog.example.com$request_uri`。实验里的 localhost、8443 不应搬到线上。固定规范域名也能避免把未验证的 Host 原样拼进跳转地址。

## 正式域名与证书，怎么接上去

正式部署至少要具备：你能控制的域名、正确的 DNS 解析、可达的入口端口，以及能够证明域名控制权的证书申请方式。

以 Ubuntu 虚拟机和 Certbot 的 Nginx 插件为例，先在 DNS 中把真实域名指向这台入口，并让 80、443 按需可达。再按当前 Certbot 官方安装方法安装工具，执行：

```bash
# 仅在准备好域名的 Linux 入口机器上执行，不是在本课容器内。
# 把 blog.example.com 换成你实际控制的域名。
sudo certbot --nginx -d blog.example.com
sudo certbot renew --dry-run
```

HTTP-01 通常需要 CA 从公网访问 80 端口的验证路径；DNS-01 通过 DNS TXT 记录验证，适合某些无公网 HTTP 入口或通配符场景。DNS API 凭证需要单独保护，不能写进仓库。

证书文件通常分为完整证书链和私钥。Nginx 的 `ssl_certificate` 应指向包含必要中间证书的链文件。续期要自动运行，成功后也要让 Nginx reload 读取新文件；“磁盘上更新了”不代表 worker 已经使用。Certbot 插件和定时任务的具体安排要检查实际安装结果，并做续期演练。

## 入口 HTTPS，不代表到后端也加密了

本实验是浏览器到 Nginx 使用 TLS，Nginx 到同一实验网络的后端使用 HTTP。这叫 TLS 终止在入口。

后端位于不可信网络，或部署要求内部链路也加密时，需要再配置上游 HTTPS，包括服务器名称与证书验证。只把 `proxy_pass http://...` 改成 `https://...`，还要确认 `proxy_ssl_verify`、信任 CA、SNI 等设置，不能默认认为身份已经验证。

HSTS 会让浏览器在后续访问时强制使用 HTTPS，适合已经稳定提供 HTTPS 的正式域名。实验不启用它；正式启用前确认所有需要覆盖的子域也已准备好，不要顺手复制一个很长的 max-age 和 includeSubDomains。

## 继续阅读

- [Nginx HTTPS 配置](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Let's Encrypt 验证方式](https://letsencrypt.org/docs/challenge-types/)
- [Certbot 安装与操作说明](https://certbot.eff.org/instructions)
