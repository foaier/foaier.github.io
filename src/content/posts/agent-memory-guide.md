---
title: "记忆选型：保存消息、检索历史和长期偏好，不是一回事"
date: "2026-11-20"
summary: "根据需要保存的信息选择记忆方案，理解旧版 ChatMessageStore 示例的迁移边界。"
series: "Agent Framework 进阶"
order: 11
tags: ["Agent Framework 进阶","循序渐进"]
level: "动手实战 · C# / .NET 10"
prerequisites: ["agent-session-persistence"]
goals: ["根据需要保存的信息选择记忆方案，理解旧版 ChatMessageStore 示例的迁移边界。"]
---

“让 Agent 记住我”其实可能包含三种需求：重新打开窗口继续刚才的对话；从很久以前的聊天里找到相关内容；记住我长期喜欢用 C# 学习。先把需求说清楚，才能选对存储和提供器。

## 先按问题选入口

| 你要解决的问题 | 先学哪一篇 |
| --- | --- |
| 进程关闭后恢复一次会话 | [会话序列化](/articles/agent-session-persistence/) |
| 多个进程读同一段消息历史 | [Valkey 历史](/articles/agent-valkey-history/) |
| 按当前问题找相关旧对话 | [向量历史记忆](/articles/agent-history-memory/) |
| 用本地文件保存学习偏好 | [文件记忆](/articles/agent-file-memory/) |
| 使用云端记忆服务 | [Foundry](/articles/agent-foundry-memory/) 或 [Mem0](/articles/agent-mem0-memory/) |

这些能力可以组合，但没有必要在第一次聊天时全部装上。存储位置决定数据放在哪里，提供器决定什么时候读写，模型决定如何利用上下文，应用决定允许谁访问。

## 旧版 ChatMessageStore 为什么不能直接复制

早期教程可能使用 ChatMessageStore 或 AgentThread 等名称。当前课程固定的版本以 AgentSession、ChatHistoryProvider 和上下文提供器组织相关能力。迁移应该按职责对应，而不是把类名机械替换后认为行为不变。

如果旧代码只是把消息序列写进外部数据库，先看 ValkeyChatHistoryProvider 这条路径；如果保存的是整个会话状态，则看序列化。若要自己实现数据库适配器，需要按当前 ChatHistoryProvider 契约实现读写，并测试工具调用消息、并发更新和失败重试，不能只保存 user 与 assistant 的纯文字。

## 一个用户和一段会话，要分别标识

同一个用户可以有多个会话，长期偏好可能允许跨会话使用，但某一次任务的临时数据未必适合扩散。用 userId、conversationId 和业务资源范围表达这些差异，通常比用一个随意拼接的字符串清楚。

这些标识由应用从登录身份和业务记录产生，不让模型决定。演示代码里的固定用户只用于本机实验，复制到多人系统前必须替换。否则两个用户可能在无意中读到同一份“记忆”。

## 做一次重启实验

选择一种方案，保存虚构偏好后依次做三件事：新建 Session、重启应用进程、重启存储服务。每一步分别查询偏好，记录是否仍存在。不要只完成第一步就把功能写成“永久记忆”。

内存向量库通常过不了进程重启；文件依赖磁盘和目录；Valkey 是否跨服务重启保留取决于持久化配置；云端记忆还可能异步更新。把这些结果记录下来，架构选择就有了依据。

## 记忆也需要忘记

学习偏好会变化，旧事实可能失效，用户也可能要求删除。应用需要定义更新、过期和删除行为，并验证原文、向量、缓存等副本是否一致。记录越多不一定越聪明，过期或冲突的记忆反而会让回答更混乱。

可以用“我每天学二十分钟”变成“我现在每天学十分钟”做实验。观察系统是否更新、并存还是误用旧数据。这个小例子比一张复杂架构图更能暴露长期记忆的问题。

## 参考资料

- [上下文提供器](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/context-providers)
- [会话管理](https://learn.microsoft.com/en-us/agent-framework/agents/conversations/session)
