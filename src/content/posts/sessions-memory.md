---
title: Agent 怎么记住你？会话、历史和长期记忆要分开
date: 2026-11-20
summary: 从 AgentSession 到文件、Valkey、Mem0 和 Foundry，讲清记忆存在哪里、什么时候读取，以及怎样避免串会话。
series: Agent 开发
order: 3
tags: [Session, 记忆, 持久化]
---

第一轮说“我想查退款”，第二轮问“那要多久”，模型能接上话，很容易让人觉得它已经有了记忆。

但程序重启以后还能接上吗？换一个设备呢？两个用户同时聊天会不会串？这些问题，单靠把历史消息塞进上下文解决不了。

## 先把四种东西分开

**Session 是一次会话的状态容器；聊天历史是消息记录；长期记忆是筛选后值得再次使用的信息；业务数据仍然属于业务系统。**

例如“用户喜欢简洁回答”可以作为偏好记忆，“订单已退款”则应以订单系统的最新状态为准。不能把上次对话里提过的状态长期当作实时事实。

## 同一个 Session，才能接着聊

当前 Agent Framework 文档使用 `AgentSession`。旧文章里出现的 `AgentThread` 等名称不能直接与新 API 拼接。

接着前一篇已创建好的 `agent`，可以这样复用会话：

```csharp
AgentSession session = await agent.CreateSessionAsync();
Console.WriteLine(await agent.RunAsync("我的演示工单编号是 DEMO-001。", session));
Console.WriteLine(await agent.RunAsync("刚才提到的编号是什么？", session));
```

这里只验证上下文衔接，不表示状态已经落盘。具体消息存在本地还是服务端，取决于 Agent 实现、所选 API 和历史提供器。

应用对外可以使用自己的会话 ID，但必须在服务端校验归属，再映射到内部或服务端会话标识。共享同一个模型凭证的多个用户，不能因为知道某个 `response_id` 就访问别人的会话。

## 存储方案按职责选

| 方案 | 更适合放什么 | 要留意什么 |
| --- | --- | --- |
| 内存历史 | 本地演示、短会话 | 重启丢失，不能跨实例共享 |
| 自定义数据库历史 | 消息与恢复所需状态 | 版本、并发写、租户隔离 |
| Valkey / Redis 类存储 | 外部会话历史或缓存 | TTL、备份与实际持久化设置 |
| FileMemoryProvider | 可由模型读写的记忆文件 | 文件范围、路径隔离、删除与同步 |
| ChatHistoryMemoryProvider | 按需检索历史相关内容 | 检索结果不等于完整逐条历史 |
| Mem0 等记忆服务 | 抽取与检索长期信息 | 数据边界、更新纠错和额外成本 |
| Foundry 相关记忆服务 | 服务支持的托管记忆能力 | 区域、版本、生命周期与归属 |

具体包名和支持方式会变化，尤其不能把某个提供器当成另一种的直接替代。当前官方文档也明确提示：文件记忆与旧实验性记忆 API 的迁移并非自动兼容。

## 历史太长时，怎么缩短

把所有消息一直带着，成本和延迟都会增加。可以保留最近一段、总结较早内容，或按问题检索相关历史。

但是压缩不是无损操作。总结可能漏条件，也可能把用户的假设写成事实。重要状态如审批结果、任务 ID、权限范围，应以结构化数据保存。

还要保留工具调用与结果之间的有效关系。裁掉调用却留下结果，或反过来，都可能破坏消息序列。使用 reducer 或 compaction 时，要按当前 SDK 的消息规则验证，不能简单按字符串长度截断。

## 持久化时，再处理并发

用户快速发出两条消息，两个请求都读取同一个旧版本，然后分别写回，会发生什么？其中一个更新可能覆盖另一个。

可以用同一会话串行处理、乐观并发版本号等方式控制。下面是业务层的流程示意：

```text
校验会话归属
读取 session 与 version
在受控的会话执行范围内运行 Agent
用预期 version 保存新状态
冲突时重新判断，避免盲目覆盖
```

如果调用过程中产生外部副作用，不能简单重跑整个过程；工具还要有独立的幂等设计。

## 用户也应该能纠正和删除记忆

“记得越多越好”不是一个好的默认目标。过时偏好和错误总结，会持续影响后续回答。

让用户能看到保存了哪些偏好、能纠正、能清除。删除时考虑消息、摘要、记忆文件、向量索引与服务端状态，而不只是把聊天页面清空。

## 参考资料

- [Agent Framework：Session](https://learn.microsoft.com/en-us/agent-framework/concepts/agents/conversations/session)
- [上下文提供器、文件记忆与迁移说明](https://learn.microsoft.com/en-us/agent-framework/concepts/agents/conversations/context-providers)
- [Agent Framework 集成目录](https://learn.microsoft.com/en-us/agent-framework/integrations/)
