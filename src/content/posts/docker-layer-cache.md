---
title: 镜像分层与搬运：commit、save/load、export/import 怎么选
date: '2026-11-24'
summary: 修改一份网页，观察可写层，再分别保存镜像和容器文件系统。
series: Docker 与 Kubernetes
order: 6
tags:
  - Docker
  - Docker 入门
level: Docker 入门
prerequisites:
  - docker-debug
goals:
  - 验证容器改动隔离，正确选择镜像归档与数据备份方式。
---
你在容器里新建了文件，另一个由同一镜像启动的容器能看到吗？不能。镜像层只读，每个容器上面还有自己的可写层。这一课通过修改网页来观察它，再区分 commit、save/load 和 export/import。

准备：Bash、Docker。新建目录 `~/docker-practice/layers`，以下命令全部在这里执行。镜像标签是实验名字，清理时只删本节对象。

## 同一份镜像，两个独立的容器

~~~bash
mkdir -p ~/docker-practice/layers
cd ~/docker-practice/layers
docker run --name layer-a -d nginx:stable-alpine
docker run --name layer-b -d nginx:stable-alpine
docker exec layer-a sh -c 'echo layer-a-only > /usr/share/nginx/html/index.html'
docker exec layer-a cat /usr/share/nginx/html/index.html
docker exec layer-b head -n 3 /usr/share/nginx/html/index.html
~~~

a 输出 `layer-a-only`，b 仍是原来的 HTML。修改发生在 a 的可写层，并没有把基础镜像改掉。

~~~bash
docker diff layer-a
docker image history nginx:stable-alpine
~~~

diff 的 A、C、D 分别表示新增、修改、删除；你应找到 index.html 的变化。history 能看到镜像构建记录。层共享的是文件内容，不意味着多个容器共用一份可随便修改的运行内存。

## commit：把这次改动做成新镜像

~~~bash
docker commit -m 'replace demo homepage' -a foaier layer-a lesson-nginx:committed
docker run --name layer-c -d -p 127.0.0.1:8083:80 lesson-nginx:committed
curl http://localhost:8083
~~~

c 的首页也显示 `layer-a-only`，说明新镜像带上了 a 的文件改动。commit 默认会短暂暂停容器来减少文件变化，但它不能保证数据库备份的一致性；挂载卷里的内容也不会被打进这个镜像。

commit 适合演示和临时留样。实际项目应把操作写进 Dockerfile，否则别人不知道你进容器执行过哪些命令，也无法可靠重建。后面的 Dockerfile 课会把这次改网页变成可复现文件。

## save/load：带走完整镜像

~~~bash
docker image save -o lesson-nginx.tar lesson-nginx:committed
docker image load -i lesson-nginx.tar
docker image ls lesson-nginx
~~~

save 输出镜像归档，包含镜像配置和层；load 读取这类归档。把文件复制到另一台 Docker 电脑，再执行 load 即可，不必搭镜像仓库。这里在同一台电脑验证，所以提示已存在也正常。

使用 `-o`、`-i` 直接读写文件，避免某些终端把二进制流重定向时改坏。镜像里若带凭据，归档里也会有，不要把它当成脱敏文件。

## export/import：拿的是容器文件系统

~~~bash
docker export -o layer-a-rootfs.tar layer-a
docker import layer-a-rootfs.tar lesson-rootfs:imported
docker image inspect lesson-rootfs:imported --format 'cmd={{json .Config.Cmd}}'
docker run --rm lesson-rootfs:imported cat /usr/share/nginx/html/index.html
~~~

最后仍能读到改过的文件，但导入镜像不会自动保留原镜像的启动命令、端口说明和层历史。运行它时要明确提供命令。挂载卷的内容同样不在 export 里，因此它不是数据库迁移工具。

| 目的 | 选什么 | 保留什么 |
|---|---|---|
| 把容器文件改动留成镜像 | commit | 文件改动及部分容器配置，排除挂载数据 |
| 离线搬镜像 | save → load | 镜像层、配置和标签信息 |
| 获取容器根文件系统 | export → import | 文件内容，不能当完整镜像备份 |
| 备份数据库 | 数据库导出或受支持的备份工具 | 一致的数据与恢复过程 |

## 看空间，再清理自己的对象

~~~bash
docker system df
docker image ls --filter dangling=true
docker rm -f layer-a layer-b layer-c
docker image rm lesson-nginx:committed lesson-rootfs:imported
~~~

tar 文件保留在本课目录，需要时手工删除。不要把镜像 SIZE 相加当作磁盘使用量，因为多个镜像可能共用层。构建缓存如何复用、代码怎么改才不重复下载依赖，会在[构建上下文与缓存](/articles/docker-build-context/)里继续练。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/reference/cli/docker/container/commit/)
- [进一步了解相关机制](https://docs.docker.com/reference/cli/docker/image/save/)
