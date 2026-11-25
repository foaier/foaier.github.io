---
title: Nginx 03：location、root、alias 和前端刷新 404，一次讲清楚
date: '2026-11-25'
summary: 用具体 URL 推导文件路径，验证精确匹配、前缀、正则和 React 路由回退。
series: Nginx 从入门到实战
order: 3
tags: [Nginx, 静态网站, React]
level: 配置实战
prerequisites: [nginx-config]
goals:
  - 根据请求 URI 判断匹配哪个 location。
  - 根据 root 或 alias 算出实际读取的文件。
  - 配置前端路由回退，同时让缺失的 JS 返回真实 404。
---

网站首页能打开，点进订单详情也正常，按一下刷新却出现 404。这往往不是 React 打包坏了，而是浏览器刷新时把 `/orders/42` 交给了 Nginx。Nginx 去磁盘找同名文件，当然找不到。

处理这个问题之前，要先分清两件事：**请求匹配哪段配置，配置又去哪里找文件。**

## 先加载本课的完整例子

在 `nginx-labs` 目录执行：

```bash
bash lesson.sh 03-location
curl -i http://localhost:8088/healthz
curl -i http://localhost:8088/files/guide.txt
curl -i http://localhost:8088/other.txt
```

依次应看到 `ok`、说明 alias 路径的文件内容、`regex location`。这三个返回结果正好对应三种不同的路径匹配方式。

## location 匹配的是 URI 路径

对地址 `http://localhost:8088/files/guide.txt?download=1`，这里参与匹配的是 `/files/guide.txt`，不是域名，也不是 `?download=1`。查询参数要通过 `$args` 等变量另行处理。

先掌握没有嵌套 location 的常见规则：

1. 找到 `location = /某路径` 的精确匹配，直接使用它。
2. 在普通前缀中找到最长匹配。它若带 `^~`，就使用这个前缀，不再尝试正则。
3. 否则按配置中的先后顺序检查 `~`、`~*` 正则，第一条命中的正则生效。
4. 正则都没命中，使用之前记住的最长前缀。

`~` 区分大小写，`~*` 不区分。普通前缀之间靠长度决定，不是“谁写前面谁赢”。复杂嵌套和内部重定向会增加查找过程，入门阶段先保持同级、明确的规则。

```nginx
location = /healthz { return 200 "ok\n"; }
location ^~ /files/ { alias /srv/downloads/; }
location ~ \.txt$ { return 200 "regex location\n"; }
location / { try_files $uri $uri/ =404; }
```

`/files/guide.txt` 虽然以 `.txt` 结尾，但最长前缀 `/files/` 带了 `^~`，所以不会被下面的正则抢走。`/other.txt` 则走正则。

现在复制一份 `lessons/03-location.conf` 作备份，把 `/files/` 前的 `^~` 去掉，重新运行 `bash lesson.sh 03-location`。再请求 `guide.txt`，结果会变成 `regex location`。看完恢复原文件并重新加载，这就是一个可复现的匹配冲突。

## root 是拼上路径，alias 是替换前缀

假设配置是：

```nginx
location /assets/ {
    root /srv/site;
}
location /files/ {
    alias /srv/downloads/;
}
```

| 请求 | 计算方式 | 实际文件 |
|---|---|---|
| `/assets/app.v1.css` | root + 完整 URI | `/srv/site/assets/app.v1.css` |
| `/files/guide.txt` | alias + 去掉 `/files/` 后的部分 | `/srv/downloads/guide.txt` |

把 alias 例子改成 `root /srv/downloads;`，Nginx 会找 `/srv/downloads/files/guide.txt`，多出一层 `files`。很多“文件明明在，为什么 404”就出在这里。

目录型 alias 让 location 与 alias 都保留尾部 `/`，路径关系最直观。正则 location 中使用 alias 还有捕获组要求，先不要把两种复杂写法混在一起。

可以直接核对容器里的文件：

```bash
docker compose exec gateway ls -l /srv/site/assets/
docker compose exec gateway ls -l /srv/downloads/guide.txt
docker compose logs --tail 15 gateway
```

检查的是容器里的 `/srv/...`，不是在宿主机上猜同名路径。它们通过 Compose 的只读挂载对应到实验源码。

## try_files 为什么能解决前端刷新 404

本课只给 `/app/` 开启前端回退：

```nginx
location /app/ {
    try_files $uri /index.html;
}
location ^~ /assets/ {
    try_files $uri =404;
}
```

第一段先检查真实文件，不存在时内部转到 `/index.html`，返回前端入口。浏览器地址栏仍保留 `/app/orders/42`，前端程序随后根据路径决定显示什么。

实验网页会把当前路径显示出来，帮助你看见这个区别。真实 React 项目则由 React Router 等前端路由处理。

```bash
curl -i http://localhost:8088/app/orders/42
curl -i http://localhost:8088/assets/no-such-file.js
```

前者是 200 和 HTML；后者必须是 404。缺失的 JS 如果也回退到 HTML，浏览器常报 `Unexpected token '<'` 或 MIME 类型错误。回退得“太成功”，反而把真正的问题藏起来了。

## 重定向与内部回退不要混用

配置里还有：

```nginx
location = /old {
    return 302 /app/;
}
```

执行 `curl -i http://localhost:8088/old` 会得到 302 和 `Location` 响应头。浏览器会另外发一次请求，地址栏也会变化。`try_files` 的回退在服务器内部完成，不要求浏览器重新请求。

确实需要改写转发路径时，还会遇到 `rewrite`。`last` 会重新寻找 location，`break` 通常留在当前 location 继续处理。它们不是随意替换的关键字；规则相互跳回去时会产生内部重定向循环。能用明确的 `return`、`try_files` 或 `proxy_pass` 路径替换完成的需求，先用这些更容易推导的方式。

## 403 也可能是目录问题

访问一个真实目录，但目录里没有首页、又没有打开目录列表，可能得到 403。不要看到 403 就执行 `chmod -R 777`。先确认请求落到哪个目录、有没有 `index.html`，再检查运行用户能否穿过父目录并读取文件。

实验关闭 `autoindex`，防止把目录内容直接列出来。生产通常也不应该为了消除 403 就开启整个网站的目录浏览。

练习：新建 `downloads/manual.txt`，通过 `/files/manual.txt` 访问。再故意把 alias 指向一个不存在的目录，结合日志说明 Nginx 到底找了哪个文件。

## 继续阅读

- [location、root、alias 与 try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html)
- [return 与 rewrite 的处理规则](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
