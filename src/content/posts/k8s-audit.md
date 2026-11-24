---
title: 谁改了集群：在本地启用 API 审计日志
date: '2026-11-24'
summary: 新建带审计策略的 kind 集群，创建、修改、删除一个对象，再从日志里查出操作者和结果。
series: Docker 与 Kubernetes
order: 50
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-rbac
goals:
  - 新建带审计策略的 kind 集群，创建、修改、删除一个对象，再从日志里查出操作者和结果。
---
Events 会记录调度失败等运行事件，但不能代替长期操作审计。你要回答“谁在什么时候删除了 Deployment”，应该看 API Server 的审计记录。应用访问日志、Kubernetes Events、API 审计是三种不同记录。

## 审计级别不是越详细越好

None 不记录；Metadata 记录操作者、动词、资源和响应信息；Request 还记录请求体；RequestResponse 连响应体也记录。Secret、Token 和配置内容可能进入请求或响应体，所以不能为了“排错方便”把所有资源都开到最高级别。

本课仅记录 metadata，保留 ResponseComplete 阶段，避免同一请求产生过多阶段记录。规则从上到下匹配，下面先匹配 Secrets，再匹配实验 namespace，最后不记录其他请求。

~~~yaml file=audit/policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages:
  - RequestReceived
rules:
  - level: Metadata
    resources:
      - group: ""
        resources: [secrets]
  - level: Metadata
    namespaces: [audit-lab]
    verbs: [create, update, patch, delete]
  - level: None
~~~

## 创建专用集群，避免改正在使用的控制平面

在实验包根目录运行。命令生成带绝对挂载路径的 kind 配置；不会直接修改 course 集群的 API Server。需要 Docker 能访问当前目录，WSL 建议把实验包放 Linux 用户目录。

~~~bash
cat > /tmp/course-audit-kind.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraMounts:
      - hostPath: "$PWD/audit"
        containerPath: /etc/kubernetes/audit-policy
        readOnly: true
    kubeadmConfigPatches:
      - |
        kind: ClusterConfiguration
        apiServer:
          extraArgs:
            - name: audit-policy-file
              value: /etc/kubernetes/audit-policy/policy.yaml
            - name: audit-log-path
              value: /var/log/kubernetes/audit.log
            - name: audit-log-maxage
              value: "1"
            - name: audit-log-maxbackup
              value: "2"
            - name: audit-log-maxsize
              value: "10"
          extraVolumes:
            - name: audit-policy
              hostPath: /etc/kubernetes/audit-policy
              mountPath: /etc/kubernetes/audit-policy
              readOnly: true
              pathType: Directory
            - name: audit-log
              hostPath: /var/log/kubernetes
              mountPath: /var/log/kubernetes
              pathType: DirectoryOrCreate
EOF
kind create cluster --name course-audit --image kindest/node:v1.35.0 --config /tmp/course-audit-kind.yaml --wait 180s
kubectl config use-context kind-course-audit
kubectl get nodes
~~~

第一层 extraMounts 把电脑目录放进 kind 节点；第二层 extraVolumes 把节点目录挂进 API Server 容器。少任何一层，API Server 都可能找不到策略文件。这套参数使用本课 kubeadm v1beta4 的 extraArgs 列表形式，不能随便套旧版本字典格式。

## 创建、修改和删除一个无敏感内容的对象

~~~bash
kubectl create namespace audit-lab
kubectl -n audit-lab create configmap trace-demo --from-literal=mode=one
kubectl -n audit-lab patch configmap trace-demo --type=merge -p '{"data":{"mode":"two"}}'
kubectl -n audit-lab delete configmap trace-demo
docker exec course-audit-control-plane cat /var/log/kubernetes/audit.log
~~~

日志是逐行 JSON。查 objectRef 中的 namespace/name，应该能找到 configmaps/trace-demo 的 create、patch、delete；responseStatus.code 通常分别为 201、200、200，具体以实际结果为准。用户名来自当前 kubeconfig 的身份，不是你给 ConfigMap 起的名字。

## 用 jq 把需要的字段挑出来

Ubuntu 可用 `sudo apt-get install jq`，macOS 可用 `brew install jq`。只过滤这次实验，不把整份含其他操作的日志贴到公开页面：

~~~bash
docker exec course-audit-control-plane cat /var/log/kubernetes/audit.log | jq -c 'select(.objectRef.namespace == "audit-lab" and .objectRef.name == "trace-demo") | {time: .stageTimestamp, user: .user.username, verb: .verb, resource: .objectRef.resource, code: .responseStatus.code}'
~~~

Metadata 不包含 mode 的值，所以能知道发生了 patch，却不能直接从这份策略的日志还原配置全文。需要更深记录时应限定资源范围、访问权限和保留期限，而不是无差别记录 Secret 内容。

## 日志没出现，按路径查

首先检查策略是否匹配对应 namespace 和动词；再看节点目录是否有文件；最后查看 API Server 启动参数和日志。kubectl 无法连接时，用 `kind export logs ./audit-debug --name course-audit` 收集创建失败日志。不要在不清楚原因时直接关掉所有控制平面安全参数。

审计日志里一条 delete 请求也可能是控制器身份发起的级联删除，要结合 ownerReferences、auditID 和此前操作判断，不能见到最后执行者就当成最初触发者。

## 收尾和生产差别

~~~bash
kind delete cluster --name course-audit
kubectl config use-context kind-course
kubectl config current-context
~~~

专用集群删除时本地审计日志也删除。生产需要外部归集、访问控制、保留和磁盘容量监控；只保存在控制平面节点上，节点故障或被入侵时记录可能无法保全。托管集群应使用平台提供的控制平面审计功能，而不是照着本课改托管 API Server 参数。

## 继续阅读

- [Kubernetes 审计](https://kubernetes.io/zh-cn/docs/tasks/debug/debug-cluster/audit/)
- [kind 审计配置](https://kind.sigs.k8s.io/docs/user/auditing/)
