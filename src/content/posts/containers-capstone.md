---
title: "做一次完整演练：把 API 从源码带到可检查的集群"
date: "2026-11-24"
summary: "串起镜像、配置、发布、排错与数据边界，写一份自己的容器运行清单。"
series: "Docker 与 Kubernetes"
order: 42
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-gitops"]
goals: ["独立构建课程 API、部署到 kind、验证写入并收集故障证据。"]
---

到这里每一块工具都见过了。综合练习不要求把所有云产品装进电脑，而是完成闭环：输入是什么、部署后如何验证、失败时第一条证据在哪儿、实验后数据有没有保留。

## 先定清这次演练的完成标准

Pull Request workflow 会编译并构建镜像；main push 发布带提交号的 GHCR 镜像。kind 用本地标签验证声明、Service、探针和卷。两种环境目标不同：本地运行通过，不代表公网入口、云卷、证书和私有仓库凭证已经配置。

完成标准是镜像可追溯、Secret 不进 Git、工作负载有 requests 与探针、数据库数据放 PVC 并理解 PVC 仍需独立备份、权限有范围。每一步留一条验证和失败恢复方法。

## 从镜像到数据库，把链路走完

确认 context 为课程 kind，再 build/load 本地镜像，应用 Kustomize overlay。按照前面步骤先创建虚构的 course-db Secret。验证 API 与数据库 rollout，端口转发后检查 readiness，写入再读取记录。

~~~powershell
kubectl config current-context
kubectl apply -f k8s/00-namespace.yaml
kubectl -n container-course create secret generic course-db --from-literal=password=course-local-only # 只在首次创建时执行
docker build -t container-course-api:local .
kind load docker-image container-course-api:local --name course
kubectl apply -k k8s
kubectl -n container-course rollout status deployment/postgres --timeout=180s
kubectl -n container-course rollout status deployment/course-api --timeout=180s
kubectl -n container-course port-forward service/course-api 8080:80
~~~

## 怎么确认做对了

API 两副本 Ready，Service 有后端，PVC Bound，health/ready 返回 ready，演示记录可读。port-forward 在第一个终端保持运行；再开一个 PowerShell 请求就绪地址，并用 POST 写入、GET 查询虚构记录。Git 中清单与当前 image tag 对得上。

## 留一个小练习

模拟本地镜像标签错误或配置引用名错误，记录 Events、修复和验证。写半页值班笔记：版本辨认、日志、数据库健康、谁能管理 Secret、哪些变更能回滚、PVC 和备份分别在哪儿。

## 没跑通时先查什么

从压缩包开始需先创建 kind 和 Secret；apply -k 不会自动构建镜像。8080 冲突先停 Compose 或改本机映射端口。结束前确认 context 和资源归属仍是 kind-course。

自检：两个 API Ready；删一个后能恢复；数据库 Pod 重建后能读回记录；镜像有版本；密码未提交；另一位读者能按文档重复验证。本地 PVC 不代替独立备份演练。

## 参考资料

- [kind Quick Start](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [生产环境规划](https://kubernetes.io/docs/setup/production-environment/)
- [Docker GitHub Actions](https://docs.docker.com/build/ci/github-actions/)
