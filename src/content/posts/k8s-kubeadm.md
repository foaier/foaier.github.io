---
title: 从 kind 走到服务器：用 kubeadm 安装两节点集群
date: '2026-11-24'
summary: 在两台干净的 Ubuntu 虚拟机上安装 containerd、kubelet 和 kubeadm，初始化控制平面、加入工作节点并部署网络。
series: Docker 与 Kubernetes
order: 52
tags:
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-architecture
  - k8s-networking
goals:
  - 在两台干净的 Ubuntu 虚拟机上安装 containerd、kubelet 和 kubeadm，初始化控制平面、加入工作节点并部署网络。
---
kind 把节点准备工作封装了。现在换两台真正的 Linux 虚拟机，把操作系统、运行时和 Kubernetes 连起来。本课是进阶选学，基础应用练习不需要重做。命令会修改系统配置，只在新建实验虚拟机执行。

## 两台机器和网络准备

两台 Ubuntu Server 24.04 LTS 虚拟机：控制平面叫 lab-cp，示例 IP 192.168.56.10；工作节点叫 lab-worker，示例 IP 192.168.56.11。各至少 2 核、2 GiB，控制平面建议 4 GiB。使用自己虚拟机网络里的固定 IP，能互通且能访问软件仓库。以下命令中的 IP 必须替换成实际地址，不能仅改主机名。

Pod 网段用 10.244.0.0/16，Service 网段用 10.96.0.0/12，两者不应与宿主机、VPN 和节点网段重叠。保证时间同步、主机名唯一、MAC 和 product_uuid 唯一。克隆虚拟机时尤其要检查这些字段。

~~~bash
hostnamectl
ip -br addr
timedatectl
swapon --show
~~~

在控制平面执行 `sudo hostnamectl set-hostname lab-cp`，工作节点执行 `sudo hostnamectl set-hostname lab-worker`。防火墙只允许实验节点之间所需流量：控制平面 TCP 6443、节点 kubelet TCP 10250，Calico VXLAN UDP 4789，以及集群所需内部流量；etcd 2379–2380 只允许适用控制平面成员。不要把“关闭所有防火墙”作为标准安装步骤。

## 两台机器都准备内核和运行时

本课按不使用 swap 的配置安装。先临时关闭，再编辑 fstab 注释掉实验机的 swap 项，确保重启不会恢复；不要删除不认识的磁盘挂载行。

~~~bash
sudo swapoff -a
sudo cp /etc/fstab /etc/fstab.before-k8s
sudo nano /etc/fstab
sudo modprobe overlay
sudo modprobe br_netfilter
printf 'overlay\nbr_netfilter\n' | sudo tee /etc/modules-load.d/k8s.conf
cat <<'EOF' | sudo tee /etc/sysctl.d/99-k8s.conf
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
EOF
sudo sysctl --system
sudo apt-get update
sudo apt-get install -y containerd ca-certificates curl gpg
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml >/dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
sudo systemctl restart containerd
sudo systemctl enable containerd
sudo systemctl is-active containerd
~~~

这一步在干净虚拟机生成 containerd 默认配置，不能覆盖已有业务节点的配置。SystemdCgroup 要与 kubelet 的 cgroup 驱动一致；确认配置没有禁用 CRI。运行时版本不同，插件配置路径会变化，所以先由当前 containerd 生成配置，再修改字段，不抄整份旧版模板。

## 从同一小版本仓库安装 Kubernetes

两台都执行，保持相同包版本。这里固定 1.35 系列，并从该仓库选可用补丁版本；升级时再单独处理，不永远使用初始补丁。

~~~bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.35/deb/Release.key | sudo gpg --dearmor --yes -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.35/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
apt-cache madison kubeadm
lab_pkg=$(apt-cache madison kubeadm | awk '$3 ~ /^1.35/ {print $3; exit}')
test -n "$lab_pkg"
sudo apt-get install -y "kubelet=$lab_pkg" "kubeadm=$lab_pkg" "kubectl=$lab_pkg"
sudo apt-mark hold kubelet kubeadm kubectl
sudo systemctl enable kubelet
kubeadm version -o short
~~~

尚未 init/join 时 kubelet 反复等待配置，不一定是安装坏了。hold 避免系统常规更新突然升级集群组件。两台的 apt-cache 输出若不同，先统一仓库和明确包版本，再继续。

## 只在控制平面初始化

~~~bash
lab_version=$(kubeadm version -o short)
sudo kubeadm init --kubernetes-version "$lab_version" --apiserver-advertise-address=192.168.56.10 --pod-network-cidr=10.244.0.0/16 --cri-socket=unix:///run/containerd/containerd.sock
mkdir -p "$HOME/.kube"
sudo cp /etc/kubernetes/admin.conf "$HOME/.kube/config"
sudo chown "$(id -u):$(id -g)" "$HOME/.kube/config"
kubectl get nodes
~~~

init 输出中有 join 命令，包含短期 Token 和 CA 摘要，应妥善保存，不贴到公开文章。此时节点 NotReady 通常因为网络插件未安装。admin.conf 是高权限凭证，不能作为给所有开发人员的统一登录文件。

## 安装 Calico，再让工作节点加入

仍在控制平面，使用 operator 和明确的 Pod IP 池。不会照搬实验室的软路由或关闭 TLS 验证。

~~~bash
kubectl apply --server-side -f https://raw.githubusercontent.com/projectcalico/calico/v3.33.1/manifests/operator-crds.yaml
kubectl apply --server-side -f https://raw.githubusercontent.com/projectcalico/calico/v3.33.1/manifests/tigera-operator.yaml
kubectl wait --for=condition=Established crd/installations.operator.tigera.io --timeout=60s
cat <<'EOF' | kubectl apply -f -
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  calicoNetwork:
    bgp: Disabled
    ipPools:
      - cidr: 10.244.0.0/16
        blockSize: 26
        encapsulation: VXLAN
        natOutgoing: Enabled
        nodeSelector: all()
EOF
kubectl get pods -n tigera-operator
kubectl get pods -n calico-system
sudo kubeadm token create --print-join-command
~~~

复制最后输出的完整 join 命令，到**工作节点**加 sudo 执行；它包含实际 Token 与 CA 摘要，不能用文章中的虚构值替代。加入完成后回控制平面：

~~~bash
kubectl wait --for=condition=Ready nodes --all --timeout=300s
kubectl get nodes -o wide
kubectl create deployment server-web --image=nginx:1.28-alpine
kubectl rollout status deployment/server-web --timeout=180s
kubectl get pods -o wide
kubectl port-forward deployment/server-web 8080:80
~~~

另开该虚拟机终端 `curl -I http://127.0.0.1:8080`，应返回 200。电脑浏览器访问电脑 localhost 不会自动到虚拟机，可用 SSH 本地转发 `ssh -L 8080:127.0.0.1:8080 用户@控制平面IP`，保持两个转发终端运行。

## 安装失败要查哪个进程

join 超时先查工作节点到控制平面 6443 的网络；NotReady 看 CNI Pod 和 kubelet 日志；容器创建失败检查 containerd 与 CRI。常用命令：

~~~bash
sudo journalctl -u kubelet -n 80 --no-pager
sudo journalctl -u containerd -n 80 --no-pager
kubectl -n calico-system get pods -o wide
kubectl describe node lab-worker
kubectl delete deployment server-web
~~~

这套单控制平面没有高可用，默认也没有通用动态磁盘供应，不能直接承接 kind 的 standard 存储类清单。生产还需要负载均衡入口、多控制平面、存储、证书维护、监控、备份和升级演练。结束整个虚拟机实验时优先删除自己创建的实验虚拟机；`kubeadm reset` 并不保证清理所有 CNI 配置和网络规则。

## 继续阅读

- [安装 kubeadm](https://kubernetes.io/zh-cn/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)
- [使用 kubeadm 创建集群](https://kubernetes.io/zh-cn/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
