---
title: "删掉容器，数据库数据会不会一起没？先搞懂 Volume 和目录挂载"
date: "2026-11-24"
summary: "用 named volume 保留 PostgreSQL 数据，并比较 bind mount 的用途。"
series: "Docker 与 Kubernetes"
order: 12
tags: ["Docker 实战","Docker","Kubernetes"]
level: "Docker 实战"
prerequisites: ["docker-config-secrets"]
goals: ["验证删容器后命名卷仍在，并有意识地区分 `down` 和 `down -v`。"]
---

数据库容器升级重建，表里的练习记录却消失了。数据库文件默认落在容器可写层；删除容器时，这层也一起删。需要跨容器保留的数据应该放在容器之外的持久化位置。

## 概念讲透：它负责什么，不负责什么

卷把数据生命周期从容器生命周期中分开。命名卷由 Docker 管理，适合数据库这类需要保留的数据；bind mount 把宿主机指定路径映射进去，适合开发时共享源码，也意味着容器能接触宿主机路径。卷提供持久化位置，不自带备份、复制、加密和跨主机迁移能力。

## 运行过程拆解：从输入到结果

容器挂载卷后，挂载路径会遮住镜像里原本同一路径的内容。命名卷的物理位置由 Docker 管理；bind mount 的来源是明确的宿主机目录。删容器再用同一卷启动能找回数据，换卷名却会得到一份新空数据。迁移前核对实际挂载源和目标版本，并以数据库导出/导入验证备份，而不是只检查 Docker 报卷存在。

## 文件该放在容器之外的哪里

命名卷由 Docker 管理，适合数据库这类持续保存的数据；bind mount 则把宿主机明确的某个目录映射进去，源码热更新和人工编辑配置时更直观。两者都不是自动备份，更不是让多个数据库副本可以安全共用的魔法盘。课程 Compose 将 PostgreSQL 数据放进 `course-data` 命名卷。

## 重建容器后再查一次记录

写入一条 visit 后用 `docker compose down` 停止服务，卷会保留。再启动并查询，记录仍然存在。只有明确运行 `down -v` 才同时删除 Compose 管理的卷；做这一步前先确认本地练习数据不用留了。

~~~powershell
docker compose up --build -d --wait
Invoke-RestMethod -Method Post -Uri http://localhost:8080/visits -ContentType "application/json" -Body '{"note":"volume-test"}'
docker compose down
docker compose up -d --wait
Invoke-RestMethod http://localhost:8080/visits
~~~

## 怎么确认做对了

重新启动后能查回 volume-test；`docker volume ls` 可看到课程卷。执行 `docker compose down -v` 再启动，API 会在首次写入时重新建演示表，但旧记录不在。这正好说明数据与容器生命周期的区别。

## 案例推演

运维删除并重新创建 PostgreSQL 容器后，记录还在。原因是数据写在挂载的命名卷中，而不是容器可写层。若换成另一台机器或执行 docker compose down -v，数据不一定还在。先用 docker volume inspect 核对挂载点和卷名，再执行一次数据库导出并在隔离环境导入，验证备份文件而不是只看“文件存在”。

## 留一个小练习

创建一份独立的备份，再删除课程卷并恢复数据。生产练习前只用虚构数据，先查看 `docker compose ls` 与 `docker volume ls`，确保命令作用在课程项目上。

## 没跑通时先查什么

bind mount 中宿主机路径写错会导致空目录或权限异常。Linux 文件 UID/GID 与容器运行 UID 也要对上。named volume 的具体存储位置由 Docker 管理，不要直接改底层目录。卷还在不等于数据可恢复，定期备份和恢复演练是另一项工作。

匿名卷和命名卷都能把数据放在容器之外，但是否安全取决于挂载位置、权限、清理策略和备份。应用升级前拍个 Docker Desktop 磁盘快照也不是完整数据库备份；备份应能在另一个数据库实例上恢复并验证行数或业务查询。

## 生产里怎么用、怎么排障

生产数据库需要一致性备份、异地保留、加密、访问控制和定期恢复演练。文件系统复制正在写入的数据库目录可能得到不一致快照，应按数据库支持的备份方法或经过协调的存储快照执行。删除卷、变更卷名和切换挂载路径都可能让服务看到一个空目录；变更前确认当前数据源并准备回退。

## 参考资料

- [Docker volumes](https://docs.docker.com/engine/storage/volumes/)
- [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
