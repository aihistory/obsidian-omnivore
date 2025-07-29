# 自定义API URL配置

## 概述

Obsidian Omnivore插件现在支持自定义API URL，允许您连接到自托管的Omnivore实例或使用不同的API端点。

## 配置步骤

### 1. 打开设置
1. 在Obsidian中，进入 `设置` → `社区插件`
2. 找到 `Omnivore` 插件并点击 `设置`

### 2. 配置API端点
在设置页面的 `API Endpoint` 字段中：

- **使用默认服务器**：留空或使用 `https://api-prod.omnivore.historyai.top/api/graphql`
- **使用自托管实例**：输入您的服务器URL，例如：
  - `https://your-omnivore-server.com/api/graphql`
  - `http://localhost:8080/api/graphql`
  - `https://omnivore.yourdomain.com/api/graphql`

### 3. 验证配置
- 输入URL后，插件会自动验证URL格式
- 如果URL无效，会显示错误提示
- 可以使用重置按钮恢复到默认端点

## 支持的URL格式

- ✅ `https://api-prod.omnivore.historyai.top/api/graphql` (默认)
- ✅ `https://your-server.com/api/graphql`
- ✅ `http://localhost:8080/api/graphql`
- ✅ `https://omnivore.yourdomain.com/api/graphql`
- ❌ `ftp://server.com/api/graphql` (不支持的协议)
- ❌ `invalid-url` (无效URL格式)

## 自托管Omnivore实例

如果您运行自己的Omnivore实例，请确保：

1. **API端点可访问**：确保 `/api/graphql` 端点正常工作
2. **CORS配置**：允许来自Obsidian的请求
3. **API密钥**：使用您的自托管实例的API密钥
4. **网络连接**：确保Obsidian可以访问您的服务器

## 故障排除

### 常见问题

1. **"API endpoint is not configured"**
   - 确保在设置中配置了API端点
   - 检查URL格式是否正确

2. **连接超时**
   - 检查服务器是否可访问
   - 验证网络连接
   - 确认防火墙设置

3. **认证失败**
   - 确保使用正确的API密钥
   - 验证API密钥是否对您的端点有效

### 调试技巧

- 查看Obsidian开发者控制台的错误信息
- 检查网络请求是否成功
- 验证API端点的响应格式

## 技术细节

- 插件会自动从GraphQL端点提取基础URL
- 支持HTTP和HTTPS协议
- 包含URL格式验证
- 提供重置到默认值的功能

## 更新日志

- **v1.0.0**: 添加自定义API URL支持
- 改进的设置界面
- 添加URL验证
- 支持自托管实例 