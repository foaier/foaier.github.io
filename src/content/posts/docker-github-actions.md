---
title: "让 GitHub Actions 自动构建和发布 Docker 镜像"
date: "2026-11-24"
summary: "用代码提交触发 CI，编译 API、构建镜像，再发布带提交号的 GHCR 标签。"
series: "Docker 与 Kubernetes"
order: 18
tags: ["Docker 实战","Docker","Kubernetes"]
level: "Docker 实战"
prerequisites: ["docker-registry-tags"]
goals: ["看懂仓库中的容器发布工作流，并从 Pull Request/主分支区分构建与发布。"]
---

本机 `docker build` 成功，不代表同事电脑上也能重现。把构建命令放进 GitHub Actions 后，每个 Pull Request 都能在干净 Runner 上重新编译和打镜像；合并到主分支才上传到仓库。CI 负责验证和产物，直接连生产服务器部署还要额外做好凭证与回滚设计。

## 概念讲透：它负责什么，不负责什么

CI 在提交后自动验证代码，镜像发布流水线在检查通过后构建并上传不可变制品。Pull Request 阶段通常只运行测试和构建，不应持有发布凭证；受保护分支合并后再推送到 GHCR。工作流中的权限、触发条件、缓存、标签和并发控制都会影响安全性与可追溯性。

## 运行过程拆解：从输入到结果

工作流每一步都应有明确输入输出：checkout 得到源码，测试确认源码能用，buildx 生成 OCI 镜像，登录步骤提供仓库认证，push 才改变远端制品。PR 检查和主分支发布应分开授权。流水线显示成功之后，还要确认制品标签和摘要，再由部署流程更新目标环境；发布镜像不等于已把服务部署到服务器。

## 从一次代码提交到一个镜像

`container-course.yml` 先 checkout，再安装 .NET 10、build API、设置 Buildx，然后用 metadata action 生成提交标签。Workflow 给 job `packages: write`，通过短期 `GITHUB_TOKEN` 登录 GHCR。Pull Request 的 `push` 为 false，只做构建；main 才上传镜像。没有把 SSH 私钥塞进仓库，也没有未经确认改你的服务器。

## 对照工作流检查构建输入

在[仓库里查看完整 workflow](https://github.com/foaier/foaier.github.io/blob/main/.github/workflows/container-course.yml)，对照触发条件、权限、登录、tag 和 build-push。只有整站根目录 README 的更改不会触发它，`examples/container-course/` 下的代码和 README 都会。下面的本地命令在课程源码目录运行。

~~~powershell
# 在本地验证与 CI 相同的构建输入
dotnet build src/ContainerCourse.Api/ContainerCourse.Api.csproj --configuration Release
docker build -t container-course-api:ci .
~~~

## 怎么确认做对了

PR 运行应成功编译并构建镜像，但没有 GHCR push；main push 会新增 `sha-` 加短提交号的标签，例如 `sha-abc1234`，并更新 latest。手工触发时也只有 main 分支发布。看运行日志中的最终 tags 与 Packages 页面，不要只看绿色勾。真实部署再通过部署工作流或 GitOps 更新集群。

## 案例推演

一个 PR 的构建成功，但仓库里没有新镜像，这是预期行为。检查 workflow 的事件过滤和权限：PR 阶段验证，main push 阶段才登录 GHCR 推送。另一个常见问题是权限不够，应只给工作流 packages: write 等必要范围，不要通过复制个人长期 token 解决。构建后按提交 SHA 找对应 tag 和摘要。

## 留一个小练习

在 Pull Request 中改一处 API 响应，然后观察 Actions 是否只构建不发布。合并到 main 后核对镜像标签。再思考若 workflow 能写生产集群，应该给它什么最小权限、怎样回滚，而不是直接复制一把管理员 kubeconfig。

## 没跑通时先查什么

401/denied 检查 job 的 packages:write 和正确 GHCR owner；标签拼错就核对 metadata-action 输出。PR 不能拿到全部秘密是 GitHub 的安全边界，不要通过把 workflow 改成 `pull_request_target` 再 checkout 不可信代码来绕开。

容器镜像只要包含的字节变了，摘要就会变。提交号标签能帮助对应源码，但重推同一个标签仍可能改变它指向的摘要；高要求环境可记录 digest，并在部署记录里保存构建来源与审查结果。

## 看镜像实际包含哪些构建步骤

本地构建和镜像检查已在主练习完成。image history 可以看到镜像记录的构建层，帮助你判断是否把 SDK、源码或不必要的文件带进最终镜像；CI 通过仍需另做部署后健康检查。

~~~powershell
docker image history --no-trunc container-course-api:ci
docker image ls container-course-api:ci
~~~

## 生产里怎么用、怎么排障

可靠发布除了 build 还要做测试、依赖审查、镜像扫描和部署前验收。限制第三方 Action 的版本和权限，保护默认分支，避免来自不可信 PR 的代码读取仓库秘密。生产部署应使用有审批的环境与固定 digest，并保留上一个可用制品；Actions 绿色只说明流水线步骤过了，不代表线上真实流量验证成功。

## 参考资料

- [Docker 官方 GitHub Actions 指南](https://docs.docker.com/build/ci/github-actions/)
- [GitHub Actions 工作流语法](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
