# 故障排除指南

## 常见问题及解决方案

### 1. 500 内部服务器错误

**错误信息**: `POST https://your-endpoint.com/api/graphql 500 (Internal Server Error)`

**可能原因**:
- API密钥无效或过期
- 服务器端问题
- 请求格式错误

**解决步骤**:

1. **检查API密钥**
   ```bash
   # 使用诊断脚本测试
   export OMNIVORE_API_KEY="your-api-key"
   node test-api-connection.js
   ```

2. **验证端点配置**
   - 确保端点URL正确
   - 检查是否包含 `/api/graphql` 后缀
   - 验证协议（http/https）

3. **测试连接**
   - 在插件设置中点击"测试API连接"按钮
   - 查看控制台详细错误信息

4. **检查服务器状态**
   ```bash
   curl -I https://your-endpoint.com/api/graphql
   ```

### 2. 认证失败

**错误信息**: `Unauthorized` 或 `认证失败`

**解决方案**:
1. 重新生成API密钥
2. 确保API密钥格式正确
3. 检查API密钥权限

### 3. 网络连接错误

**错误信息**: `Network error` 或 `网络错误`

**解决方案**:
1. 检查网络连接
2. 验证防火墙设置
3. 尝试使用不同的网络

### 4. API端点未配置

**错误信息**: `API endpoint is not configured`

**解决方案**:
1. 在插件设置中配置API端点
2. 使用默认端点：`https://api-prod.omnivore.historyai.top/api/graphql`

## 诊断工具

### 1. 使用内置测试功能

在插件设置中：
1. 配置API端点和密钥
2. 点击"测试API连接"按钮
3. 查看测试结果

### 2. 使用命令行诊断脚本

```bash
# 运行诊断脚本
node test-api-connection.js

# 设置API密钥后运行
export OMNIVORE_API_KEY="your-api-key"
node test-api-connection.js
```

### 3. 手动测试API

```bash
# 测试基本连接
curl -I https://your-endpoint.com/api/graphql

# 测试GraphQL查询
curl -X POST https://your-endpoint.com/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { __typename }"}'

# 测试认证
curl -X POST https://your-endpoint.com/api/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: your-api-key" \
  -d '{"query":"query { me { id name } }"}'
```

## 错误代码说明

| 错误代码 | 含义 | 解决方案 |
|---------|------|----------|
| 400 | 请求格式错误 | 检查请求格式和参数 |
| 401 | 未授权 | 检查API密钥 |
| 403 | 禁止访问 | 检查API密钥权限 |
| 404 | 端点不存在 | 检查URL是否正确 |
| 500 | 服务器内部错误 | 联系服务器管理员 |
| 502 | 网关错误 | 检查服务器状态 |
| 503 | 服务不可用 | 稍后重试 |

## 日志分析

### 查看详细错误信息

1. 打开Obsidian开发者工具 (Ctrl+Shift+I)
2. 查看控制台错误信息
3. 查找包含 `obsidian-omnivore` 的日志

### 常见日志模式

```
# 连接成功
✅ 连接成功！用户: YourName

# 认证失败
❌ 连接失败: GraphQL错误: Unauthorized

# 服务器错误
❌ 连接失败: HTTP 500: Internal Server Error

# 网络错误
❌ 连接失败: NetworkError: Failed to fetch
```

## 自托管实例配置

### 1. 确保服务器配置正确

```nginx
# Nginx配置示例
location /api/graphql {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 2. 检查CORS设置

确保服务器允许来自Obsidian的请求：

```javascript
// Express.js CORS配置
app.use(cors({
  origin: ['https://app.obsidian.md', 'http://localhost:3000'],
  credentials: true
}));
```

### 3. 验证GraphQL端点

确保GraphQL端点返回正确的响应格式：

```json
{
  "data": {
    "__typename": "Query"
  }
}
```

## 联系支持

如果问题仍然存在：

1. **收集信息**:
   - 错误日志
   - 插件版本
   - Obsidian版本
   - 操作系统信息

2. **提交问题**:
   - GitHub Issues: [obsidian-omnivore](https://github.com/omnivore-app/obsidian-omnivore)
   - 邮件: feedback@omnivore.historyai.top

3. **提供详细信息**:
   - 错误截图
   - 控制台日志
   - 复现步骤 