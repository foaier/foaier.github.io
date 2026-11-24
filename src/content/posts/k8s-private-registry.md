---
title: 私有镜像怎么交付：Harbor 管理与 imagePullSecrets
date: '2026-11-24'
summary: 在本机体验 Harbor 项目和推送，再通过一个真实私有仓库验证节点拉取授权与命名空间边界。
series: Docker 与 Kubernetes
order: 46
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-helm-kustomize
  - k8s-rbac
  - docker-registry-tags
goals:
  - 在本机体验 Harbor 项目和推送，再通过一个真实私有仓库验证节点拉取授权与命名空间边界。
---
本机 `docker login` 成功，不代表 Kubernetes 节点也有权限拉镜像。你的电脑、kind 节点里的 containerd、Pod 使用的 imagePullSecrets 是不同位置。先把“仓库管理”和“节点拉取”分开练，再连接起来。

## Harbor 比一个镜像目录多什么

Harbor 在 Registry 之上增加项目、用户或机器人账号、访问控制、扫描、保留策略和复制等管理能力。镜像标签是可变引用，digest 标识具体内容；生产发布最好能从提交、构建记录追溯到 digest，避免同名标签今天和明天对应不同镜像。

## 在本地启动一个用于看管理流程的 Harbor

本机应有足够内存，先卸载监控等重型实验。这套演示关闭持久化和扫描，只通过本机端口转发访问；用于熟悉界面和推送，卸载会删除镜像。

~~~yaml file=registry/harbor-values.yaml
expose:
  type: clusterIP
  tls:
    enabled: false
externalURL: http://127.0.0.1:5000
harborAdminPassword: Local-Harbor-Only-2026
persistence:
  enabled: false
trivy:
  enabled: false
~~~

~~~bash
helm repo add harbor https://helm.goharbor.io
helm repo update
helm upgrade --install harbor harbor/harbor --version 1.18.0 -n registry-lab --create-namespace -f registry/harbor-values.yaml --wait --timeout 10m
kubectl -n registry-lab get pods,services
kubectl -n registry-lab port-forward service/harbor 5000:80
~~~

打开 `http://127.0.0.1:5000`，用 admin 和 values 中的实验密码登录。创建一个名为 lesson 的私有项目。不要将这组公开教学凭证用于公网部署。

## 推一份镜像，观察项目和摘要

另开终端，先拉取 Nginx，再给它打仓库标签。tag 不会复制整个镜像，只是增加引用。

~~~bash
docker pull nginx:1.28-alpine
docker tag nginx:1.28-alpine 127.0.0.1:5000/lesson/web:v1
docker login 127.0.0.1:5000 -u admin
docker push 127.0.0.1:5000/lesson/web:v1
~~~

交互输入本地教学密码，界面中应出现 lesson/web:v1 和 digest。Docker 对本机回环仓库允许这一实验 HTTP 流程；正式 Harbor 应配置可信 HTTPS、持久存储、受限机器人账号及扫描策略。

**不要把这个 127.0.0.1 镜像地址直接放进 Pod。** 节点里的 127.0.0.1 指节点自己，端口转发还只在你的电脑监听。本实验没有把 Harbor 配成节点可访问的生产仓库，下面改用可从节点访问的 GHCR 完成真实私有拉取练习。

## 准备自己账号的私有 GHCR 镜像

需要你自己的 GitHub 账号，以及有适用包读写权限的凭证；组织还可能要求 SSO 授权。没有账号凭证可先完成 Harbor 部分，不要使用别人的 Token。输入小写 GitHub 用户名，Token 只在本机读取，不写进 YAML：

~~~bash
read -r -p 'GitHub 用户名（小写）: ' lab_user
read -r -s -p 'GHCR Token: ' lab_token
printf '\n'
lab_auth=$(mktemp -d)
printf '%s' "$lab_token" | docker --config "$lab_auth" login ghcr.io -u "$lab_user" --password-stdin
unset lab_token
docker tag nginx:1.28-alpine "ghcr.io/$lab_user/k8s-private-web:v1"
docker --config "$lab_auth" push "ghcr.io/$lab_user/k8s-private-web:v1"
~~~

在 GitHub Packages 中确认包是 Private。这里的临时 Docker 配置目录会含登录凭证，不要提交或分享。教学使用同一凭证简化流程；实际节点应使用仅有拉取权限的账号。

## 把拉取授权交给目标 namespace

~~~bash
kubectl create namespace pull-lab
kubectl -n pull-lab create secret generic ghcr-pull --type=kubernetes.io/dockerconfigjson --from-file=.dockerconfigjson="$lab_auth/config.json"
kubectl -n pull-lab create deployment private-web --image="ghcr.io/$lab_user/k8s-private-web:v1"
kubectl -n pull-lab patch deployment private-web --type=merge -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"ghcr-pull"}]}}}}'
kubectl -n pull-lab rollout status deployment/private-web --timeout=180s
kubectl -n pull-lab get pods
~~~

首次部署可能先报未授权，补 imagePullSecrets 后新 Pod 应就绪。Secret 与 Pod 必须同 namespace；镜像地址的仓库主机名应匹配凭证配置。若出现 unauthorized，查权限、包归属和组织授权；x509 错误查证书，不要用改密码处理证书问题。

## 清理与正式交付的差别

~~~bash
kubectl delete namespace pull-lab
docker --config "$lab_auth" logout ghcr.io
docker logout 127.0.0.1:5000
helm uninstall harbor -n registry-lab
kubectl delete namespace registry-lab
~~~

清理集群不会删除 GHCR 里刚推送的包，可在自己的包设置里按需删除。生产集群还需要节点能解析仓库域名、信任证书、连通端口；仓库保留策略不能误删仍在部署的 digest；凭证过期前应轮换并做新节点拉取验证。

## 继续阅读

- [拉取私有镜像](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/pull-image-private-registry/)
- [Harbor 项目管理](https://goharbor.io/docs/)
