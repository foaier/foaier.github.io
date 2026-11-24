---
title: 写第一个 Dockerfile：把自己的网页做成镜像
date: '2026-11-24'
summary: 用两个文件完成 build 和 run，再实验 ENTRYPOINT 与 CMD。
series: Docker 与 Kubernetes
order: 13
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - docker-network
goals:
  - 独立构建网页镜像，解释构建与运行时指令。
---
前面用过别人做好的镜像，也用 commit 保存过临时改动。现在自己写一份 Dockerfile：告诉 Docker 选什么基础环境、复制哪些文件、容器启动时运行什么。目标很具体：把一份自己的 HTML 做成镜像，换个容器启动后仍能看到它。

准备：Docker 和 Bash，不需要 Java、.NET 或前端框架。文件只放在本节新建目录，不修改其他项目。

## 建一个只有两个文件的项目

~~~bash
mkdir -p ~/docker-practice/first-image
cd ~/docker-practice/first-image
cat > index.html <<'EOF'
<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>我的第一个镜像</title>
<h1>这个网页是我打包的</h1>
<p>版本：v1</p>
</html>
EOF
cat > Dockerfile <<'EOF'
FROM nginx:stable-alpine
COPY index.html /usr/share/nginx/html/index.html
EXPOSE 80
EOF
ls
~~~

ls 应看到 `Dockerfile` 和 `index.html`。Dockerfile 没有 `.txt` 后缀。基础镜像已经定义了启动 Nginx 的方式，所以这个最小文件不需要重复写 CMD。

## build 和 run 是两个不同动作

~~~bash
docker build -t foaier-web:v1 .
docker run --name first-image-web -d -p 127.0.0.1:8087:80 foaier-web:v1
curl http://localhost:8087
~~~

build 把文件加工成镜像；`-t` 给结果命名；最后的点指定当前目录作为构建输入。run 才创建容器并启动 Nginx。浏览器打开 `http://localhost:8087`，应显示“这个网页是我打包的”。

镜像构建完成不代表任何服务已启动。反过来，改了本地 HTML 也不会自动改变已经构建的镜像，这与前面的 bind mount 实验不同。

## 常用指令按发生时间来记

| 指令 | 做什么 | 示例或说明 |
|---|---|---|
| FROM | 选择基础镜像/开始构建阶段 | `FROM nginx:stable-alpine` |
| WORKDIR | 改后续命令的工作目录 | `WORKDIR /app`，目录不存在时创建 |
| COPY | 从构建输入复制文件 | `COPY index.html /目标路径` |
| RUN | 构建时执行 | 安装依赖、编译程序 |
| ENV | 保存环境变量 | `ENV APP_MODE=demo`，运行时仍可覆盖 |
| ARG | 接收构建参数 | 构建时使用，不适合密码 |
| USER | 指定后续进程身份 | 非 root 运行须配好文件权限 |
| EXPOSE | 记录端口说明 | 不等于 `-p` 发布端口 |
| ENTRYPOINT / CMD | 定义运行时程序和默认参数 | 不在 build 时启动服务 |
| LABEL | 镜像说明信息 | 替代旧的 MAINTAINER 指令 |

指令通常大写方便阅读；不要把“每一行都等于一个文件层”当成严格规则，ENV、CMD 等也可能只改变镜像元数据。普通文件复制优先 COPY，只有明确需要 ADD 的下载或解包能力时再用 ADD。

## 单独做个 ENTRYPOINT 和 CMD 小实验

在同目录创建第二份配方，不覆盖网页 Dockerfile：

~~~bash
cat > Dockerfile.echo <<'EOF'
FROM alpine:3.22
ENTRYPOINT ["echo"]
CMD ["hello"]
EOF
docker build -f Dockerfile.echo -t foaier-echo:v1 .
docker run --rm foaier-echo:v1
docker run --rm foaier-echo:v1 docker
docker run --rm --entrypoint sh foaier-echo:v1 -c 'echo replaced-entrypoint'
~~~

依次输出 hello、docker、replaced-entrypoint。第二次 run 的参数替换 CMD，保留 echo；第三次通过 `--entrypoint` 替换了入口。JSON 数组形式会直接启动指定程序，避免多一层 shell 带来的信号转发问题。

## 改网页，为什么刷新没变化

把 index.html 的 v1 改成 v2 后，先刷新旧网页：它仍是旧内容。要更新，构建新标签并新建容器：

~~~bash
sed 's/版本：v1/版本：v2/' index.html > index.next.html
mv index.next.html index.html
docker build -t foaier-web:v2 .
docker stop first-image-web
docker rm first-image-web
docker run --name first-image-web -d -p 127.0.0.1:8087:80 foaier-web:v2
curl http://localhost:8087
~~~

现在应看到 v2。线上发布会保留旧版本和验收过程，不是覆盖同一个 latest 后祈祷机器自动更新。

## 文件找不到和端口冲突如何修

COPY 报文件不存在，先 `pwd`、`ls`，确认点代表的目录里确实有 index.html，再看 `.dockerignore` 有没有忽略它。容器启动报端口冲突，调整映射左边的主机端口。build 失败看第一条具体错误，run 失败看日志，两者不是同一阶段。

~~~bash
docker logs --tail 20 first-image-web
docker rm -f first-image-web
docker image ls foaier-web
~~~

本节镜像与源码先保留，下一课继续观察缓存。临时 echo 镜像可用 `docker image rm foaier-echo:v1` 删除。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/reference/dockerfile/)
- [进一步了解相关机制](https://docs.docker.com/build/concepts/dockerfile/)
