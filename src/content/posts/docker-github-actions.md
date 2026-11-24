---
title: 让 GitHub Actions 自动构建和发布 Docker 镜像
date: '2026-11-24'
summary: 用代码提交触发 CI，编译 API、构建镜像，再发布带提交号的 GHCR 标签。
series: Docker 与 Kubernetes
order: 18
tags:
  - Docker 实战
  - Docker
  - Kubernetes
level: Docker 实战
prerequisites:
  - docker-registry-tags
goals:
  - 看懂仓库中的容器发布工作流，并从 Pull Request/主分支区分构建与发布。
---

本机 `docker build` 成功，不代表同事电脑上也能重现。把构建命令放进 GitHub Actions 后，每个 Pull Request 都能在干净 Runner 上重新编译和打镜像；合并到主分支才上传到仓库。CI 负责验证和产物，直接连生产服务器部署还要额外做好凭证与回滚设计。

## 从一次代码提交到一个镜像

`container-course.yml` 先 checkout，再安装 .NET 10、build API、设置 Buildx，然后用 metadata action 生成提交标签。Workflow 给 job `packages: write`，通过短期 `GITHUB_TOKEN` 登录 GHCR。Pull Request 的 `push` 为 false，只做构建；main 才上传镜像。没有把 SSH 私钥塞进仓库，也没有未经确认改你的服务器。

## 对照工作流检查构建输入

在[仓库里查看完整 workflow](https://github.com/foaier/foaier.github.io/blob/main/.github/workflows/container-course.yml)，对照触发条件、权限、登录、tag 和 build-push。只有整站根目录 README 的更改不会触发它，`examples/container-course/` 下的代码和 README 都会。下面的本地命令在课程源码目录运行。

~~~powershell
# 在本地验证与 CI 相同的构建输入
dotnet build src/ContainerCourse.Api/ContainerCourse.Api.csproj --configuration Release
docker build -t container-course-api:ci .
~~~

## 看镜像实际包含哪些构建步骤

本地构建和镜像检查已在主练习完成。image history 可以看到镜像记录的构建层，帮助你判断是否把 SDK、源码或不必要的文件带进最终镜像；CI 通过仍需另做部署后健康检查。

~~~powershell
docker image history --no-trunc container-course-api:ci
docker image ls container-course-api:ci
~~~

## 这条工作流实际分成两种权限

课程工作流应有两条路径：Pull Request 和手动验证负责编译、构建镜像但不登录仓库；受保护的 main 分支 push 才获得 packages: write 并发布 GHCR。把“只在步骤上跳过登录”当成安全隔离不够，因为同一个 job 的 GITHUB_TOKEN 权限由 job 级 permissions 决定。

~~~text
pull_request / 手动运行
  -> 编译源码 -> 构建镜像 -> 不登录、不 push

push 到 main
  -> 编译源码 -> buildx -> 使用短期 GITHUB_TOKEN 登录
  -> 发布 sha-<commit> 和 main 分支的 latest
~~~

工作流触发条件中的 paths 是节省 CI 资源的过滤器，不是访问控制。发布 job 还应明确限制事件类型和分支，并只给它真正需要的权限。workflow_dispatch 从非 main 分支手动启动时可以验证构建，但不应发布。

## 读懂一次绿色运行后仍要检查什么

当前示例会执行 .NET 编译、构建 OCI 镜像并使用 BuildKit GitHub Actions cache；它没有单元测试项目，所以不能把 dotnet build 描述成“测试通过”。如果将来加测试项目，应加入 dotnet test 并在构建镜像之前运行。绿勾只表示定义的步骤成功，仍需核对仓库包的标签、digest、可见性和构建提交。

从日志分别检查：Runner 上使用了哪次提交；Buildx 用的上下文和 Dockerfile；metadata-action 生成了哪些标签；push 是否真的执行；最后写入了哪个 digest。PR 构建镜像成功但 GHCR 没有新 tag，是正确的安全行为。

## 修改工作流后如何安全地验证

先在分支里检查 YAML 结构、路径过滤和 permissions；提交后开 Pull Request，观察它只能运行验证路径；合并到 main 后观察发布路径。不要为了测试把个人 token 写进仓库，也不要用 pull_request_target 加载不可信 PR 代码。

~~~powershell
git diff --check
git diff -- .github/workflows/container-course.yml
~~~

Actions 日志里若出现 denied，先确认发布 job 是否来自 main push，以及 GITHUB_TOKEN 是否有 packages:write。若 PR job 发生权限问题，不要给所有 job 增权；先判断它是否应该拥有该权限。

## 从镜像发布到部署仍然隔着一个验收环节

此工作流只构建和发布镜像，不会 SSH 登录服务器，也不会更新 Kubernetes。把 CI、制品发布和部署拆开，部署方以 digest 更新声明式清单，再检查 rollout、readiness 和业务请求。这样能分辨“镜像发布成功”和“服务运行成功”。

## 参考资料

- [Docker 官方 GitHub Actions 指南](https://docs.docker.com/build/ci/github-actions/)
- [GitHub Actions 工作流语法](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
