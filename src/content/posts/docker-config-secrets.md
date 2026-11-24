---
title: 配置怎么进容器：环境变量、env 文件与文件型密码
date: '2026-11-24'
summary: 修改同一个镜像的首页文案，再验证 MySQL 的密码文件配置。
series: Docker 与 Kubernetes
order: 16
tags:
  - Docker
  - Docker 实战
level: Docker 实战
prerequisites:
  - docker-production-image
goals:
  - 正确注入配置，理解重建容器与数据库改密的差别。
---
同一个镜像，开发环境说 hello，测试环境说 welcome，不应该为这点差异重新改源码打包。运行配置可以在创建容器时传入；密码也属于配置，但保存和分发方式需要更谨慎。

准备：已经构建 `foaier-java:lesson`，使用本机 Bash。只改首页文案，不需要运行数据库。

## -e：把一个值传给程序

~~~bash
docker run --name config-note -d -p 127.0.0.1:8089:8080 \
  -e DEMO_MESSAGE=hello-from-environment foaier-java:lesson
docker logs --tail 20 config-note
curl http://localhost:8089/
~~~

等应用启动后，首页 message 应变成 hello-from-environment。Docker 只是把变量放进进程环境，真正读取它的是 application.properties 的 `demo.message=${DEMO_MESSAGE:hello-docker}`。其他软件不一定认识这个名字。

`-e KEY=value` 中有空格时给整体加引号，例如 `-e 'DEMO_MESSAGE=hello learner'`。Java 代码不会因为变量名叫某个名字就自动生效，要有对应配置读取逻辑。

## env 文件让参数不挤成一长行

~~~bash
mkdir -p ~/docker-practice/config
cd ~/docker-practice/config
cat > demo.env <<'EOF'
DEMO_MESSAGE=loaded-from-file
EOF
docker rm -f config-note
docker run --name config-note -d -p 127.0.0.1:8089:8080 \
  --env-file ./demo.env foaier-java:lesson
~~~

等日志显示启动完成后再请求首页，应读到 loaded-from-file。env 文件每行写 KEY=value，不是 shell 脚本，不需要 export；复杂的引号和替换规则不要按 Bash 想当然处理。

改 demo.env 后只执行 restart，已有容器环境不会重新按 run 参数创建。应重建容器或使用应用自己支持的配置刷新能力。

## ARG、ENV、运行变量分别在哪生效

| 方式 | 谁用 | 何时设置 | 适合什么 |
|---|---|---|---|
| Dockerfile ARG | 构建步骤 | `build --build-arg` | 非秘密构建选项 |
| Dockerfile ENV | 后续构建和运行环境 | 构建镜像时 | 镜像默认值 |
| `run -e` / `--env-file` | 容器进程 | 创建容器时 | 环境差异与运行配置 |
| 挂载配置文件 | 能读取文件的应用 | 启动/应用重载时 | 多行配置、文件型凭据 |

不应该把生产密码写进 Dockerfile，再指望后面 RUN rm 删除干净。历史层和构建记录仍可能留下内容。构建确实需要令牌时使用 BuildKit secret mount 等专门机制，并确保命令不把值写进产物或日志。

## 文件型秘密不是“随便挂上就会读”

MySQL 官方镜像支持 `MYSQL_ROOT_PASSWORD_FILE`，可以从挂载文件读取初始化密码；Spring Boot 示例当前读取的是 DB_PASSWORD 环境变量，并没有自动实现 `_FILE` 约定。

下面是一个**独立的本机 MySQL 实验**，仍在本节目录执行，文件不进 Git：

~~~bash
printf 'local-file-password' > mysql-password.txt
chmod 600 mysql-password.txt
docker volume create secret-mysql-data
docker run --name secret-mysql -d \
  --mount type=bind,source="$PWD/mysql-password.txt",target=/run/secrets/mysql-password,readonly \
  --mount source=secret-mysql-data,target=/var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD_FILE=/run/secrets/mysql-password mysql:8.4
docker logs --tail 30 secret-mysql
~~~

等初始化完成后 `docker exec -it secret-mysql mysql -uroot -p`，输入文件中的教学密码可以登录。这里没有发布主机端口，练习通过 exec 进入。密码文件更新不会自动改掉已初始化的数据库账户密码。

## 配置出错怎么验证、怎么收尾

可以用 `docker exec config-note printenv DEMO_MESSAGE` 查看非秘密变量。不要把完整 inspect/config 输出直接贴到公开问题里，它们可能包含密码。线上应从部署平台受保护的配置注入，并限制能操作 Docker 的人。

~~~bash
docker rm -f config-note
docker stop secret-mysql
docker rm secret-mysql
~~~

本机文件与 secret-mysql-data 卷仍保留。确认没有需要的数据后再单独删卷和密码文件。轮换真实密码至少包含数据库改密、应用更新、连接恢复验证和旧凭据失效，不能只改一个 env 文本就结束。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/reference/cli/docker/container/run/)
- [进一步了解相关机制](https://docs.docker.com/build/building/secrets/)
