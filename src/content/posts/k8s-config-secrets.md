---
title: "配置和密码别烘焙进镜像：ConfigMap 与 Secret 怎么用"
date: "2026-11-24"
summary: "拆开普通配置和敏感值，搞清环境变量更新与 Secret 的保护边界。"
series: "Docker 与 Kubernetes"
order: 25
tags: ["Kubernetes 入门","Docker","Kubernetes"]
level: "Kubernetes 入门"
prerequisites: ["k8s-service"]
goals: ["通过 ConfigMap 注入日志配置，并解释 Secret base64 不等于加密。"]
---

同一份镜像在测试用测试库，在生产用生产库，通常不该为了换连接串重打一份镜像。把普通配置放 ConfigMap、敏感值放 Secret，再由部署清单引用，镜像才能只关注程序和依赖。

## 概念讲透：它负责什么，不负责什么

ConfigMap 保存非敏感配置，Secret 保存需要保护的值并按引用交给 Pod。环境变量一般在容器创建时注入，之后更新 ConfigMap/Secret 不会改掉进程已经读入的环境；卷挂载有更新延迟且应用要支持重读。Secret 的 base64 只是编码，访问 RBAC、etcd 静态加密和备份保护才决定泄露面。

## 运行过程拆解：从输入到结果

ConfigMap 和 Secret 本身不会直接改进程内存。环境变量在新容器创建时注入；挂载文件由 kubelet 更新，但应用是否重新读取由程序决定。更新内容后需计划滚动重启或文件热加载，并确认新 Pod 拿到同一版本配置。为密钥做版本化名称或发布注解可触发可追溯更新，但秘密值仍需独立加密和限制读取。

## 配置对象更新后，进程未必重读

Secret 并不是“放进去就绝对安全”的保险柜。API 返回的 data 常见是 base64 编码；能读取 Secret 的账号仍能还原明文。生产需要合适的 RBAC、控制面静态加密、审计和密钥轮换，或对接外部秘密管理服务。课程密码只是虚构值，不能照搬到外网。

ConfigMap 的环境变量在容器创建时读取，更新对象不会让现有进程的环境变量自动改变。挂载文件的更新机制又不同，应用还得支持重新加载，subPath 挂载有额外限制。不要把“配置对象已更新”和“程序已使用新配置”画等号。

## 给 API 注入一项日志配置

基础清单已从 Secret 引用数据库密码。这次创建普通 ConfigMap，给 API 注入 .NET 标准日志级别键，并显式触发一次 rollout，让新进程拿到配置。每条命令都限定在课程 namespace。

~~~powershell
kubectl -n container-course create configmap course-settings --from-literal=Logging__LogLevel__Default=Warning --dry-run=client -o yaml | kubectl apply -f -
kubectl -n container-course set env deployment/course-api --from=configmap/course-settings
kubectl -n container-course rollout status deployment/course-api
kubectl -n container-course get configmap course-settings
kubectl -n container-course get secret course-db
~~~

## 怎么确认做对了

ConfigMap 能列出来；Secret 的 get 列表只显示类型和键数量，不必输出明文检查。新 Pod 的日志更少。这个命令式实验要进入长期配置时，应把非敏感引用写回 YAML；真实 Secret 只提交受保护的加密形式或外部引用。

## 案例推演

运维更新 ConfigMap，Pod 里的日志级别仍没变化。先确认该配置以环境变量还是卷挂载进入容器；环境变量方式通常要触发 Pod 模板变更或滚动重启。重启后检查应用实际生效值，同时确认没有把密码写到 ConfigMap、Git 历史或命令行参数里。

## 留一个小练习

把 ConfigMap 日志级别改回 Information 后观察现有 Pod：不会仅因 ConfigMap 内容变化就重建。执行 `kubectl -n container-course rollout restart deployment/course-api` 再检查。练完用 `kubectl -n container-course set env deployment/course-api Logging__LogLevel__Default-` 移除实验变量。

## 没跑通时先查什么

CreateContainerConfigError 先查引用的 Secret 名与 key，注意大小写。更新 PostgreSQL 的 POSTGRES_PASSWORD 环境变量不会替已有数据目录自动更改数据库用户密码，需要数据库端轮换并协调应用更新。别因为认证失败就直接删卷。

## 检查 Pod 已引用的配置名称，不读取秘密值

下面列 API Pod、检查 Deployment 声明的 Secret 引用键名，并筛出告警事件。输出只用于核对引用是否拼对，不读取 Secret data；若新 Pod 没替换，继续看 rollout 和事件原因。

~~~powershell
kubectl -n container-course get pods -l app=course-api -o wide
kubectl -n container-course get deployment course-api -o jsonpath='{range .spec.template.spec.containers[*].env[*]}{.name}{" => "}{.valueFrom.secretKeyRef.name}{"/"}{.valueFrom.secretKeyRef.key}{"\n"}{end}'
kubectl -n container-course get events --field-selector type=Warning --sort-by=.metadata.creationTimestamp
~~~


## ConfigMap 和 Secret 的功能边界

ConfigMap 放普通配置，Secret 放凭据或证书；两者都是 Kubernetes API 对象，都会被有权限的主体读取。Secret 的 data 使用 Base64 表示只是编码，不是加密。集群要配置 etcd 静态加密、限制 RBAC 权限并保护备份；有更高要求时通过外部 Secret 管理系统注入短期凭据。

| 注入方式 | 更新后进程看到什么 | 常见限制 |
|---|---|---|
| 环境变量 | 旧进程不会自动刷新 | 通常需滚动重建 Pod |
| Secret/ConfigMap volume | 文件会最终更新 | 应用必须重新读取文件；subPath 挂载不会按普通方式更新 |
| 启动参数 | 启动时固定 | 需重新创建进程 |

ConfigMap 和 Secret 都不适合放大体积文件。它们有对象大小限制，配置文件较大时应使用镜像、卷或专用配置服务。

## 让配置成为 Pod 模板的一部分

Pod 通过 envFrom、单个 valueFrom 或 volume 引用配置对象。引用名称拼错时，Pod 可能无法启动；Secret key 不存在时也会出现创建错误。改动环境变量后，Deployment 模板应产生新 revision，旧 Pod 不会凭空改变自己的进程环境。

~~~yaml
env:
  - name: Logging__LogLevel__Default
    valueFrom:
      configMapKeyRef:
        name: course-settings
        key: Logging__LogLevel__Default
  - name: POSTGRES_PASSWORD
    valueFrom:
      secretKeyRef:
        name: course-db
        key: password
        optional: false
~~~

这个片段展示字段关系，使用前面的 course-settings 和 course-db 对象；实际生产应用只注入它确实要读取的变量。不要因为变量已注入就假设程序读取了它。对环境变量更新，通常要让 Deployment 模板变更或 rollout restart，并确认新 Pod 的时间和 revision。

## 轮换配置后验收新旧实例

更新配置时先确认应用是否支持热加载。若不支持，触发滚动更新后检查新 Pod、EndpointSlice 和业务请求；旧凭据失效的时机应等新版本已成功使用新凭据之后。回滚应用不会自动恢复已经撤销的外部密钥。

## 生产里怎么用、怎么排障

Secret 会进入 etcd 备份和管理者可读范围，要开启静态加密、限制读取主体、审计访问并建立轮换流程。通过命令行 --from-literal 创建时，值可能留在 shell 历史或进程参数中，生产自动化应安全注入。配置变更前做格式校验和回滚版本，避免错误配置让所有副本同时失去服务。

## 参考资料

- [ConfigMap](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Secret](https://kubernetes.io/docs/concepts/configuration/secret/)
