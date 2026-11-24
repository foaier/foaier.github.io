---
title: GitHub Actions 实战：提交 Java 代码，自动构建发布镜像
date: '2026-11-24'
summary: 在自己的仓库安装示例工作流，检查分支、权限、镜像标签与拉取验收。
series: Docker 与 Kubernetes
order: 24
tags:
  - Docker
  - Docker 进阶
level: Docker 进阶
prerequisites:
  - docker-monitoring
goals:
  - 用提交号发布镜像，区分构建成功与部署成功。
---
手工 build、tag、push 都做过以后，可以把它们交给 GitHub Actions。这里继续使用 Java 实验项目：每次推送 main 时构建镜像并发布到 GHCR，Pull Request 只检查能否构建。

这一课需要自己的 GitHub 账号与仓库。没有账号也可以先读流程，Docker 入门和后面的 Kubernetes 本地实验不以这一步为前提。

## 准备一个独立仓库

把[Docker 实验包](/downloads/docker-labs.zip)里的 docker-labs 目录作为新仓库根目录：根目录应有 java-app、compose.yaml、workflows。不要把实验嵌套到别的目录后仍照抄路径。

文件里的教学密码仅用于本地，不要把真实凭据带入仓库。创建 GitHub 仓库时不额外初始化 README，以免第一次推送产生两套提交历史。以下在自己的新目录运行，远端地址换成自己的：

~~~bash
cd ~/docker-labs
git init -b main
git add .
git commit -m "Add Docker learning sample"
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
~~~

此时还没有推送。先补工作流，保证文件路径正确。

## 把示例工作流放到 GitHub 识别的位置

~~~bash
mkdir -p .github/workflows
cp workflows/java-image.yml .github/workflows/java-image.yml
cat .github/workflows/java-image.yml
~~~

工作流已经随下载包提供。它包含 checkout、Buildx、登录 GHCR、生成镜像名、build-push 五步。关键部分如下，完整文件以包内为准：

~~~yaml
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
~~~

packages:write 用来推镜像，身份来自本次工作流的 GITHUB_TOKEN，不需要在源码写长期个人密码。来自 fork 的 PR 令牌通常只有受限权限，这份流程在 PR 上不登录也不推送。

## 看懂构建路径与镜像标签

~~~yaml
- uses: docker/build-push-action@v6
  with:
    context: ./java-app
    push: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}
    tags: ${{ steps.image.outputs.tag }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
~~~

context 必须对应包含 pom.xml、src、Dockerfile 的目录。镜像名按 `ghcr.io/账号/仓库:完整提交号` 生成，工作流会把仓库名转成小写。提交号标签让你能找到这次镜像来自哪个版本；用 latest 作为唯一标记，回滚时就容易失去依据。

GHA 缓存帮助后续构建减少重复步骤，不意味着可以跳过编译验收。镜像构建成功也没有验证 MySQL、Redis 联调，那是另一项测试任务。

## 提交推送，按步骤读 Actions 日志

~~~bash
git add .github/workflows/java-image.yml
git commit -m "Build and publish Java image"
git push -u origin main
~~~

进入仓库 Actions，打开 Build Java Docker lesson。先看 checkout，再看 Buildx 和构建日志，最后看是否 push 成功。绿色构建并不自动证明发布：PR 或手工触发按本示例只构建，只有 push 到 main 才发布。

在仓库关联的 Packages 查看镜像版本。新包可能是 private，另一台机器需要登录或按你的需求调整包可见性，不能靠猜标签就绕过权限。

## 在本机拉取这次产物

从 Actions 日志复制真实镜像地址，替换下面的值后执行。不要把示例提交号照搬：

~~~bash
IMAGE=ghcr.io/your-account/your-repository:actual-commit-sha
docker login ghcr.io
docker pull "$IMAGE"
docker run --name ci-java -d -p 127.0.0.1:8094:8080 "$IMAGE"
docker logs --tail 30 ci-java
~~~

登录时用具备读取该包权限的凭据。等应用启动后访问 `http://localhost:8094/health/live`，应是 alive；没有配置数据库时 ready 仍会失败，与 Java 镜像课一致。

正式部署还要注入运行配置、验证依赖、处理数据库迁移、设置回滚。CI 推镜像与生产 CD 部署是两件事，不能把“Actions 绿了”当作用户已经可访问。

## 出错时别先换一整套工作流

Dockerfile 找不到，检查 context 路径；Maven 依赖错误看构建步骤第一条异常；GHCR denied 查 packages 权限、组织策略和包所属仓库；工作流没有运行查它是否提交在 `.github/workflows`，以及事件是否匹配分支。

~~~bash
docker rm -f ci-java
docker logout ghcr.io
~~~

这份 Java 发布工作流放在实验包里，供读者复制到自己的仓库。博客站点本身继续由已有 Pages 工作流发布，不需要为了学 Docker 把简历或博客一起塞进镜像。

## 继续阅读

- [命令与配置说明](https://docs.docker.com/build/ci/github-actions/)
- [进一步了解相关机制](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
