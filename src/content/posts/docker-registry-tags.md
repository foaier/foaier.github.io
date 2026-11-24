---
title: 镜像仓库：本机 Registry 推拉一遍，再接远程仓库
date: '2026-11-24'
summary: 用自己的本地仓库练 tag、push、pull，解释命名、认证和版本。
series: Docker 与 Kubernetes
order: 7
tags:
  - Docker
  - Docker 入门
level: Docker 入门
prerequisites:
  - docker-layer-cache
goals:
  - 完成本机镜像推拉，能读懂远程仓库地址与标签。
---
镜像只放在本机，另一台服务器自然找不到。交付有两条路：用 save/load 搬文件，或者 push 到镜像仓库再 pull。这一课先在本机完成一次推送和拉取，再说明阿里云等远程仓库该替换哪些参数。

准备：Bash 和 Docker；任意目录可执行。我们把本机仓库绑定到 `127.0.0.1:5000`，只用于学习，不把没有认证的仓库暴露到公网。

## 仓库地址、命名空间、标签怎么读

~~~text
registry.example.com/team/web:1.0
└── 仓库服务地址 ──┘ └名称─┘ └标签┘
~~~

本机的 `web:1.0`、Docker Hub 的 `用户名/web:1.0`、企业仓库的完整地址，可能指向同一内容的不同名字。tag 只是命名，push 才上传。登录成功也只证明凭据可用，不证明你对某个命名空间有写权限。

## 起一个只允许本机访问的 Registry

~~~bash
docker volume create registry-data
docker run --name registry-lab -d \
  -p 127.0.0.1:5000:5000 \
  --mount source=registry-data,target=/var/lib/registry \
  registry:2
curl -i http://localhost:5000/v2/
~~~

应返回 `200 OK` 和空 JSON。卷挂到 `/var/lib/registry`，这是 registry:2 保存镜像内容的位置。这里先按命令使用命名卷，下一课会用实验解释它如何保留数据。

如果 5000 被占用，将两处 5000 中**左边的主机端口**改成 5001，并把后面的 `localhost:5000` 统一改为 5001。不要关闭其他项目的服务来腾端口。

## 打标签、推送、查询、重新拉取

~~~bash
docker pull nginx:stable-alpine
docker tag nginx:stable-alpine localhost:5000/lesson-web:v1
docker push localhost:5000/lesson-web:v1
curl http://localhost:5000/v2/_catalog
curl http://localhost:5000/v2/lesson-web/tags/list
~~~

catalog 应包含 `lesson-web`，tags 应包含 `v1`。push 末尾会显示 digest，记录它可以追踪实际发布内容。

~~~bash
docker image rm localhost:5000/lesson-web:v1
docker pull localhost:5000/lesson-web:v1
docker run --rm localhost:5000/lesson-web:v1 nginx -v
~~~

最后打印 Nginx 版本，说明镜像能从仓库取回来并执行。这里移除的是本地标签，不会删远端镜像，也不会删除原来的 nginx 标签。

## 阿里云等远程仓库的步骤相同

在容器镜像服务控制台创建命名空间和仓库，打开仓库的“访问凭证/操作指南”，拿到实际 Registry 地址。下面是**填写真实值后才执行**的模板，不能照搬 example.com：

~~~bash
REGISTRY=registry.example.com
NAMESPACE=your-namespace
REGISTRY_USER=your-account
docker login "$REGISTRY" --username "$REGISTRY_USER"
docker tag nginx:stable-alpine "$REGISTRY/$NAMESPACE/lesson-web:v1"
docker push "$REGISTRY/$NAMESPACE/lesson-web:v1"
docker logout "$REGISTRY"
~~~

login 会交互式询问密码或访问令牌，不要把真实密码写在文章、脚本或命令参数里。拉取方也需要自己的读权限。私有镜像可以放在云仓库，是否公开由权限配置决定，并非“云仓库一定公开”。

## 标签不等于发布记录

生产镜像可用版本号或提交号，如 `v1.2.3`、`sha-abc1234`；同名标签被覆盖时，旧服务器未必自动更新。更新必须明确 pull 新镜像、重建容器、检查应用，并保留回滚版本。

| 报错 | 优先检查 |
|---|---|
| denied / unauthorized | 登录账号、命名空间、推送权限 |
| manifest unknown | 完整名称和标签是否存在 |
| HTTP response to HTTPS client | 仓库协议和证书配置 |
| connection refused | Registry 是否运行、映射端口是否正确 |

localhost 仓库是本机 HTTP 实验。正式跨机器部署应配置 HTTPS 和认证，不要通过给任意地址加 insecure-registries 或关闭 TLS 校验来掩盖配置问题。

## 结束实验时留下什么

~~~bash
docker stop registry-lab
docker rm registry-lab
docker volume inspect registry-data
~~~

镜像数据仍在卷里。需要继续练就按前面的 run 命令重新挂同一卷；确认不再需要仓库内容时，才执行 `docker volume rm registry-data`。容器、镜像标签、仓库数据三者的生命周期不同。

## 继续阅读

- [命令与配置说明](https://distribution.github.io/distribution/about/deploying/)
- [进一步了解相关机制](https://docs.docker.com/reference/cli/docker/image/push/)
