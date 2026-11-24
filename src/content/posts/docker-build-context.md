---
title: 构建上下文与缓存：最后的点、COPY 和 .dockerignore
date: '2026-11-24'
summary: 故意在错误目录构建，修复后观察 CACHED 与代码变化。
series: Docker 与 Kubernetes
order: 14
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - dockerfile-first
goals:
  - 解释文件路径和缓存失效，排除不该打包的文件。
---
`docker build -t web:v1 .` 最后的点很容易被当成标点，其实它在决定 Docker 能读哪些本地文件。这个目录叫构建上下文。Dockerfile 放在哪，和 COPY 能从哪取文件，是两个相关但不同的问题。

这节建立独立实验目录，故意让一次 COPY 失败，再用构建日志观察缓存。使用本机 Bash，不需要运行服务。

## 先看目录边界

~~~bash
mkdir -p ~/docker-practice/context/site
cd ~/docker-practice/context
printf 'context lesson\n' > site/index.html
cat > Dockerfile <<'EOF'
FROM alpine:3.22
WORKDIR /app
COPY site/index.html ./index.html
CMD ["cat", "/app/index.html"]
EOF
docker build --progress=plain -t context-note:v1 .
docker run --rm context-note:v1
~~~

应输出 context lesson。COPY 的源路径 `site/index.html` 从构建上下文根目录算；目标 `./index.html` 从容器里的 WORKDIR `/app` 算。左边和右边不是同一个文件系统。

## 换一个点的位置，观察失败

~~~bash
cd site
docker build -f ../Dockerfile -t context-note:wrong .
~~~

这次应失败，因为上下文变成 site 目录，里面没有 `site/index.html` 这个相对路径。`-f ../Dockerfile` 只选择配方，不会把上下文也改回上一级。回到父目录恢复：

~~~bash
cd ..
docker build -f Dockerfile -t context-note:v1 .
~~~

这也是很多“文件明明在，COPY 却找不到”的原因。COPY `../secret` 不能用来随意越过上下文边界，Docker 不会让一份配方读取电脑上的任意路径。

## .dockerignore：哪些文件不交给构建

在 context 目录创建：

~~~bash
cat > .dockerignore <<'EOF'
.git
.env
*.log
target
node_modules
EOF
docker build --progress=plain -t context-note:v1 .
~~~

作用类似“打包前的排除清单”，可以减少传输，也能减少误把源码仓库、密钥和编译产物复制进镜像的机会。不要误排除真正要 COPY 的文件。

试着把 `site` 加进去再构建，应该失败；删掉这一条后恢复。不要把真实密码拿来做实验，写一个假的 `.env` 文件就够了。

## 相同输入再次构建，会复用缓存

~~~bash
docker build --progress=plain -t context-note:v2 .
printf 'changed page\n' > site/index.html
docker build --progress=plain -t context-note:v3 .
docker run --rm context-note:v3
~~~

第一次相同输入通常能看到 CACHED；修改文件后，相关 COPY 及依赖它的后续步骤要重新执行，容器应输出 changed page。BuildKit 日志里的进度编号不是永久固定的，不要只盯某一个步骤数字。

Java 项目常先 COPY pom.xml、下载依赖，再 COPY src、编译应用。这样只改业务源码时，下载依赖这一层更容易复用；先 COPY 整个项目再下载依赖，则一个源码改动也可能使这一步失去缓存。

## 缓存不等于永远不更新

| 参数或做法 | 解决什么 | 代价 |
|---|---|---|
| 默认缓存 | 相同输入复用以前步骤 | 必须安排基础镜像与依赖更新 |
| `--no-cache` | 不复用构建步骤缓存 | 耗时更长，不自动保证拉新基础镜像 |
| `--pull` | 检查基础镜像更新 | 网络与仓库可用性成为条件 |
| 固定依赖版本 | 减少不可解释的变化 | 仍需主动升级和修复漏洞 |

~~~bash
docker build --pull --no-cache -t context-note:clean .
docker image history context-note:clean
docker system df
~~~

不要把“所有构建都加 --no-cache”当成标准答案，它会掩盖文件排列不合理的问题。RUN 下载地址对应的远程内容变化，也不一定自动让已有缓存失效。

## 多出来的镜像怎样收尾

先列出本节标签，确认只删除自己的实验结果：

~~~bash
docker image ls context-note
docker image rm context-note:v1 context-note:v2 context-note:v3 context-note:clean
~~~

共享层可能不会立即释放，构建缓存也可能仍在，这是不同对象。`docker builder prune` 会影响当前构建器的其他项目缓存，先看占用和需求，不要在教程里顺手全局清空。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/build/concepts/context/)
- [进一步了解相关机制](https://docs.docker.com/build/cache/)
